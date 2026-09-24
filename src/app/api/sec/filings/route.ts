import { NextResponse } from 'next/server';
import { tickerToCik, getCompanyFilings, getCompanyFacts } from '@/lib/sec-edgar';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase() ?? '';
  const formsParam = url.searchParams.get('forms');

  if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
  }

  try {
    const cik = await tickerToCik(ticker);
    if (!cik) {
      return NextResponse.json({ error: 'Ticker not found in SEC database' }, { status: 404 });
    }

    const formTypes = formsParam ? formsParam.split(',').map((f) => f.trim()).filter(Boolean) : undefined;
    const filings = await getCompanyFilings(cik, formTypes);

    /* Try to get XBRL facts for key financials (cached, won't re-fetch if warm) */
    let facts: Record<string, unknown> | null = null;
    try {
      facts = await getCompanyFacts(cik);
    } catch { /* non-critical */ }

    /* Extract a few latest KPIs from facts if available */
    let keyFinancials: Record<string, unknown> | null = null;
    if (facts) {
      try {
        keyFinancials = extractKeyFinancials(facts);
      } catch { /* best effort */ }
    }

    return NextResponse.json({
      ticker,
      cik,
      filings: filings.slice(0, 100),
      keyFinancials,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('rate limited')) {
      return NextResponse.json({ error: 'SEC rate limited' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractKeyFinancials(facts: any): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const usGaap: Record<string, any> | undefined = facts?.facts?.['us-gaap'];
  if (!usGaap) return result;

  const keys: [string, string][] = [
    ['revenues', 'Revenues'],
    ['netIncome', 'NetIncomeLoss'],
    ['totalAssets', 'TotalAssets'],
    ['totalLiabilities', 'TotalLiabilities'],
    ['stockholdersEquity', 'StockholdersEquity'],
    ['cashAndEquivalents', 'CashAndCashEquivalentsAtCarryingValue'],
    ['operatingIncome', 'OperatingIncomeLoss'],
    ['basicEPS', 'EarningsPerShareBasic'],
    ['dilutedEPS', 'EarningsPerShareDiluted'],
    ['commonSharesOutstanding', 'CommonStockSharesOutstanding'],
    ['grossProfit', 'GrossProfit'],
    ['researchAndDevelopment', 'ResearchAndDevelopmentExpense'],
  ];

  for (const [label, tag] of keys) {
    const entry = usGaap[tag];
    if (!entry) continue;
    const units = entry.units as Record<string, Array<Record<string, unknown>>> | undefined;
    if (!units) continue;
    const usd = units.USD ?? units.units ?? Object.values(units)[0];
    if (!Array.isArray(usd) || usd.length === 0) continue;
    /* Get latest annual filing */
    const annual = usd.filter((v) => v.form === '10-K').sort((a, b) => String(b.end ?? '').localeCompare(String(a.end ?? '')));
    const latest = annual[0] ?? usd[usd.length - 1];
    result[label] = {
      value: latest.val ?? latest.value,
      end: latest.end,
      form: latest.form,
    };
  }

  return result;
}
