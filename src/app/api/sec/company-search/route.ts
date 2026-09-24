import { NextResponse } from 'next/server';
import { tickerToCompanyInfo } from '@/lib/sec-edgar';

export async function GET(request: Request) {
  const ticker = new URL(request.url).searchParams.get('ticker')?.toUpperCase() ?? '';
  if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
  }

  try {
    const info = await tickerToCompanyInfo(ticker);
    if (!info) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }
    return NextResponse.json(info);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('rate limited')) {
      return NextResponse.json({ error: 'SEC rate limited' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 });
  }
}
