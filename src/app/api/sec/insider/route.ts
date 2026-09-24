import { NextResponse } from 'next/server';
import { tickerToCik, getInsiderTransactions, getMarketwideInsider } from '@/lib/sec-edgar';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marketwide = url.searchParams.get('marketwide') === 'true';
  const ticker = url.searchParams.get('ticker')?.toUpperCase() ?? '';

  try {
    if (marketwide) {
      const transactions = await getMarketwideInsider();
      return NextResponse.json({ transactions, mode: 'marketwide' });
    }

    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
      return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
    }

    const cik = await tickerToCik(ticker);
    if (!cik) {
      return NextResponse.json({ error: 'Ticker not found in SEC database' }, { status: 404 });
    }

    const transactions = await getInsiderTransactions(cik);
    return NextResponse.json({ transactions, ticker, cik, mode: 'company' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('rate limited')) {
      return NextResponse.json({ error: 'SEC rate limited' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
