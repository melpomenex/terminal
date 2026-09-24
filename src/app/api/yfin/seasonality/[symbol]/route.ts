import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractOHLCV } from '@/lib/yahoo';

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    const raw = curl(yfChartUrl(sym,'10y','1mo')) as any;
    const ohlcv = extractOHLCV(raw) as any;
    const ts: number[] = ohlcv.timestamps ?? [];
    const close: number[] = ohlcv.close ?? [];
    const monthly: Record<number,{returns:number[], sum:number}> = {};
    for(let m=0;m<12;m++) monthly[m]={returns:[], sum:0};
    for(let i=1;i<ts.length;i++) {
      const c = close[i], p = close[i-1];
      if (!c||!p) continue;
      const d = new Date(ts[i]*1000);
      const month = d.getMonth();
      const ret = (c-p)/p*100;
      monthly[month].returns.push(ret);
      monthly[month].sum+=ret;
    }
    const monthlyStats = Object.entries(monthly).map(([k,v])=>{
      const avg = v.returns.length ? v.sum / v.returns.length : 0;
      const winRate = v.returns.length ? v.returns.filter(r=>r>0).length / v.returns.length *100 : 0;
      const sorted = [...v.returns].sort((a,b)=>a-b);
      const median = sorted.length? sorted[Math.floor(sorted.length/2)] : 0;
      return { month: Number(k), monthName: new Date(0,Number(k)).toLocaleString('en-US',{month:'short'}).toUpperCase(), avgReturn: +avg.toFixed(2), medianReturn: +median.toFixed(2), winRate: +winRate.toFixed(1), samples: v.returns.length };
    });
    const rawDaily = curl(yfChartUrl(sym,'5y','1d')) as any;
    const daily = extractOHLCV(rawDaily) as any;
    const dts:number[] = daily.timestamps ?? [];
    const dclose:number[] = daily.close ?? [];
    const dow: Record<number,{returns:number[]}> = {0:{returns:[]},1:{returns:[]},2:{returns:[]},3:{returns:[]},4:{returns:[]},5:{returns:[]},6:{returns:[]}};
    for(let i=1;i<dts.length;i++) {
      const c=dclose[i], p=dclose[i-1];
      if(!c||!p) continue;
      const day = new Date(dts[i]*1000).getDay();
      dow[day].returns.push((c-p)/p*100);
    }
    const dowStats = [1,2,3,4,5].map(d=>{
      const arr = dow[d].returns;
      const avg = arr.length? arr.reduce((a,b)=>a+b,0)/arr.length:0;
      const win = arr.length? arr.filter(r=>r>0).length/arr.length*100:0;
      return { day: d, dayName: ['','MON','TUE','WED','THU','FRI'][d], avgReturn: +avg.toFixed(3), winRate: +win.toFixed(1), samples: arr.length };
    });
    const bestMonth = [...monthlyStats].sort((a,b)=>b.avgReturn-a.avgReturn)[0];
    const worstMonth = [...monthlyStats].sort((a,b)=>a.avgReturn-b.avgReturn)[0];
    return NextResponse.json({ symbol: sym, monthly: monthlyStats, dow: dowStats, bestMonth, worstMonth, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
