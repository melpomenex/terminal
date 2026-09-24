import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta, extractOHLCV } from '@/lib/yahoo';

/* In-memory cache keyed by symbol, TTL 15 minutes */
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL = 15 * 60 * 1000;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateHistory(symbol: string) {
  const rand = seededRandom(symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const now = Date.now();
  const mentionHistory: Array<{ date: string; count: number }> = [];
  const sentimentHistory: Array<{ date: string; score: number }> = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const base = 40 + Math.floor(rand() * 80);
    mentionHistory.push({
      date: dateStr,
      count: i < 7 ? base + Math.floor(rand() * 30) : base,
    });
    sentimentHistory.push({
      date: dateStr,
      score: +(rand() * 2 - 1).toFixed(3),
    });
  }

  return { mentionHistory, sentimentHistory };
}

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get('symbol')?.toUpperCase();
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < TTL) return NextResponse.json(cached.data);

  /* Fetch recent price data to derive a sentiment signal */
  let sentimentScore = 0;
  let priceChange = 0;
  let volumeRatio = 1;

  try {
    const raw = curl(yfChartUrl(symbol, '1mo', '1d')) as Record<string, unknown>;
    const meta = extractMeta(raw);
    const ohlcv = extractOHLCV(raw);
    const closes = (ohlcv.close as number[]) || [];
    const volumes = (ohlcv.volume as number[]) || [];
    const price = Number(meta.price ?? 0);
    const prev = Number(meta.previousClose ?? 0);
    priceChange = prev > 0 ? (price - prev) / prev : 0;

    if (volumes.length >= 5) {
      const recentVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
      const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
      volumeRatio = avgVol > 0 ? recentVol / avgVol : 1;
    }

    /* Derive composite score from price movement + volume attention */
    sentimentScore = priceChange * 3 + (volumeRatio - 1) * 0.5;
    sentimentScore = Math.max(-1, Math.min(1, sentimentScore));
  } catch {
    /* On fetch failure, keep neutral score */
  }

  const { mentionHistory, sentimentHistory } = generateHistory(symbol);

  /* Override recent sentiment history with computed score */
  const last7 = sentimentHistory.slice(-7);
  for (let i = 0; i < last7.length; i++) {
    const noise = (Math.random() - 0.5) * 0.2;
    last7[i].score = +Math.max(-1, Math.min(1, sentimentScore + noise)).toFixed(3);
  }

  /* Determine label */
  let sentimentLabel: string;
  if (sentimentScore >= 0.5) sentimentLabel = 'Very Bullish';
  else if (sentimentScore >= 0.15) sentimentLabel = 'Bullish';
  else if (sentimentScore <= -0.5) sentimentLabel = 'Very Bearish';
  else if (sentimentScore <= -0.15) sentimentLabel = 'Bearish';
  else sentimentLabel = 'Neutral';

  /* Simulated social mention counts based on volume ratio */
  const baseMentions = Math.floor(50 + volumeRatio * 80);
  const redditMentions = Math.floor(baseMentions * (0.4 + Math.random() * 0.3));
  const twitterMentions = Math.floor(baseMentions * (0.3 + Math.random() * 0.3));

  const data = {
    symbol,
    sentimentScore: +sentimentScore.toFixed(3),
    sentimentLabel,
    redditMentions,
    twitterMentions,
    mentionHistory: mentionHistory.slice(-30),
    sentimentHistory,
  };

  cache.set(symbol, { ts: Date.now(), data });
  return NextResponse.json(data);
}
