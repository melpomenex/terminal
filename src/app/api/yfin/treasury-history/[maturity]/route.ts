import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractOHLCV } from '@/lib/yahoo';

const MATURITY_MAP: Record<string, string> = {
  '3M': '^IRX',
  '2Y': '^UST2YR',
  '5Y': '^FVX',
  '10Y': '^TNX',
  '30Y': '^TYX',
};

export async function GET(_req: Request, { params }: { params: Promise<{ maturity: string }> }) {
  const { maturity } = await params;
  const symbol = MATURITY_MAP[maturity.toUpperCase()] ?? `^${maturity.toUpperCase()}`;

  const u = new URL(_req.url);
  const range = u.searchParams.get('range') ?? '1y';
  const interval = u.searchParams.get('interval') ?? '1d';

  try {
    const raw = curl(yfChartUrl(symbol, range, interval)) as Record<string, unknown>;
    const ohlcv = extractOHLCV(raw);
    const timestamps = (ohlcv.timestamps as number[]) ?? [];
    const close = (ohlcv.close as number[]) ?? [];

    if (!timestamps.length) {
      return NextResponse.json({ error: 'No data returned', symbol, maturity }, { status: 404 });
    }

    // Return only timestamps + close for charting efficiency
    const data = timestamps.map((t: number, i: number) => ({
      time: t * 1000,
      value: close[i] ?? null,
    })).filter((d) => d.value != null);

    return NextResponse.json({
      maturity,
      symbol,
      range,
      interval,
      data,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), symbol, maturity }, { status: 502 });
  }
}
