import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

/**
 * Level 2 depth source.
 *
 * Real depth-of-book requires an entitled feed (e.g. Nasdaq TotalView,
 * NYSE OpenBook). This deployment has none, and Qube never fabricates book
 * levels or market-maker IDs. The route returns the real top-of-book
 * composite quote (when available) explicitly labeled, plus the entitlement
 * requirement for a true L2 book.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    let lastPrice: number | null = null;
    let currency: string | null = null;
    let exchange: string | null = null;
    try {
      const raw = curl(yfChartUrl(sym, '5d', '1d')) as Record<string, unknown>;
      const meta = extractMeta(raw);
      lastPrice = meta.price != null ? Number(meta.price) : null;
      currency = (meta.currency as string) ?? null;
      exchange = (meta.exchange as string) ?? null;
    } catch {}

    return NextResponse.json({
      symbol: sym,
      quality: 'UNAVAILABLE',
      entitlementRequired: 'Depth-of-book feed (Nasdaq TotalView / NYSE OpenBook / SXCI)',
      message: 'Real Level 2 order book requires an entitled depth feed. Qube does not simulate book levels.',
      topOfBook: lastPrice != null ? {
        // Composite public quote has no NBBO; only the last trade is real.
        last: lastPrice,
        bid: null,
        ask: null,
        currency,
        exchange,
        quality: 'DELAYED',
      } : null,
      bids: [],
      asks: [],
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), symbol: sym, quality: 'UNAVAILABLE' }, { status: 502 });
  }
}
