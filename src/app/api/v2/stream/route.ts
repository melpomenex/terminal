import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

/**
 * Streaming gateway (v2) — SSE multiplexer.
 *
 * GET /api/v2/stream?transport=sse&topics=quotes:AAPL,quotes:MSFT,...
 *
 * The gateway batches active client topic subscriptions into server-side
 * poll fan-out: quote topics poll the upstream quote source on a managed
 * cadence and push deltas; heartbeats keep intermediaries from closing the
 * connection. WebSocket upgrade is handled by the platform proxy when
 * available — this route serves the SSE transport that the client falls
 * back to automatically.
 *
 * Data integrity: topics requiring real exchange entitlements (trades, depth)
 * are NEVER synthesized. The gateway emits an explicit UNAVAILABLE marker so
 * panels can label themselves accordingly.
 */

export const dynamic = 'force-dynamic';

interface QuoteFrame {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  exchange: string | null;
  retrievalTimestamp: string;
  quality: 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE';
}

const ENTITLED_TOPICS = new Set(['trades', 'depth']);

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function fetchQuoteFrame(symbol: string): Promise<QuoteFrame> {
  const now = new Date().toISOString();
  try {
    const raw = curl(yfChartUrl(symbol, '1d', '1m')) as Record<string, unknown>;
    const meta = extractMeta(raw);
    const price = meta.price != null ? Number(meta.price) : null;
    const prev = meta.previousClose != null ? Number(meta.previousClose) : null;
    return {
      symbol,
      price,
      previousClose: prev,
      change: price != null && prev != null ? price - prev : null,
      changePercent: price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null,
      currency: (meta.currency as string) ?? null,
      exchange: (meta.exchange as string) ?? null,
      retrievalTimestamp: now,
      // Public Yahoo composite quotes are exchange-delayed.
      quality: 'DELAYED',
    };
  } catch {
    return {
      symbol, price: null, previousClose: null, change: null, changePercent: null,
      currency: null, exchange: null, retrievalTimestamp: now, quality: 'UNAVAILABLE',
    };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topics = (url.searchParams.get('topics') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const quoteSymbols = topics
    .filter((t) => t.startsWith('quotes:'))
    .map((t) => t.slice('quotes:'.length))
    .filter(Boolean);

  const entitled = topics.filter((t) => ENTITLED_TOPICS.has(t.split(':')[0]));

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(payload)));
        } catch {
          closed = true;
        }
      };

      // Connection ack with transport capabilities.
      send({
        type: 'connected',
        transport: 'sse',
        topics,
        serverTime: new Date().toISOString(),
      });

      // Entitlement-gated topics get an explicit one-time UNAVAILABLE marker.
      for (const t of entitled) {
        const [topic, symbol] = t.split(':');
        send({
          key: t,
          data: {
            topic,
            symbol,
            quality: 'UNAVAILABLE',
            entitlementRequired: topic === 'trades' ? 'Consolidated Tape (CTA/UTP) tick feed' : 'Level 2 depth (TotalView / depth-of-book)',
            message: 'Real exchange feed not configured. Qube never simulates trades or book depth.',
          },
        });
      }

      // Heartbeat keeps the SSE connection alive through proxies.
      const heartbeat = setInterval(() => send({ type: 'heartbeat', t: Date.now() }), 15_000);

      const pushQuotes = async () => {
        if (quoteSymbols.length === 0) return;
        const frames = await Promise.all(quoteSymbols.map((s) => fetchQuoteFrame(s)));
        for (const frame of frames) {
          send({ key: `quotes:${frame.symbol}`, data: frame, serverTimestamp: Date.now() });
        }
      };

      // Initial push, then managed cadence (5s poll server-side; client
      // coalesces bursts per animation frame).
      await pushQuotes();
      const poll = setInterval(() => { void pushQuotes(); }, 5_000);

      const shutdown = () => {
        closed = true;
        clearInterval(heartbeat);
        clearInterval(poll);
        try { controller.close(); } catch {}
      };

      req.signal.addEventListener('abort', shutdown);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
