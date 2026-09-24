import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractOHLCV } from '@/lib/yahoo';

/**
 * Time & Sales data source.
 *
 * Real tick-by-tick consolidated tape requires CTA/UTP entitlements this
 * deployment does not have. This route therefore NEVER fabricates trades:
 * it returns the real exchange 1-minute OHLCV bars, explicitly labeled
 * `DERIVED` so the panel can present them as minute bars — not as
 * millisecond prints — and surface the entitlement note for true tape.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    let timestamps: number[] = [], open: number[] = [], high: number[] = [], low: number[] = [], close: number[] = [], volume: number[] = [];
    try {
      const raw = curl(yfChartUrl(sym, '1d', '1m')) as Record<string, unknown>;
      const data = extractOHLCV(raw) as Record<string, unknown>;
      timestamps = (data.timestamps as number[]) ?? []; open = (data.open as number[]) ?? [];
      high = (data.high as number[]) ?? []; low = (data.low as number[]) ?? [];
      close = (data.close as number[]) ?? []; volume = (data.volume as number[]) ?? [];
    } catch {}
    if (timestamps.length === 0) {
      const raw = curl(yfChartUrl(sym, '5d', '5m')) as Record<string, unknown>;
      const data = extractOHLCV(raw) as Record<string, unknown>;
      timestamps = (data.timestamps as number[]) ?? []; open = (data.open as number[]) ?? [];
      high = (data.high as number[]) ?? []; low = (data.low as number[]) ?? [];
      close = (data.close as number[]) ?? []; volume = (data.volume as number[]) ?? [];
    }

    const bars = [] as Array<{
      time: number; open: number; high: number; low: number; close: number; volume: number;
    }>;
    for (let i = Math.max(0, timestamps.length - 120); i < timestamps.length; i++) {
      const ts = timestamps[i], o = open[i], c = close[i];
      if (!ts || o == null || c == null) continue;
      bars.push({
        time: ts,
        open: o, high: high[i] ?? c, low: low[i] ?? c, close: c, volume: volume[i] ?? 0,
      });
    }

    const lastPrice = close.filter(Boolean).slice(-1)[0] ?? null;

    return NextResponse.json({
      symbol: sym,
      lastPrice,
      // Minute bars are real exchange aggregates — no synthetic bid/ask.
      bid: null,
      ask: null,
      spread: null,
      bars: bars.slice(-120).reverse(),
      quality: 'DERIVED',
      derivationNote: 'Exchange 1-minute OHLCV aggregates. Individual tick prints require an entitled consolidated tape.',
      entitlementRequired: 'Consolidated Tape (CTA/UTP) tick feed',
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), symbol: sym, quality: 'UNAVAILABLE' }, { status: 502 });
  }
}
