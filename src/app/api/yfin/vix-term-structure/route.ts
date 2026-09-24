import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

const VIX_FAMILY = [
  { symbol: '^VIX', label:'VIX 1M', dte:30 },
  { symbol: '^VIX3M', label:'VIX 3M', dte:90 },
  { symbol: '^VIX6M', label:'VIX 6M', dte:180, fallback: '^VIX' },
  { symbol: 'VIXY', label:'VIX ST FUT', dte:35 },
  { symbol: 'VIXM', label:'VIX MID FUT', dte:110 },
  { symbol: '^VVIX', label:'VVIX', dte:15 },
];

export async function GET() {
  try {
    const results: any[] = [];
    for (const v of VIX_FAMILY) {
      try {
        const raw = curl(yfChartUrl(v.symbol,'5d','1d')) as any;
        const meta = extractMeta(raw) as any;
        results.push({ symbol: v.symbol, label: v.label, dte: v.dte, price: Number(meta.price ?? 0), previousClose: Number(meta.previousClose ?? 0), changePercent: meta.previousClose? ((Number(meta.price)-Number(meta.previousClose))/Number(meta.previousClose)*100):0 });
      } catch { results.push({ symbol: v.symbol, label: v.label, dte: v.dte, price: null, previousClose: null, changePercent: null }); }
    }
    const spot = results.find(r=>r.symbol==='^VIX')?.price ?? 20;
    const termStructure = results.filter(r=>r.price).map(r=>({ dte: r.dte, price: r.price, symbol: r.symbol, label: r.label })).sort((a,b)=>a.dte-b.dte);
    const contango = termStructure.length>=2 ? ((termStructure[1].price - termStructure[0].price)/termStructure[0].price*100) : 0;
    const regime = spot>30?'HIGH FEAR':spot>22?'ELEVATED':spot>15?'NORMAL':'COMPLACENT';
    return NextResponse.json({ spot, termStructure, all: results, contango: +contango.toFixed(2), regime, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
