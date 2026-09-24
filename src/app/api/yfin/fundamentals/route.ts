import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';
import { execSync } from 'node:child_process';

function n(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'object' && 'raw' in v) v = (v as { raw: number }).raw;
  const parsed = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : Number(v);
  return isFinite(parsed) ? parsed : null;
}

function fmtLarge(v: number | null): string | null {
  if (v == null) return null;
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol') ?? 'AAPL';
  if (!/^[A-Z]{1,5}$/.test(symbol.toUpperCase())) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  const sym = symbol.toUpperCase();

  try {
    // Use v8 chart endpoint (which works) for basic meta data
    const raw = curl(yfChartUrl(sym, '5d', '1d')) as Record<string, unknown>;
    const meta = extractMeta(raw);

    // Scrape Yahoo Finance quote page for fundamentals
    let quoteData: Record<string, string> = {};
    try {
      const html = execSync(
        `curl -s --max-time 10 -H 'User-Agent: Mozilla/5.0 (compatible; Qube/1.0)' 'https://finance.yahoo.com/quote/${encodeURIComponent(sym)}/key-statistics/'`,
        { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 },
      );

      // Extract from JSON-LD or script tags
      const jsonMatch = html.match(/<script[^>]*>window\.YAHOO\.fin\.store\.redux\.inject\('QuoteSummaryStore',\s*(\{[\s\S]*?\})\);/);
      if (jsonMatch) {
        // Try to parse the injected store data
        try {
          const store = JSON.parse(jsonMatch[1]);
          const fields = store?.summaryDetail ?? store?.defaultKeyStatistics ?? store?.financialData ?? {};
          for (const [key, val] of Object.entries(fields as Record<string, unknown>)) {
            if (typeof val === 'number' && isFinite(val)) {
              quoteData[key] = String(val);
            } else if (val && typeof val === 'object' && 'raw' in val) {
              const raw = (val as { raw: unknown }).raw;
              if (typeof raw === 'number') quoteData[key] = String(raw);
            }
          }
        } catch {}
      }

      // Fallback: extract from the summary page HTML
      if (Object.keys(quoteData).length === 0) {
        const patterns: [string, RegExp][] = [
          ['marketCap', /"marketCap":\{[^}]*"raw":([\d.]+)/],
          ['trailingPE', /"trailingPE":\{[^}]*"raw":([\d.]+)/],
          ['forwardPE', /"forwardPE":\{[^}]*"raw":([\d.]+)/],
          ['epsTrailingTwelveMonths', /"epsTrailingTwelveMonths":\{[^}]*"raw":([\d.-]+)/],
          ['dividendYield', /"dividendYield":\{[^}]*"raw":([\d.]+)/],
          ['beta', /"beta":\{[^}]*"raw":([\d.]+)/],
          ['sharesOutstanding', /"sharesOutstanding":\{[^}]*"raw":([\d]+)/],
          ['floatShares', /"floatShares":\{[^}]*"raw":([\d]+)/],
          ['enterpriseValue', /"enterpriseValue":\{[^}]*"raw":([\d]+)/],
          ['priceToBook', /"priceToBook":\{[^}]*"raw":([\d.]+)/],
          ['priceToSalesTrailing12Months', /"priceToSalesTrailing12Months":\{[^}]*"raw":([\d.]+)/],
          ['profitMargins', /"profitMargins":\{[^}]*"raw":([\d.]+)/],
          ['returnOnEquity', /"returnOnEquity":\{[^}]*"raw":([\d.]+)/],
          ['totalRevenue', /"totalRevenue":\{[^}]*"raw":([\d]+)/],
          ['freeCashflow', /"freeCashflow":\{[^}]*"raw":([\d]+)/],
          ['debtToEquity', /"debtToEquity":\{[^}]*"raw":([\d]+)/],
          ['currentRatio', /"currentRatio":\{[^}]*"raw":([\d.]+)/],
        ];
        for (const [key, re] of patterns) {
          const m = html.match(re);
          if (m) quoteData[key] = m[1];
        }
      }
    } catch {}

    const data: Record<string, unknown> = {
      symbol: sym,
      price: meta.price,
      previousClose: meta.previousClose,
      currency: meta.currency,
      exchange: meta.exchange,
      high52w: meta.high52w,
      low52w: meta.low52w,
      marketCap: n(quoteData.marketCap),
      trailingPE: n(quoteData.trailingPE),
      forwardPE: n(quoteData.forwardPE),
      epsTrailingTwelveMonths: n(quoteData.epsTrailingTwelveMonths),
      dividendYield: n(quoteData.dividendYield),
      beta: n(quoteData.beta),
      sharesOutstanding: n(quoteData.sharesOutstanding),
      floatShares: n(quoteData.floatShares),
      enterpriseValue: n(quoteData.enterpriseValue),
      priceToBook: n(quoteData.priceToBook),
      priceToSalesTrailing12Months: n(quoteData.priceToSalesTrailing12Months),
      profitMargins: n(quoteData.profitMargins),
      returnOnEquity: n(quoteData.returnOnEquity),
      totalRevenue: n(quoteData.totalRevenue),
      freeCashflow: n(quoteData.freeCashflow),
      debtToEquity: n(quoteData.debtToEquity),
      currentRatio: n(quoteData.currentRatio),
    };

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Rate limited')) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
