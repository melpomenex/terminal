'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { isExchangeOpen } from '@/lib/market-hours';

interface IndexData {
  symbol: string;
  name: string;
  region: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  exchange: string;
}

const REGIONS = ['AMERICAS', 'EUROPE', 'ASIA/PACIFIC'] as const;
const REFRESH_MS = 60_000;

function fmt(val: number | null, decimals = 2): string {
  if (val == null) return '---';
  return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(val: number | null): string {
  if (val == null) return '---';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

export default function WorldMarketsPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch('/api/yfin/world-indices');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mounted.current) {
        setIndices(data);
        setLoading(false);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) {
        setError(String(e));
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchIndices();
    const id = setInterval(fetchIndices, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchIndices]);

  const toggleRegion = (region: string) => {
    setCollapsed((prev) => ({ ...prev, [region]: !prev[region] }));
  };

  if (loading) {
    return (
      <div style={{ padding: 8, color: 'var(--amber-dim)', fontFamily: 'var(--font)', fontSize: 12 }}>
        LOADING WORLD MARKETS...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 8, color: 'var(--red)', fontFamily: 'var(--font)', fontSize: 12 }}>
        ERR: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--amber-bright)', fontWeight: 700, letterSpacing: '0.05em' }}>
          WORLD MARKETS
        </span>
        <span style={{ fontSize: 9, color: 'var(--amber-dim)' }}>60s</span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '10px 1fr 80px 64px 64px 48px',
        padding: '3px 8px',
        fontSize: 10,
        color: 'var(--amber-dim)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span />
        <span>INDEX</span>
        <span style={{ textAlign: 'right' }}>VALUE</span>
        <span style={{ textAlign: 'right' }}>CHG</span>
        <span style={{ textAlign: 'right' }}>CHG%</span>
        <span style={{ textAlign: 'right' }}>STATUS</span>
      </div>

      {/* Data rows grouped by region */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {REGIONS.map((region) => {
          const regionIndices = indices.filter((idx) => idx.region === region);
          if (regionIndices.length === 0) return null;
          const isCollapsed = collapsed[region];

          return (
            <div key={region}>
              {/* Region header */}
              <div
                onClick={() => toggleRegion(region)}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--amber-bright)',
                  background: 'rgba(255,176,0,0.06)',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  userSelect: 'none',
                }}
              >
                <span>{region} ({regionIndices.length})</span>
                <span>{isCollapsed ? '+' : '-'}</span>
              </div>

              {/* Index rows */}
              {!isCollapsed && regionIndices.map((idx) => {
                const isUp = idx.changePercent != null && idx.changePercent >= 0;
                const clr = idx.changePercent == null
                  ? 'var(--amber-dim)'
                  : isUp ? 'var(--green)' : 'var(--red)';
                const open = isExchangeOpen(idx.exchange || idx.symbol);
                const decimals = idx.price != null && idx.price > 10000 ? 0 : idx.price != null && idx.price < 100 ? 4 : 2;

                return (
                  <div
                    key={idx.symbol}
                    onClick={() => setSymbol(idx.symbol.replace('^', '').replace('.SS', ''))}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '10px 1fr 80px 64px 64px 48px',
                      padding: '2px 8px',
                      fontSize: 12,
                      color: 'var(--amber)',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,176,0,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 8, color: clr, alignSelf: 'center' }}>
                      {isUp ? '▲' : '▼'}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--amber-bright)', fontSize: 11 }}>
                      {idx.name}
                    </span>
                    <span style={{ textAlign: 'right' }}>{fmt(idx.price, decimals)}</span>
                    <span style={{ textAlign: 'right', color: clr }}>
                      {idx.change != null ? `${idx.change >= 0 ? '+' : ''}${fmt(idx.change)}` : '---'}
                    </span>
                    <span style={{ textAlign: 'right', color: clr }}>
                      {fmtPct(idx.changePercent)}
                    </span>
                    <span style={{
                      textAlign: 'right',
                      fontSize: 9,
                      fontWeight: 700,
                      color: open ? 'var(--green)' : 'var(--red)',
                    }}>
                      {open ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
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
        <span>{indices.length} INDICES</span>
        <span>CLICK ROW TO SET SYMBOL</span>
      </div>
    </div>
  );
}
