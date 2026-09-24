import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

function fetchUrl(url:string): string {
  try { return execSync(`curl -s --max-time 15 -H 'User-Agent: Mozilla/5.0' '${url}'`, { encoding:'utf-8', maxBuffer: 10*1024*1024 }); } catch { return ''; }
}

function parseJsonSafe(s:string) { try { return JSON.parse(s); } catch { return null; } }

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(200, Number(sp.get('limit') ?? 100));
  try {
    const sources = [
      'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json',
      'https://house-stock-watcher-data.s3.us-west-2.amazonaws.com/data/all_transactions.json',
    ];
    let data: any[] | null = null;
    for (const url of sources) {
      const raw = fetchUrl(url);
      if (!raw) continue;
      const json = parseJsonSafe(raw);
      if (Array.isArray(json) && json.length>0) { data=json; break; }
    }
    if (!data) {
      const mock = Array.from({length: 60}, (_,i)=>{
        const senators = ['Nancy Pelosi','Josh Gottheimer','Dan Crenshaw','Roisin','Pat Fallon','Michael McCaul'];
        const symbols = ['NVDA','AAPL','MSFT','TSLA','GOOGL','META','AMZN','SPY','QQQ','JPM','UNH','V','PLTR','AMD','AVGO'];
        const tickers = symbols[Math.floor(Math.random()*symbols.length)];
        const type = Math.random()>0.5?'Purchase':'Sale';
        const amount = ['$1,001 - $15,000','$15,001 - $50,000','$50,001 - $100,000','$100,001 - $250,000','$250,001 - $500,000'][Math.floor(Math.random()*5)];
        const daysAgo = Math.floor(Math.random()*45);
        const d = new Date(Date.now() - daysAgo*864e5);
        return { representative: senators[i%senators.length], ticker: tickers, transaction_date: d.toISOString().slice(0,10), disclosure_date: new Date(d.getTime()+ Math.floor(Math.random()*15)*864e5).toISOString().slice(0,10), type, amount, district: 'Mock', party: Math.random()>0.5?'D':'R' };
      });
      return NextResponse.json({ trades: mock.slice(0,limit), source:'mock', count: mock.length });
    }
    const sorted = [...data].sort((a:any,b:any)=> new Date(b.disclosure_date||b.transaction_date).getTime() - new Date(a.disclosure_date||a.transaction_date).getTime());
    const trades = sorted.slice(0,limit).map((t:any)=> ({
      representative: t.representative ?? t.Representative ?? t.senator ?? 'Unknown',
      ticker: (t.ticker ?? t.Ticker ?? '').toUpperCase().replace(/[^A-Z]/g,'').slice(0,6),
      transaction_date: t.transaction_date ?? t.TransactionDate ?? '',
      disclosure_date: t.disclosure_date ?? t.DisclosureDate ?? '',
      type: t.type ?? t.Type ?? t.transaction ?? 'Purchase',
      amount: t.amount ?? t.Amount ?? '',
      asset: t.asset_description ?? t.Asset ?? '',
      party: t.party ?? t.Party ?? '',
      district: t.district ?? t.District ?? '',
    })).filter((t:any)=>t.ticker);
    return NextResponse.json({ trades, source:'house-stock-watcher', count: data.length, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ trades: [], error: String(e) }, { status: 502 });
  }
}
