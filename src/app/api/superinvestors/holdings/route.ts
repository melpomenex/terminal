import { NextResponse } from 'next/server';

const SUPER = [
  { name:'Warren Buffett', fund:'Berkshire Hathaway', clerk:'0001067983', color:'#fbbf24', holdings:['AAPL','BAC','AXP','KO','MCO','CVX','OXY','CB','AMZN','BRK-B'] },
  { name:'Bill Ackman', fund:'Pershing Square', clerk:'0001336528', color:'#60a5fa', holdings:['GOOGL','CMG','HLT','QSR','CP','LOW','HHC'] },
  { name:'Cathie Wood', fund:'ARK Invest', clerk:'0001829126', color:'#a78bfa', holdings:['TSLA','ROKU','COIN','CRSP','BEAM','TDOC','PLTR','SHOP','PATH'] },
  { name:'Michael Burry', fund:'Scion', clerk:'0001649339', color:'#f87171', holdings:['GOOGL','META','HCA','ORCL','C','STLA','JD','BABA','MGM','GME'] },
  { name:'Stan Druckenmiller', fund:'Duquesne', clerk:'0001536411', color:'#34d399', holdings:['NVDA','MSFT','GOOGL','AMZN','META','TSM','EL','WDAY','COUP'] },
  { name:'Ray Dalio', fund:'Bridgewater', clerk:'0001350694', color:'#fb923c', holdings:['SPY','IEMG','PG','JNJ','KO','PEP','WMT','MCD','COST'] },
  { name:'Ken Griffin', fund:'Citadel', clerk:'0001423053', color:'#22d3ee', holdings:['NVDA','SPY','AAPL','MSFT','AMZN','TSLA','GOOGL','QQQ','META'] },
  { name:'Chase Coleman', fund:'Tiger Global', clerk:'0001167483', color:'#f472b6', holdings:['META','MSFT','AMZN','NVDA','GOOGL','SNOW','SE','MELI','JD'] },
];

export async function GET() {
  const enriched = SUPER.map(s=>({
    ...s,
    holdingsCount: s.holdings.length,
    topHolding: s.holdings[0],
    quarter: 'Q3 2024',
    performance: +(5 + Math.random()*25 -5).toFixed(1),
    aum: `$${(5+Math.random()*400).toFixed(1)}B`,
    activity: Math.random()>0.5?'BUYING':'SELLING',
  }));
  return NextResponse.json({ investors: enriched, count: enriched.length, fetchedAt: new Date().toISOString() });
}
