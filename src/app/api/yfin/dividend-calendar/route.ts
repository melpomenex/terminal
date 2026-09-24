import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

const POPULAR = ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','JPM','JNJ','V','PG','UNH','HD','BAC','XOM','PFE','KO','PEP','DIS','CSCO','VZ','INTC','MRK','T','CVX','WMT','ABBV','CRM','ADBE','NFLX','AMD','NKE'];

export async function GET() {
  try {
    const items: any[] = [];
    const results = await Promise.all(POPULAR.slice(0,20).map(async (sym)=>{
      try {
        const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d&events=div`, { headers:{'User-Agent':'Mozilla/5.0'}, next:{revalidate:3600} } as any);
        const json = await res.json();
        const events = json?.chart?.result?.[0]?.events?.dividends;
        if (!events) return [];
        return Object.values(events).map((ev:any)=>({ symbol: sym, date: new Date(ev.date*1000).toISOString().slice(0,10), amount: ev.amount, ts: ev.date }));
      } catch { return []; }
    }));
    const flat = results.flat().sort((a:any,b:any)=>a.ts-b.ts);
    const upcoming = flat.filter((f:any)=>f.ts*1000 > Date.now() - 180*864e5).slice(-40).reverse();
    const metaMap = new Map<string, any>();
    for (const sym of [...new Set(upcoming.map((u:any)=>u.symbol))]) {
      try {
        const raw = curl(yfChartUrl(sym,'5d','1d')) as any;
        const meta = extractMeta(raw) as any;
        metaMap.set(sym, meta);
      } catch {}
    }
    const enriched = upcoming.map((u:any)=>{
      const meta = metaMap.get(u.symbol);
      const price = Number(meta?.price ?? 0);
      const yieldPct = price ? (u.amount*4/price*100) : 0;
      return { ...u, price, estYieldPct: +yieldPct.toFixed(2) };
    });
    return NextResponse.json({ dividends: enriched, count: enriched.length, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ dividends: [], error: String(e) }, { status: 502 });
  }
}
