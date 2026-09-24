import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}`, { headers: { 'User-Agent':'Mozilla/5.0' }, next:{ revalidate: 60 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const chain = data?.optionChain?.result?.[0];
    if (!chain) return NextResponse.json({ symbol: sym, items: [], error: 'no chain' });
    const options = chain?.options ?? [];
    const all: any[] = [];
    for (const exp of options) {
      const date = exp.expirationDate ? new Date(exp.expirationDate*1000).toISOString().slice(0,10) : '---';
      const dte = exp.expirationDate ? Math.round((exp.expirationDate*1000 - Date.now())/864e5) : 0;
      const calls = exp.calls ?? []; const puts = exp.puts ?? [];
      const processSide = (list:any[], side:'CALL'|'PUT')=>{
        for (const o of list) {
          const vol = Number(o.volume ?? 0);
          const oi = Number(o.openInterest ?? 0);
          if (vol===0 && oi===0) continue;
          const ratio = oi>0 ? vol/oi : vol;
          if (ratio<0.8 && vol<500) continue;
          const last = Number(o.lastPrice ?? 0);
          const strike = Number(o.strike ?? 0);
          const premium = vol*last*100;
          const iv = Number(o.impliedVolatility ?? 0);
          all.push({
            symbol: sym,
            side,
            strike,
            expiry: date,
            dte,
            last,
            bid: Number(o.bid ?? 0),
            ask: Number(o.ask ?? 0),
            volume: vol,
            openInterest: oi,
            volOiRatio: +ratio.toFixed(2),
            iv: +(iv*100).toFixed(1),
            premium: Math.round(premium),
            change: Number(o.change ?? 0),
            changePercent: Number(o.percentChange ?? 0),
            inTheMoney: !!o.inTheMoney,
            unusualScore: +(ratio* Math.log10(Math.max(2,vol)) * (premium>1e6?1.5:1)).toFixed(2),
          });
        }
      };
      processSide(calls,'CALL'); processSide(puts,'PUT');
    }
    all.sort((a,b)=>b.unusualScore - a.unusualScore);
    const top = all.slice(0,80);
    const putCallVol = top.reduce((s,o)=>s+(o.side==='PUT'?o.volume:0),0) / Math.max(1, top.reduce((s,o)=>s+(o.side==='CALL'?o.volume:0),0));
    return NextResponse.json({ symbol: sym, items: top, stats: { total: all.length, putCallVolRatio: +putCallVol.toFixed(2), totalPremium: top.reduce((s,o)=>s+o.premium,0) }, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ symbol: sym, items: [], error: String(e) }, { status: 502 });
  }
}
