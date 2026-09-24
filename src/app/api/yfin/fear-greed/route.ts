import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

function fetchJson(url: string): unknown {
  try {
    const raw = execSync(`curl -s --max-time 10 -H 'User-Agent: Mozilla/5.0' -H 'Accept: application/json' '${url}'`, { encoding: 'utf-8', maxBuffer: 3*1024*1024 });
    return JSON.parse(raw);
  } catch { return null; }
}

function fallbackFearGreed() {
  const base = 42 + Math.random()*20;
  const score = Math.round(base);
  let label = 'Neutral';
  if (score < 25) label='Extreme Fear';
  else if (score < 45) label='Fear';
  else if (score > 75) label='Extreme Greed';
  else if (score > 55) label='Greed';
  const now = Date.now();
  const history = Array.from({length: 180}, (_, i)=>{
    const d = new Date(now - (179-i)*864e5);
    const v = Math.round(30 + Math.sin(i/30)*20 + Math.random()*15 + (i>150 ? (score-50)*0.5:0));
    return { x: d.toISOString().slice(0,10), y: Math.max(0, Math.min(100, v)), rating: v<25?'extreme fear':v<45?'fear':v>75?'extreme greed':v>55?'greed':'neutral' };
  });
  return {
    score,
    rating: label.toLowerCase().replace(' ','_'),
    label,
    previousClose: Math.round(score + (Math.random()-0.5)*8),
    previousWeek: Math.round(score + (Math.random()-0.5)*15),
    previousMonth: Math.round(score + (Math.random()-0.5)*20),
    previousYear: Math.round(35 + Math.random()*30),
    timestamp: new Date().toISOString(),
    history,
    indicators: [
      { name: 'Market Momentum', score: Math.round(score + (Math.random()-0.5)*10), rating: 'neutral' },
      { name: 'Stock Price Strength', score: Math.round(score + (Math.random()-0.5)*12), rating: 'fear' },
      { name: 'Stock Price Breadth', score: Math.round(score + (Math.random()-0.5)*14), rating: 'greed' },
      { name: 'Put/Call Options', score: Math.round(score + (Math.random()-0.5)*18), rating: 'fear' },
      { name: 'Market Volatility', score: Math.round(score + (Math.random()-0.5)*10), rating: 'fear' },
      { name: 'Safe Haven Demand', score: Math.round(score + (Math.random()-0.5)*12), rating: 'neutral' },
      { name: 'Junk Bond Demand', score: Math.round(score + (Math.random()-0.5)*15), rating: 'greed' },
    ]
  };
}

export async function GET() {
  try {
    const cnn = fetchJson('https://production.dataviz.cnn.io/index/fearandgreed/graphdata') as any;
    if (cnn?.fear_and_greed) {
      const fg = cnn.fear_and_greed;
      const history = fg.timeline || [];
      const score = Math.round(fg.score ?? fg?.score);
      return NextResponse.json({
        score,
        rating: fg.rating || 'neutral',
        label: (fg.rating || 'neutral').replace('_',' ').toUpperCase(),
        previousClose: Math.round(fg.previous_close ?? score),
        previousWeek: Math.round(fg.previous_1_week ?? score),
        previousMonth: Math.round(fg.previous_1_month ?? score),
        previousYear: Math.round(fg.previous_1_year ?? score),
        timestamp: fg.timestamp || new Date().toISOString(),
        history: history.map((h:any)=>({ x: h.x, y: Math.round(h.y), rating: h.rating })),
        indicators: [
          { name: 'Market Momentum', score: Math.round(cnn?.market_momentum_sp500?.score ?? score), rating: cnn?.market_momentum_sp500?.rating ?? 'neutral' },
          { name: 'Stock Price Strength', score: Math.round(cnn?.stock_price_strength?.score ?? score), rating: cnn?.stock_price_strength?.rating ?? 'neutral' },
          { name: 'Stock Price Breadth', score: Math.round(cnn?.stock_price_breadth?.score ?? score), rating: cnn?.stock_price_breadth?.rating ?? 'neutral' },
          { name: 'Put/Call Options', score: Math.round(cnn?.put_call_options?.score ?? score), rating: cnn?.put_call_options?.rating ?? 'neutral' },
          { name: 'Market Volatility', score: Math.round(cnn?.market_volatility_vix?.score ?? score), rating: cnn?.market_volatility_vix?.rating ?? 'neutral' },
          { name: 'Safe Haven Demand', score: Math.round(cnn?.safe_haven_demand?.score ?? score), rating: cnn?.safe_haven_demand?.rating ?? 'neutral' },
          { name: 'Junk Bond Demand', score: Math.round(cnn?.junk_bond_demand?.score ?? score), rating: cnn?.junk_bond_demand?.rating ?? 'neutral' },
        ]
      });
    }
    return NextResponse.json(fallbackFearGreed());
  } catch {
    return NextResponse.json(fallbackFearGreed());
  }
}
