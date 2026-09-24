import { NextResponse } from 'next/server';

function calcGamma(strike:number, spot:number, vol:number, dteDays:number): number {
  const T = Math.max(0.01, dteDays/365);
  const r=0.05;
  if (vol<=0 || T<=0) return 0;
  const d1 = (Math.log(spot/strike)+(r+0.5*vol*vol)*T)/(vol*Math.sqrt(T));
  const pdf = Math.exp(-0.5*d1*d1)/Math.sqrt(2*Math.PI);
  const gamma = pdf/(spot*vol*Math.sqrt(T));
  return gamma;
}

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}`, { headers: { 'User-Agent':'Mozilla/5.0' }, next:{ revalidate: 120 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data?.optionChain?.result?.[0];
    const quote = result?.quote;
    const spot = Number(quote?.regularMarketPrice ?? 100);
    if (!spot) throw new Error('no spot');
    const expiryMap = new Map<number, { calls: Map<number,number>, puts: Map<number,number> }>();
    const allOpts = result?.options ?? [];
    const strikesSet = new Set<number>();
    for (const exp of allOpts) {
      const dte = exp.expirationDate ? Math.round((exp.expirationDate*1000 - Date.now())/864e5) : 0;
      if (dte<0 || dte>120) continue;
      const calls = exp.calls ?? []; const puts = exp.puts ?? [];
      for (const c of calls) {
        const strike = Number(c.strike); if (!strike) continue;
        strikesSet.add(strike);
        const oi = Number(c.openInterest ?? 0);
        if (oi===0) continue;
        let entry = expiryMap.get(strike);
        if (!entry) { entry={ calls:new Map(), puts:new Map() }; expiryMap.set(strike, entry); }
        entry.calls.set(dte, (entry.calls.get(dte)??0)+oi);
      }
      for (const p of puts) {
        const strike = Number(p.strike); if (!strike) continue;
        strikesSet.add(strike);
        const oi = Number(p.openInterest ?? 0);
        if (oi===0) continue;
        let entry = expiryMap.get(strike);
        if (!entry) { entry={ calls:new Map(), puts:new Map() }; expiryMap.set(strike, entry); }
        entry.puts.set(dte, (entry.puts.get(dte)??0)+oi);
      }
    }
    const sortedStrikes = Array.from(strikesSet).sort((a,b)=>a-b).filter(s=>Math.abs(s-spot)/spot<0.25);
    const profile: any[] = [];
    let totalCallGamma=0, totalPutGamma=0;
    for (const strike of sortedStrikes) {
      const entry = expiryMap.get(strike);
      if (!entry) continue;
      let callGex=0, putGex=0;
      entry.calls.forEach((oi,dte)=>{
        const vol = 0.4;
        const gammaPerShare = calcGamma(strike, spot, vol, dte);
        const gex = gammaPerShare * oi * 100 * spot * spot / 1e9;
        callGex+=gex;
      });
      entry.puts.forEach((oi,dte)=>{
        const vol = 0.4;
        const gammaPerShare = calcGamma(strike, spot, vol, dte);
        const gex = -gammaPerShare * oi * 100 * spot * spot / 1e9;
        putGex+=gex;
      });
      totalCallGamma+=callGex;
      totalPutGamma+=putGex;
      profile.push({ strike, callGex: +callGex.toFixed(2), putGex: +putGex.toFixed(2), netGex: +(callGex+putGex).toFixed(2), totalOi: Array.from(entry.calls.values()).reduce((a,b)=>a+b,0)+Array.from(entry.puts.values()).reduce((a,b)=>a+b,0) });
    }
    profile.sort((a,b)=>a.strike-b.strike);
    const netGex = totalCallGamma+totalPutGamma;
    const maxAbs = Math.max(...profile.map(p=>Math.abs(p.netGex)),1);
    const flipIdx = profile.findIndex((p,i)=> i>0 && profile[i-1].netGex* p.netGex <0);
    const flipStrike = flipIdx>=0 ? profile[flipIdx].strike : null;
    return NextResponse.json({ symbol: sym, spot, totalCallGex: +totalCallGamma.toFixed(2), totalPutGex: +totalPutGamma.toFixed(2), netGex: +netGex.toFixed(2), maxAbs, flipStrike, profile, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ symbol: sym, profile: [], error: String(e) }, { status: 502 });
  }
}
