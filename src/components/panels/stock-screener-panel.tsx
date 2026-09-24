'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ScreenerItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap: number;
  sector: string;
  pe: number | null;
  dividendYield: number | null;
  volume: number;
}

const PRESETS = [
  { id: 'most_actives', label: 'MOST ACTIVE' },
  { id: 'day_gainers', label: 'TOP GAINERS' },
  { id: 'day_losers', label: 'TOP LOSERS' },
  { id: 'undervalued_large_caps', label: 'VALUE' },
  { id: 'growth_technology_stocks', label: 'TECH GROWTH' },
  { id: 'small_cap_gainers', label: 'SMALL CAP' },
  { id: 'aggressive_small_caps', label: 'AGGRESSIVE SM' },
];

type SortKey = 'symbol' | 'price' | 'changePercent' | 'marketCap' | 'pe' | 'dividendYield' | 'volume';
type SortDir = 'asc' | 'desc';

function fmtMktCap(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return v.toFixed(0);
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

export default function StockScreenerPanel({ panelId }: { panelId?: string }) {
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [preset, setPreset] = useState('most_actives');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('marketCap');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const mounted = useRef(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; symbol: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchScreener = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/yfin/screener?preset=${encodeURIComponent(p)}&mode=preset`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mounted.current) setItems(data.items ?? []);
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScreener(preset); }, [preset, fetchScreener]);

  const sorted = [...items].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return ' ';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--amber-bright)', fontWeight: 700, letterSpacing: '0.05em' }}>
          STOCK SCREENER
        </span>
        <span style={{ fontSize: 10, color: 'var(--amber-dim)' }}>
          {items.length} RESULTS
        </span>
      </div>

      {/* Preset buttons */}
      <div style={{
        display: 'flex', gap: 2, padding: '4px 8px', borderBottom: '1px solid var(--border)',
        overflow: 'hidden', flexWrap: 'nowrap',
      }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px',
              background: preset === p.id ? '#553300' : 'transparent',
              color: preset === p.id ? 'var(--amber-bright)' : 'var(--amber-dim)',
              border: `1px solid ${preset === p.id ? 'var(--amber)' : 'var(--border)'}`,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr 68px 64px 64px 52px 64px',
        padding: '3px 8px', fontSize: 9, color: 'var(--amber-dim)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={() => toggleSort('symbol')} style={hdrBtnStyle}>SYM{sortArrow('symbol')}</button>
        <span>NAME</span>
        <button onClick={() => toggleSort('price')} style={hdrBtnStyle}>PRICE{sortArrow('price')}</button>
        <button onClick={() => toggleSort('changePercent')} style={hdrBtnStyle}>CHG%{sortArrow('changePercent')}</button>
        <button onClick={() => toggleSort('marketCap')} style={hdrBtnStyle}>MCAP{sortArrow('marketCap')}</button>
        <button onClick={() => toggleSort('pe')} style={hdrBtnStyle}>P/E{sortArrow('pe')}</button>
        <button onClick={() => toggleSort('volume')} style={hdrBtnStyle}>VOL{sortArrow('volume')}</button>
      </div>

      {/* Error */}
      {error && <div style={{ padding: 8, fontSize: 11, color: 'var(--red)' }}>ERR: {error}</div>}

      {/* Loading */}
      {loading && !error && (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--amber-dim)' }}>LOADING...</div>
      )}

      {/* Results */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!loading && sorted.map((item) => {
          const isUp = item.changePercent >= 0;
          const chgClr = item.changePercent === 0 ? 'var(--amber)' : (isUp ? 'var(--green)' : 'var(--red)');
          return (
            <div
              key={item.symbol}
              onClick={() => {
                try {
                  const ctx = (window as any).__terminalSetSymbol;
                  if (ctx) ctx(item.symbol);
                } catch {}
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, symbol: item.symbol });
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr 68px 64px 64px 52px 64px',
                padding: '2px 8px', fontSize: 11, color: 'var(--amber)',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--amber-bright)' }}>{item.symbol}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              <span style={{ textAlign: 'right' }}>{item.price.toFixed(2)}</span>
              <span style={{ textAlign: 'right', color: chgClr }}>{isUp ? '+' : ''}{item.changePercent.toFixed(2)}%</span>
              <span style={{ textAlign: 'right' }}>{item.marketCap > 0 ? fmtMktCap(item.marketCap) : '---'}</span>
              <span style={{ textAlign: 'right' }}>{item.pe ? item.pe.toFixed(1) : '---'}</span>
              <span style={{ textAlign: 'right' }}>{item.volume > 0 ? fmtVol(item.volume) : '---'}</span>
            </div>
          );
        })}
      </div>

      {/* Context menu for adding to watchlist */}
      {ctxMenu && (
        <div style={{
          position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 999,
          background: '#1a1200', border: '1px solid var(--amber)', padding: '4px 0',
          fontSize: 11, color: 'var(--amber)', fontFamily: 'inherit',
        }}>
          <button
            onClick={() => {
              try {
                const add = (window as any).__terminalAddToWatchlist;
                if (add) add(ctxMenu.symbol);
              } catch {}
              setCtxMenu(null);
            }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '4px 12px',
              background: 'transparent', border: 'none', color: 'var(--green)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
            }}
          >
            + ADD {ctxMenu.symbol} TO WATCHLIST
          </button>
          <button
            onClick={() => setCtxMenu(null)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '4px 12px',
              background: 'transparent', border: 'none', color: 'var(--amber-dim)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
            }}
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '2px 8px', fontSize: 9, color: 'var(--amber-dim)',
        borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{PRESETS.find(p => p.id === preset)?.label}</span>
        <span>RIGHT-CLICK TO ADD</span>
      </div>
    </div>
  );
}

const hdrBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--amber-dim)',
  cursor: 'pointer', fontSize: 9, fontFamily: 'inherit', textAlign: 'left', padding: 0,
};
