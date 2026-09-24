import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

const SP100 = ['AAPL','MSFT','AMZN','NVDA','GOOGL','META','GOOG','BRK-B','LLY','AVGO','JPM','UNH','V','MA','XOM','JNJ','HD','PG','COST','ABBV','MRK','CVX','PEP','KO','ADBE','WMT','MCD','CSCO','CRM','ACN','NFLX','TMO','LIN','ABT','AMD','DIS','DHR','VZ','INTC','CMCSA','NKE','PFE','WFC','NEE','PM','INTU','TXN','UNP','COP','LOW','QCOM','AMGN','RTX','HON','UPS','SPGI','ELV','BA','MS','CAT','GS','DE','BLK','BKNG','LRCX','AXP','SBUX','GILD','ADI','ISRG','MDLZ','REGN','VRTX','AMAT','SYK','ZTS','MMC','ADP','C','CB','CI','PLD','SO','DUK','BDX','SCHW','MO','BSX','SHW','ETN','WM','ITW','EOG','PGR','AON','APD','FDX','NSC','MDT','ICE','HUM','MCO','SNPS','ABNB','KLAC','CDNS','TTWO','PAYX','MU','CSX','CME','WELL','MSI','TT','ORLY','CHTR'];

export async function GET() {
  try {
    const results = await Promise.all(SP100.map(async (sym)=>{
      try {
        const raw = curl(yfChartUrl(sym,'5d','1d')) as any;
        const meta = extractMeta(raw) as any;
        const price = Number(meta.price ?? 0);
        const prev = Number(meta.previousClose ?? 0);
        const chgPct = prev>0 ? (price-prev)/prev*100 : 0;
        return { symbol: sym, price, prev, chgPct, high52: Number(meta.high52w ?? 0), low52: Number(meta.low52w ?? 0) };
      } catch { return { symbol: sym, price: 0, prev: 0, chgPct: 0, high52: 0, low52: 0 }; }
    }));
    const advances = results.filter(r=>r.chgPct>0).length;
    const declines = results.filter(r=>r.chgPct<0).length;
    const unchanged = results.filter(r=>Math.abs(r.chgPct)<0.01).length;
    const newHighs = results.filter(r=>r.price>0 && r.high52>0 && r.price>=r.high52*0.995).length;
    const newLows = results.filter(r=>r.price>0 && r.low52>0 && r.price<=r.low52*1.005).length;
    const avgChange = results.reduce((s,r)=>s+r.chgPct,0)/Math.max(1,results.length);
    const upVol = results.filter(r=>r.chgPct>0).reduce((s,r)=>s+Math.abs(r.chgPct),0);
    const downVol = results.filter(r=>r.chgPct<0).reduce((s,r)=>s+Math.abs(r.chgPct),0);
    const trinLike = (advances/Math.max(1,declines)) / (upVol/Math.max(0.01,downVol));
    const adLine = advances - declines;
    const mcclellan = advances - declines > 0 ? Math.min(100, 50 + adLine) : Math.max(-100, 50 + adLine);
    return NextResponse.json({
      advances,
      declines,
      unchanged,
      newHighs,
      newLows,
      avgChange: +avgChange.toFixed(2),
      adLine,
      adRatio: +(advances/Math.max(1,declines)).toFixed(2),
      trinProxy: +trinLike.toFixed(2),
      mcclellan: Math.round(mcclellan),
      breadth: results.sort((a,b)=>b.chgPct-a.chgPct),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
