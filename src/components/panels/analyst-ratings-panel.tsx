'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

interface AnalystData {
  symbol: string;
  consensus: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  targetMean: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  targetMedian: number | null;
  ratings: Array<{ firm: string; rating: string; priceTarget: number | null; date: string }>;
}

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '---';
  return `$${v.toFixed(decimals)}`;
}

function fmtDate(d: string): string {
  if (!d) return '---';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  } catch { return d; }
}

const RATING_COLORS: Record<string, string> = {
  'Buy': 'var(--green)', 'Strong Buy': 'var(--green)', 'Outperform': 'var(--green)', 'Overweight': 'var(--green)',
  'Hold': 'var(--amber)', 'Neutral': 'var(--amber)', 'Equal-Weight': 'var(--amber)', 'Sector Perform': 'var(--amber)', 'Market Perform': 'var(--amber)',
  'Sell': 'var(--red)', 'Strong Sell': 'var(--red)', 'Underperform': 'var(--red)', 'Underweight': 'var(--red)',
};

export default function AnalystRatingsPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [data, setData] = useState<AnalystData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/yfin/analyst-ratings?symbol=${encodeURIComponent(sym)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (raw.error) throw new Error(raw.error);
      setData(raw as AnalystData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(symbol); }, [symbol, load]);

  if (loading) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>LOADING RATINGS...</div>;
  if (error) return <div style={{ padding: 8, color: 'var(--red)' }}>{error.toUpperCase()}</div>;
  if (!data) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>NO RATINGS DATA</div>;

  const total = data.strongBuy + data.buy + data.hold + data.sell + data.strongSell || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{data.symbol}</span>
        <span style={{ fontSize: 10, color: 'var(--amber-dim)', marginLeft: 6 }}>ANALYST RATINGS</span>
        {data.consensus && (
          <span style={{ fontSize: 10, marginLeft: 6, color: RATING_COLORS[data.consensus] ?? 'var(--amber)', fontWeight: 700 }}>
            {data.consensus.toUpperCase()}
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', height: 20 }}>
        {[
          { label: 'SB', count: data.strongBuy, color: 'var(--green)' },
          { label: 'B', count: data.buy, color: 'var(--green)' },
          { label: 'H', count: data.hold, color: 'var(--amber)' },
          { label: 'S', count: data.sell, color: 'var(--red)' },
          { label: 'SS', count: data.strongSell, color: 'var(--red)' },
        ].map((r) => (
          <div key={r.label} style={{
            flex: r.count || 0.5, background: r.color, opacity: 0.6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: '#000', fontWeight: 700, minWidth: r.count > 0 ? 20 : 0,
          }}>
            {r.count || ''}
          </div>
        ))}
      </div>

      {/* Price target consensus */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '3px 8px', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
        <span style={{ color: 'var(--amber-dim)' }}>PT LOW</span>
        <span style={{ color: 'var(--amber-dim)', textAlign: 'center' }}>PT MEAN</span>
        <span style={{ color: 'var(--amber-dim)', textAlign: 'center' }}>PT MEDIAN</span>
        <span style={{ color: 'var(--amber-dim)', textAlign: 'right' }}>PT HIGH</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '2px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
        <span style={{ color: 'var(--amber)' }}>{fmtNum(data.targetLow)}</span>
        <span style={{ color: 'var(--amber-bright)', textAlign: 'center', fontWeight: 700 }}>{fmtNum(data.targetMean)}</span>
        <span style={{ color: 'var(--amber)', textAlign: 'center' }}>{fmtNum(data.targetMedian)}</span>
        <span style={{ color: 'var(--amber)', textAlign: 'right' }}>{fmtNum(data.targetHigh)}</span>
      </div>

      {/* Recent ratings table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 55px 60px', padding: '2px 0', borderBottom: '1px solid var(--border-light)', marginTop: 2 }}>
        {['FIRM', 'RATING', 'PT', 'DATE'].map((h, i) => (
          <div key={h} style={{ fontSize: 9, color: 'var(--amber-dim)', padding: '2px 6px', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {(data.ratings ?? []).slice(0, 20).map((r, i) => {
          const color = RATING_COLORS[r.rating] ?? 'var(--amber)';
          return (
            <div key={`${r.firm}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 55px 60px', borderBottom: '1px solid rgba(51,34,0,0.3)' }}>
              <div style={{ fontSize: 11, color: 'var(--amber)', padding: '2px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.firm}
              </div>
              <div style={{ fontSize: 11, color, padding: '2px 6px', textAlign: 'right', fontWeight: 700 }}>{r.rating}</div>
              <div style={{ fontSize: 11, color: 'var(--amber-dim)', padding: '2px 6px', textAlign: 'right' }}>{r.priceTarget != null ? fmtNum(r.priceTarget) : '---'}</div>
              <div style={{ fontSize: 10, color: 'var(--amber-dim)', padding: '2px 6px', textAlign: 'right' }}>{fmtDate(r.date)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '2px 8px', fontSize: 9, color: 'var(--amber-dim)', borderTop: '1px solid var(--border)' }}>
        {total} ANALYSTS
      </div>
    </div>
  );
}
