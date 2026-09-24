import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

interface YieldPoint {
  maturity: string;
  label: string;
  years: number;
  symbol: string;
  yield: number | null;
  previousClose: number | null;
  change: number | null;
}

const TREASURY_SYMBOLS: Array<{ maturity: string; label: string; years: number; symbol: string }> = [
  { maturity: '3M', label: '3-Month', years: 0.25, symbol: '^IRX' },
  { maturity: '2Y', label: '2-Year', years: 2, symbol: '^UST2YR' },
  { maturity: '5Y', label: '5-Year', years: 5, symbol: '^FVX' },
  { maturity: '10Y', label: '10-Year', years: 10, symbol: '^TNX' },
  { maturity: '30Y', label: '30-Year', years: 30, symbol: '^TYX' },
];

const INTERP_POINTS: Array<{ maturity: string; label: string; years: number }> = [
  { maturity: '1Y', label: '1-Year', years: 1 },
  { maturity: '3Y', label: '3-Year', years: 3 },
  { maturity: '7Y', label: '7-Year', years: 7 },
  { maturity: '20Y', label: '20-Year', years: 20 },
];

function lerp(x0: number, y0: number, x1: number, y1: number, x: number): number {
  if (x1 === x0) return y0;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

export async function GET() {
  const fetched: Array<{ maturity: string; label: string; years: number; symbol: string; yld: number | null; prev: number | null; chg: number | null }> = [];

  for (const t of TREASURY_SYMBOLS) {
    try {
      const raw = curl(yfChartUrl(t.symbol, '5d', '1d')) as Record<string, unknown>;
      const meta = extractMeta(raw);
      const price = meta.price != null ? Number(meta.price) : null;
      const prev = meta.previousClose != null ? Number(meta.previousClose) : null;
      const chg = price != null && prev != null ? price - prev : null;
      fetched.push({ maturity: t.maturity, label: t.label, years: t.years, symbol: t.symbol, yld: price, prev, chg });
    } catch {
      fetched.push({ maturity: t.maturity, label: t.label, years: t.years, symbol: t.symbol, yld: null, prev: null, chg: null });
    }
  }

  // Build yield curve with interpolated points
  const curve: YieldPoint[] = [];

  // Add known points
  const knownPoints = fetched.filter((p) => p.yld != null);
  const knownSorted = [...knownPoints].sort((a, b) => a.years - b.years);

  // Combine known + interpolated into a single sorted list
  const allPoints: Array<{ maturity: string; label: string; years: number; symbol: string; yld: number | null; prev: number | null; chg: number | null; interpolated: boolean }> = [];

  for (const p of fetched) {
    allPoints.push({ ...p, interpolated: false });
  }

  // Interpolate missing points
  for (const ip of INTERP_POINTS) {
    const alreadyExists = fetched.some((f) => f.maturity === ip.maturity);
    if (alreadyExists) continue;

    let interpYield: number | null = null;

    if (knownSorted.length >= 2) {
      // Find bracketing known points
      let lower = knownSorted[0];
      let upper = knownSorted[knownSorted.length - 1];

      for (let i = 0; i < knownSorted.length - 1; i++) {
        if (knownSorted[i].years <= ip.years && knownSorted[i + 1].years >= ip.years) {
          lower = knownSorted[i];
          upper = knownSorted[i + 1];
          break;
        }
      }

      if (lower.yld != null && upper.yld != null) {
        interpYield = lerp(lower.years, lower.yld, upper.years, upper.yld, ip.years);
      }
    }

    allPoints.push({
      maturity: ip.maturity,
      label: ip.label,
      years: ip.years,
      symbol: '',
      yld: interpYield,
      prev: null,
      chg: null,
      interpolated: true,
    });
  }

  allPoints.sort((a, b) => a.years - b.years);

  for (const p of allPoints) {
    curve.push({
      maturity: p.maturity,
      label: p.label,
      years: p.years,
      symbol: p.symbol,
      yield: p.yld,
      previousClose: p.prev,
      change: p.chg,
    });
  }

  // Compute spreads
  const findYield = (mat: string): number | null => {
    const p = fetched.find((f) => f.maturity === mat);
    return p?.yld ?? null;
  };

  const y2 = findYield('2Y');
  const y10 = findYield('10Y');
  const y30 = findYield('30Y');
  const y3m = findYield('3M');
  const y5y = findYield('5Y');

  const spreads: Array<{ name: string; value: number | null; inverted: boolean }> = [];

  if (y2 != null && y10 != null) {
    const s = y2 - y10;
    spreads.push({ name: '2Y-10Y', value: s, inverted: s > 0 });
  } else {
    spreads.push({ name: '2Y-10Y', value: null, inverted: false });
  }

  if (y10 != null && y30 != null) {
    const s = y10 - y30;
    spreads.push({ name: '10Y-30Y', value: s, inverted: s > 0 });
  } else {
    spreads.push({ name: '10Y-30Y', value: null, inverted: false });
  }

  if (y3m != null && y10 != null) {
    const s = y3m - y10;
    spreads.push({ name: '3M-10Y', value: s, inverted: s > 0 });
  } else {
    spreads.push({ name: '3M-10Y', value: null, inverted: false });
  }

  if (y2 != null && y5y != null) {
    const s = y2 - y5y;
    spreads.push({ name: '2Y-5Y', value: s, inverted: s > 0 });
  } else {
    spreads.push({ name: '2Y-5Y', value: null, inverted: false });
  }

  return NextResponse.json({ curve, spreads, fetchedAt: new Date().toISOString() });
}
