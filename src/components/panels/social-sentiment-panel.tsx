'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

/* ── Types ─────────────────────────────────────────── */

interface SentimentData {
  symbol: string;
  sentimentScore: number;
  sentimentLabel: string;
  redditMentions: number;
  twitterMentions: number;
  mentionHistory: Array<{ date: string; count: number }>;
  sentimentHistory: Array<{ date: string; score: number }>;
}

interface TrendingItem {
  symbol: string;
  name: string;
  mentionCount: number;
  sentimentDirection: 'up' | 'down';
}

/* ── Helpers ───────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 0.5) return 'var(--green)';
  if (score >= 0.15) return '#00b050';
  if (score <= -0.5) return 'var(--red)';
  if (score <= -0.15) return '#ff6633';
  return 'var(--amber-dim)';
}

function sentimentBarWidth(score: number): string {
  return `${Math.abs(score) * 100}%`;
}

/* ── Component ─────────────────────────────────────── */

export default function SocialSentimentPanel({ panelId }: { panelId?: string }) {
  const { symbol, setSymbol } = useTerminalContext();
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fetchSentiment = useCallback(async (sym: string) => {
    try {
      const res = await fetch(`/api/sentiment?symbol=${encodeURIComponent(sym)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mounted.current) {
        setSentiment(data);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/sentiment/trending');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mounted.current) setTrending(data);
    } catch {
      /* Trending is supplementary, silently fail */
    }
  }, []);

  /* Initial load + symbol changes */
  useEffect(() => {
    setLoading(true);
    fetchSentiment(symbol);
    fetchTrending();
    const id = setInterval(() => {
      fetchSentiment(symbol);
      fetchTrending();
    }, 60_000);
    return () => clearInterval(id);
  }, [symbol, fetchSentiment, fetchTrending]);

  /* ── Render ───────────────────────────────────── */

  if (loading && !sentiment) {
    return (
      <div style={{ padding: 8, color: 'var(--amber-dim)', fontFamily: 'var(--font)', fontSize: 12 }}>
        LOADING SENTIMENT...
      </div>
    );
  }

  if (error && !sentiment) {
    return (
      <div style={{ padding: 8, color: 'var(--red)', fontFamily: 'var(--font)', fontSize: 12 }}>
        ERR: {error}
      </div>
    );
  }

  const last7Sentiment = sentiment?.sentimentHistory.slice(-7) ?? [];
  const last30Mentions = sentiment?.mentionHistory ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font)' }}>
      {/* Header */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--amber-bright)', fontWeight: 700, letterSpacing: '0.05em' }}>
          SOCIAL SENTIMENT
        </span>
        <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>
          {symbol}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* ── Left section (70%) ──────────────── */}
        <div style={{ flex: 7, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'auto' }}>
          {sentiment && (
            <>
              {/* Sentiment score */}
              <div style={{ padding: '8px 8px 4px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: scoreColor(sentiment.sentimentScore),
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {sentiment.sentimentScore >= 0 ? '+' : ''}{sentiment.sentimentScore.toFixed(2)}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: scoreColor(sentiment.sentimentScore),
                  letterSpacing: '0.05em',
                }}>
                  {sentiment.sentimentLabel.toUpperCase()}
                </span>
              </div>

              {/* Score bar */}
              <div style={{ padding: '0 8px 6px' }}>
                <div style={{
                  height: 4,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute',
                    width: sentimentBarWidth(sentiment.sentimentScore),
                    height: '100%',
                    background: scoreColor(sentiment.sentimentScore),
                    borderRadius: 2,
                    ...(sentiment.sentimentScore >= 0
                      ? { left: '50%' }
                      : { right: '50%' }),
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: -1,
                    width: 1,
                    height: 6,
                    background: 'var(--amber-dim)',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--amber-dim)', marginTop: 1 }}>
                  <span>-1.0</span>
                  <span>0</span>
                  <span>+1.0</span>
                </div>
              </div>

              {/* 7-day sentiment trend chart */}
              {last7Sentiment.length > 1 && (
                <div style={{ padding: '4px 8px' }}>
                  <div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 3, fontWeight: 700 }}>
                    7-DAY SENTIMENT TREND
                  </div>
                  <MiniLineChart
                    data={last7Sentiment.map((s) => s.score)}
                    labels={last7Sentiment.map((s) => s.date.slice(5))}
                    width={260}
                    height={50}
                    range={[-1, 1]}
                    color={scoreColor(sentiment.sentimentScore)}
                  />
                </div>
              )}

              {/* Source breakdown */}
              <div style={{ padding: '4px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 3, fontWeight: 700 }}>
                  SOURCE BREAKDOWN
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--amber-dim)', marginBottom: 2 }}>REDDIT</div>
                    <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 700 }}>
                      {sentiment.redditMentions.toLocaleString()}
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2 }}>
                      <div style={{
                        width: `${Math.min(100, (sentiment.redditMentions / Math.max(sentiment.redditMentions + sentiment.twitterMentions, 1)) * 100)}%`,
                        height: '100%',
                        background: 'var(--amber)',
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--amber-dim)', marginBottom: 2 }}>TWITTER/X</div>
                    <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 700 }}>
                      {sentiment.twitterMentions.toLocaleString()}
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2 }}>
                      <div style={{
                        width: `${Math.min(100, (sentiment.twitterMentions / Math.max(sentiment.redditMentions + sentiment.twitterMentions, 1)) * 100)}%`,
                        height: '100%',
                        background: 'var(--amber-bright)',
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 30-day mention volume bar chart */}
              {last30Mentions.length > 0 && (
                <div style={{ padding: '4px 8px' }}>
                  <div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 3, fontWeight: 700 }}>
                    30-DAY MENTION VOLUME
                  </div>
                  <MiniBarChart
                    data={last30Mentions.map((m) => m.count)}
                    width={260}
                    height={50}
                    color="var(--amber)"
                  />
                </div>
              )}
            </>
          )}

          {error && sentiment === null && (
            <div style={{ padding: 8, color: 'var(--red)', fontSize: 11 }}>ERR: {error}</div>
          )}
        </div>

        {/* ── Right section (30%) ─────────────── */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={{
            padding: '4px 6px',
            fontSize: 10,
            color: 'var(--amber-bright)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)',
          }}>
            TRENDING
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {trending.map((item) => (
              <div
                key={item.symbol}
                onClick={() => setSymbol(item.symbol)}
                style={{
                  padding: '3px 6px',
                  fontSize: 11,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,176,0,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--amber-bright)' }}>{item.symbol}</span>
                  <span style={{ fontSize: 8, color: 'var(--amber-dim)', marginLeft: 4 }}>
                    {item.mentionCount}
                  </span>
                </div>
                <span style={{
                  fontSize: 12,
                  color: item.sentimentDirection === 'up' ? 'var(--green)' : 'var(--red)',
                  fontWeight: 700,
                }}>
                  {item.sentimentDirection === 'up' ? '▲' : '▼'}
                </span>
              </div>
            ))}
            {trending.length === 0 && (
              <div style={{ padding: 8, fontSize: 10, color: 'var(--amber-dim)' }}>
                LOADING...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '2px 8px',
        fontSize: 9,
        color: 'var(--amber-dim)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>SENTIMENT</span>
        <span>REFRESH 60s</span>
      </div>
    </div>
  );
}

/* ── Mini SVG line chart ──────────────────────────── */

function MiniLineChart({
  data, labels, width, height, range, color,
}: {
  data: number[];
  labels: string[];
  width: number;
  height: number;
  range: [number, number];
  color: string;
}) {
  const [minV, maxV] = range;
  const span = maxV - minV || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = 2 + ((maxV - v) / span) * (height - 4);
    return `${x},${y}`;
  }).join(' ');

  /* Zero line */
  const zeroY = 2 + ((maxV - 0) / span) * (height - 4);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="var(--border)" strokeWidth={0.5} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = 2 + ((maxV - v) / span) * (height - 4);
        return <circle key={i} cx={x} cy={y} r={2} fill={v >= 0 ? 'var(--green)' : 'var(--red)'} />;
      })}
      {/* X labels */}
      {labels.map((lbl, i) => {
        const x = (i / (labels.length - 1)) * width;
        return (
          <text key={i} x={x} y={height - 1} fontSize={7} fill="var(--amber-dim)" textAnchor="middle">
            {lbl}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Mini SVG bar chart ───────────────────────────── */

function MiniBarChart({
  data, width, height, color,
}: {
  data: number[];
  width: number;
  height: number;
  color: string;
}) {
  const max = Math.max(...data, 1);
  const barW = Math.max(2, (width / data.length) - 1);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const barH = (v / max) * (height - 4);
        const x = (i / data.length) * width;
        return (
          <rect
            key={i}
            x={x}
            y={height - barH - 2}
            width={barW}
            height={barH}
            fill={color}
            opacity={0.6}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
