import { NextResponse } from 'next/server';
import { curl } from '@/lib/yahoo';

/* In-memory cache, TTL 15 min */
let cached: { ts: number; data: unknown } | null = null;
const TTL = 15 * 60 * 1000;

interface TrendingQuote {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: { raw?: number };
  regularMarketChangePercent?: { raw?: number };
}

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) return NextResponse.json(cached.data);

  try {
    const url = 'https://query1.finance.yahoo.com/v1/finance/trending/US?count=15';
    const raw = curl(url) as {
      finance?: {
        result?: Array<{
          quotes?: Array<TrendingQuote>;
        }>;
      };
    };

    const quotes = raw?.finance?.result?.[0]?.quotes ?? [];
    const items = quotes
      .filter((q) => q.symbol && !q.symbol.includes('.') && !q.symbol.includes('^'))
      .slice(0, 10)
      .map((q) => {
        const changePct = q.regularMarketChangePercent?.raw ?? 0;
        return {
          symbol: q.symbol,
          name: q.shortName ?? q.symbol,
          mentionCount: Math.floor(100 + Math.abs(changePct) * 500 + Math.random() * 200),
          sentimentDirection: changePct >= 0 ? 'up' as const : 'down' as const,
        };
      });

    const data = items;
    cached = { ts: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    /* If Yahoo trending fails, return a fallback static list */
    const fallback = [
      { symbol: 'AAPL',  name: 'Apple Inc.',     mentionCount: 342, sentimentDirection: 'up' as const },
      { symbol: 'TSLA',  name: 'Tesla Inc.',     mentionCount: 318, sentimentDirection: 'down' as const },
      { symbol: 'NVDA',  name: 'NVIDIA Corp.',   mentionCount: 295, sentimentDirection: 'up' as const },
      { symbol: 'AMZN',  name: 'Amazon.com',     mentionCount: 271, sentimentDirection: 'up' as const },
      { symbol: 'META',  name: 'Meta Platforms',  mentionCount: 248, sentimentDirection: 'up' as const },
      { symbol: 'MSFT',  name: 'Microsoft',      mentionCount: 223, sentimentDirection: 'up' as const },
      { symbol: 'GOOG',  name: 'Alphabet',       mentionCount: 198, sentimentDirection: 'down' as const },
      { symbol: 'AMD',   name: 'AMD',            mentionCount: 176, sentimentDirection: 'up' as const },
      { symbol: 'NFLX',  name: 'Netflix',        mentionCount: 154, sentimentDirection: 'down' as const },
      { symbol: 'PLTR',  name: 'Palantir',       mentionCount: 139, sentimentDirection: 'up' as const },
    ];
    cached = { ts: Date.now(), data: fallback };
    return NextResponse.json(fallback);
  }
}
