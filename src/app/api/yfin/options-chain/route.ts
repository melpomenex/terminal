import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol') || 'AAPL';
  const sym = symbol.toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  try {
    const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(sym)}/option-chain?assetclass=stocks&callput=callput&money=all&type=all&fromdate=all`;
    const raw = execSync(
      `curl -s --max-time 15 -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' -H 'Accept: application/json' '${url}'`,
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
    );
    const data = JSON.parse(raw);
    const rows = data?.data?.table?.rows ?? [];

    const expirations: string[] = [];
    const contracts: Array<{
      expiry: string; type: 'call' | 'put'; strike: number;
      last: number | null; bid: number | null; ask: number | null;
      volume: number | null; openInterest: number | null;
    }> = [];

    let lastGroup = '';
    for (const r of rows) {
      if (!r.strike) {
        if (r.expirygroup) lastGroup = r.expirygroup;
        continue;
      }
      const expiryLabel = r.expiryDate ? `${r.expiryDate}` : lastGroup;
      const expiryNorm = normalizeExpiry(expiryLabel);
      if (expirations.length === 0 || expirations[expirations.length - 1] !== expiryNorm) {
        expirations.push(expiryNorm);
      }

      const strike = parseFloat(r.strike);
      if (isNaN(strike)) continue;

      // Call
      if (r.c_Bid && r.c_Bid !== '--') {
        contracts.push({
          expiry: expiryNorm, type: 'call', strike,
          last: parseNum(r.c_Last), bid: parseNum(r.c_Bid), ask: parseNum(r.c_Ask),
          volume: parseNum(r.c_Volume), openInterest: parseNum(r.c_Openinterest),
        });
      }
      // Put
      if (r.p_Bid && r.p_Bid !== '--') {
        contracts.push({
          expiry: expiryNorm, type: 'put', strike,
          last: parseNum(r.p_Last), bid: parseNum(r.p_Bid), ask: parseNum(r.p_Ask),
          volume: parseNum(r.p_Volume), openInterest: parseNum(r.p_Openinterest),
        });
      }
    }

    return NextResponse.json({ symbol: sym, expirations, contracts });
  } catch (e) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}

function parseNum(v: string | null | undefined): number | null {
  if (!v || v === '--') return null;
  const n = parseFloat(v.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function normalizeExpiry(label: string): string {
  // "May 18" → "2026-05-18" (approximate year)
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
  };
  const m = label.match(/^(\w{3})\s+(\d{1,2}),?\s*(\d{4})?$/);
  if (!m) return label;
  const month = months[m[1]] ?? '01';
  const day = m[2].padStart(2, '0');
  const year = m[3] || new Date().getFullYear().toString();
  return `${year}-${month}-${day}`;
}
