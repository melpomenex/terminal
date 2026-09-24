import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

function fetchUrl(url:string): string {
  try { return execSync(`curl -s --max-time 10 -H 'User-Agent: Mozilla/5.0 (compatible; qube-bot/1.0)' -H 'Accept: application/json' '${url}'`, { encoding:'utf-8', maxBuffer: 5*1024*1024 }); } catch { return ''; }
}

const TICKER_RE = /\b([A-Z]{2,5})\b/g;
const BLACKLIST = new Set(['THE','AND','FOR','YOU','NOT','ARE','BUT','ALL','CAN','WAS','HAS','CEO','USA','NYSE','WSB','YOLO','DD','ETF','IMO','LOL','FAQ','FOMO','PUMP','MOON','HODL','ATH','FUD','BULL','BEAR','GAIN','LOSS','USD','BUY','SELL','CALL','PUT']);

export async function GET() {
  try {
    const subs = ['wallstreetbets','stocks','investing','StockMarket'];
    const allText: string[] = [];
    const rawPosts: any[] = [];
    for (const sub of subs.slice(0,2)) {
      const raw = fetchUrl(`https://www.reddit.com/r/${sub}/hot.json?limit=30`);
      if (!raw) continue;
      try {
        const json = JSON.parse(raw);
        const children = json?.data?.children ?? [];
        for (const ch of children) {
          const d = ch.data;
          if (!d) continue;
          const txt = `${d.title||''} ${d.selftext||''}`;
          allText.push(txt);
          rawPosts.push({ sub, title: d.title, score: d.score, num_comments: d.num_comments, url: `https://reddit.com${d.permalink}`, created_utc: d.created_utc });
        }
      } catch {}
    }
    const counts = new Map<string, {count:number; mentions:string[]; sentiment: number}>();
    for (const txt of allText) {
      let m: RegExpExecArray | null;
      const re = new RegExp(TICKER_RE);
      while ((m=re.exec(txt))!==null) {
        const sym = m[1];
        if (sym.length<2 || BLACKLIST.has(sym)) continue;
        if (!/^[A-Z]+$/.test(sym)) continue;
        const entry = counts.get(sym) ?? { count:0, mentions: [], sentiment: 0 };
        entry.count++;
        if (entry.mentions.length<3) entry.mentions.push(txt.slice(0,120));
        const lower = txt.toLowerCase();
        if (lower.includes('bull')||lower.includes('buy')||lower.includes('moon')||lower.includes('calls')) entry.sentiment+=1;
        if (lower.includes('bear')||lower.includes('sell')||lower.includes('puts')||lower.includes('crash')) entry.sentiment-=1;
        counts.set(sym, entry);
      }
    }
    const trending = Array.from(counts.entries()).filter(([,v])=>v.count>=2).map(([symbol,v])=>({
      symbol,
      mentions: v.count,
      sentiment: v.sentiment>0?'bullish':v.sentiment<0?'bearish':'neutral',
      score: v.count*2 + v.sentiment,
      sample: v.mentions[0] ?? '',
    })).sort((a,b)=>b.score-a.score).slice(0,25);
    const withPrice = trending;
    return NextResponse.json({ trending: withPrice, posts: rawPosts.slice(0,20), fetchedAt: new Date().toISOString(), source:'reddit' });
  } catch (e) {
    const mock = ['NVDA','TSLA','AAPL','GME','AMC','PLTR','AMD','SMCI','SPY','QQQ'].map((s,i)=>({ symbol:s, mentions: 30-i*2, sentiment: i%3===0?'bullish':'neutral', score: 30-i, sample: `WSB trending ${s}` }));
    return NextResponse.json({ trending: mock, posts: [], error: String(e), source:'mock' });
  }
}
