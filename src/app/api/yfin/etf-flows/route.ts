import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta, extractOHLCV } from '@/lib/yahoo';

const ETFS = [
  'SPY','QQQ','IWM','DIA','VTI','VOO','VEA','VWO','AGG','TLT','IEF','LQD','HYG','GLD','SLV','USO','XLF','XLK','XLE','XLV','XLI','XLP','XLY','XLB','XLRE','XLC','EFA','EEM','VNQ','ARKK','SMH','XBI','IBB','KWEB','EWZ','FXI'
];

export async function GET() {
  try {
    const items: any[] = [];
    for (const sym of ETFS) {
      try {
        const rawDaily = curl(yfChartUrl(sym,'10d','1d')) as any;
        const meta = extractMeta(rawDaily) as any;
        const ohlcv = extractOHLCV(rawDaily) as any;
        const vols: number[] = ohlcv.volume ?? [];
        const closes: number[] = ohlcv.close ?? [];
        const avgVol = vols.slice(0,-1).reduce((a:number,b:number)=>a+b,0)/Math.max(1, vols.length-1);
        const lastVol = vols[vols.length-1] ?? 0;
        const volRatio = avgVol ? lastVol/avgVol : 1;
        const chg = closes.length>=2 ? (closes[closes.length-1]-closes[closes.length-2])/closes[closes.length-2]*100 : 0;
        const price = Number(meta.price ?? closes[closes.length-1] ?? 0);
        const estFlow = price*lastVol * (chg>0?1:-1) * (volRatio>1.2?1.5:1);
        items.push({
          symbol: sym,
          price,
          changePercent: chg,
          volume: lastVol,
          avgVolume: avgVol,
          volRatio: +volRatio.toFixed(2),
          estFlow: Math.round(estFlow),
          flowDirection: estFlow>0?'INFLOW':'OUTFLOW',
          flowStrength: Math.abs(volRatio)* (Math.abs(chg)>1?1.5:1),
        });
      } catch {}
    }
    items.sort((a,b)=>Math.abs(b.estFlow)-Math.abs(a.estFlow));
    const inflows = items.filter(i=>i.flowDirection==='INFLOW').sort((a,b)=>b.estFlow-a.estFlow).slice(0,15);
    const outflows = items.filter(i=>i.flowDirection==='OUTFLOW').sort((a,b)=>a.estFlow-b.estFlow).slice(0,15);
    return NextResponse.json({ all: items, inflows, outflows, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
