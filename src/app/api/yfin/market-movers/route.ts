import { NextResponse } from 'next/server';
import { curl as yCurl } from '@/lib/yahoo';

function yfetch(url: string) { try { return yCurl(url) as any; } catch { return null; } }

const PRESETS: Record<string,string> = {
  gainers: 'day_gainers',
  losers: 'day_losers',
  active: 'most_actives',
  unusual: 'most_actives',
  small_gainers: 'small_cap_gainers',
  undervalued: 'undervalued_large_caps',
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get('type') ?? 'gainers';
  const preset = PRESETS[type] ?? 'day_gainers';
  try {
    const raw = yfetch(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${encodeURIComponent(preset)}&count=60`) as any;
    const quotes = raw?.finance?.[0]?.quotes as any[] ?? [];
    const items = quotes.map((q:any)=>({
      symbol: String(q.symbol ?? ''),
      name: String(q.shortName ?? q.longName ?? ''),
      price: Number(q.regularMarketPrice ?? q.postMarketPrice ?? 0),
      previousClose: Number(q.regularMarketPreviousClose ?? 0),
      change: Number(q.regularMarketChange ?? 0),
      changePercent: Number(q.regularMarketChangePercent ?? q.regularMarketChangePercent ?? 0),
      volume: Number(q.regularMarketVolume ?? 0),
      avgVolume: Number(q.averageDailyVolume3Month ?? 0),
      marketCap: Number(q.marketCap ?? 0),
      fiftyTwoWeekHigh: Number(q.fiftyTwoWeekHigh ?? 0),
      fiftyTwoWeekLow: Number(q.fiftyTwoWeekLow ?? 0),
      unusualRatio: Number(q.regularMarketVolume ?? 0) / Math.max(1, Number(q.averageDailyVolume3Month ?? 1)),
    })).filter((i:any)=>i.symbol).sort((a:any,b:any)=>{
      if (type==='unusual') return b.unusualRatio - a.unusualRatio;
      if (type==='losers') return a.changePercent - b.changePercent;
      if (type==='active') return b.volume - a.volume;
      return b.changePercent - a.changePercent;
    }).slice(0,40);
    return NextResponse.json({ type, items, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ type, items: [], error: String(e) }, { status: 502 });
  }
}
