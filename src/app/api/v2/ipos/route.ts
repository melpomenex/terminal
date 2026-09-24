import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

/**
 * IPO calendar — Nasdaq's public IPO calendar endpoint (upcoming, priced
 * and filed IPOs with offer ranges, shares and expected dates).
 */

export const dynamic = 'force-dynamic';

interface IpoEntry {
  symbol: string;
  companyName: string;
  expectedPricingDate: string | null;
  offerShares: number | null;
  priceRangeLow: number | null;
  priceRangeHigh: number | null;
  leadUnderwriters: string | null;
  exchange: string | null;
  status: 'FILED' | 'EXPECTED' | 'PRICED' | 'WITHDRAWN';
}

function httpGetJson(url: string): unknown | null {
  try {
    const raw = execSync(
      `curl -s --max-time 18 -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' -H 'Accept: application/json' '${url.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024, timeout: 20_000 },
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseRows(rows: Array<Record<string, unknown>> | undefined, status: IpoEntry['status']): IpoEntry[] {
  return (rows ?? []).map((r) => ({
    symbol: String(r.symbol ?? r.ticker ?? ''),
    companyName: String(r.companyName ?? r.company ?? ''),
    expectedPricingDate: (r.pricingDate ?? r.expectedDate ?? null) as string | null,
    offerShares: r.shares != null ? Number(r.shares) : null,
    priceRangeLow: r.priceRangeLow != null ? Number(r.priceRangeLow) : (typeof r.priceRange === 'string' ? parseFloat(r.priceRange.split('-')[0].replace(/\$/g, '')) : null),
    priceRangeHigh: r.priceRangeHigh != null ? Number(r.priceRangeHigh) : (typeof r.priceRange === 'string' ? parseFloat(r.priceRange.split('-')[1]?.replace(/\$/g, '') ?? '') || null : null),
    leadUnderwriters: (r.leadUnderwriters ?? r.underwriter ?? null) as string | null,
    exchange: (r.exchange ?? r.market ?? null) as string | null,
    status,
  })).filter((e) => e.symbol || e.companyName);
}

export async function GET() {
  const upcoming = httpGetJson('https://api.nasdaq.com/api/ipo/calendar?market=upcoming') as Record<string, unknown> | null;
  const priced = httpGetJson('https://api.nasdaq.com/api/ipo/calendar?market=priced') as Record<string, unknown> | null;
  const filed = httpGetJson('https://api.nasdaq.com/api/ipo/calendar?market=filed') as Record<string, unknown> | null;

  const pick = (raw: Record<string, unknown> | null) => (raw?.data ?? {}) as Record<string, unknown>;
  const entries: IpoEntry[] = [
    ...parseRows((pick(upcoming).upcoming as Array<Record<string, unknown>>) ?? (pick(upcoming).rows as Array<Record<string, unknown>>), 'EXPECTED'),
    ...parseRows((pick(priced).priced as Array<Record<string, unknown>>) ?? (pick(priced).rows as Array<Record<string, unknown>>), 'PRICED'),
    ...parseRows((pick(filed).filed as Array<Record<string, unknown>>) ?? (pick(filed).rows as Array<Record<string, unknown>>), 'FILED'),
  ];

  if (entries.length === 0) {
    return NextResponse.json({
      ipos: [],
      provenance: { sourceProvider: 'Nasdaq IPO calendar', retrievalTimestamp: new Date().toISOString(), quality: 'UNAVAILABLE', currency: 'USD' },
    });
  }

  return NextResponse.json({
    ipos: entries.slice(0, 120),
    provenance: { sourceProvider: 'Nasdaq IPO calendar', retrievalTimestamp: new Date().toISOString(), quality: 'DELAYED', currency: 'USD' },
  });
}
