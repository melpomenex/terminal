import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta, extractOHLCV } from '@/lib/yahoo';

const SECTOR_MAP: Record<string,{name:string; color:string}> = {
  XLK: { name:'Technology', color:'#3b82f6' },
  XLF: { name:'Financials', color:'#10b981' },
  XLE: { name:'Energy', color:'#f59e0b' },
  XLV: { name:'Healthcare', color:'#ef4444' },
  XLI: { name:'Industrials', color:'#6366f1' },
  XLU: { name:'Utilities', color:'#8b5cf6' },
  XLP: { name:'Staples', color:'#ec4899' },
  XLB: { name:'Materials', color:'#f97316' },
  XLY: { name:'Discretionary', color:'#06b6d4' },
  XLC: { name:'Communication', color:'#84cc16' },
  XLRE:{ name:'Real Estate', color:'#14b8a6' },
};

const RANGES = ['1d','5d','1mo','3mo','6mo','1y','ytd'] as const;

function pctChange(closes:number[]): number {
  if (closes.length<2) return 0;
  const first = closes.find(v=>v>0) ?? closes[0];
  const last = [...closes].reverse().find(v=>v>0) ?? 0;
  if (!first || !last) return 0;
  return ((last-first)/first)*100;
}

export async function GET() {
  try {
    const symbols = Object.keys(SECTOR_MAP);
    const results: any[] = [];
    await Promise.all(symbols.map(async (sym)=>{
      try {
        const dataByRange: Record<string, number> = {};
        const closesLong: number[] = [];
        for (const r of RANGES) {
          try {
            const raw = curl(yfChartUrl(sym, r, r==='1d'?'5m':'1d')) as any;
            const ohlcv = extractOHLCV(raw) as any;
            const closes = (ohlcv.close ?? []) as number[];
            if (closes.length>0) {
              dataByRange[r] = pctChange(closes);
              if (r==='6mo') closesLong.push(...closes);
            }
          } catch {}
        }
        const metaRaw = curl(yfChartUrl(sym,'5d','1d')) as any;
        const meta = extractMeta(metaRaw) as any;
        results.push({
          symbol: sym,
          ...SECTOR_MAP[sym],
          price: meta.price ?? 0,
          change1D: dataByRange['1d'] ?? 0,
          change5D: dataByRange['5d'] ?? 0,
          change1M: dataByRange['1mo'] ?? 0,
          change3M: dataByRange['3mo'] ?? 0,
          change6M: dataByRange['6mo'] ?? 0,
          change1Y: dataByRange['1y'] ?? 0,
          changeYTD: dataByRange['ytd'] ?? 0,
          sparkline: closesLong.slice(-40),
        });
      } catch {}
    }));
    results.sort((a,b)=>b.change1D-a.change1D);
    return NextResponse.json({ sectors: results, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
