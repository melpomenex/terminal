'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { squarify, type TreemapItem, type TreemapNode } from '@/lib/treemap';

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

type ScopeMode = 'S&P 500' | 'SECTORS' | 'WORLD';

function changeColor(pct: number): string {
  const clamped = Math.max(-3, Math.min(3, pct));
  if (clamped >= 0) {
    const t = clamped / 3;
    const r = Math.round(60 + (0 - 60) * t);
    const g = Math.round(60 + (180 - 60) * t);
    const b = Math.round(30 + (60 - 30) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -clamped / 3;
    const r = Math.round(60 + (180 - 60) * t);
    const g = Math.round(60 + (40 - 60) * t);
    const b = Math.round(30 + (40 - 30) * t);
    return `rgb(${r},${g},${b})`;
  }
}

function textColor(pct: number): string {
  if (Math.abs(pct) > 0.5) return '#000';
  return 'var(--amber-dim)';
}

export default function MarketHeatmapPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [scope, setScope] = useState<ScopeMode>('S&P 500');
  const [data, setData] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  const modeParam = useMemo(() => {
    if (scope === 'S&P 500') return 'sp500';
    if (scope === 'SECTORS') return 'sectors';
    return 'world';
  }, [scope]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/yfin/screener?mode=${modeParam}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [modeParam]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setDims({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const treemapData = useMemo<TreemapItem[]>(() => {
    return data
      .filter((d) => d.marketCap > 0 || d.price > 0)
      .map((d) => ({
        id: d.symbol,
        value: d.marketCap > 0 ? d.marketCap : d.price * 1e9,
        changePercent: d.changePercent,
        name: d.name,
        symbol: d.symbol,
        price: d.price,
        sector: d.sector,
      }));
  }, [data]);

  const nodes = useMemo<TreemapNode[]>(() => {
    if (treemapData.length === 0) return [];
    const padX = 4;
    const padY = 4;
    return squarify(treemapData, dims.w - padX, dims.h - padY);
  }, [treemapData, dims]);

  const scopes: ScopeMode[] = ['S&P 500', 'SECTORS', 'WORLD'];

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', fontSize: 12, fontFamily: 'var(--font)' }}>
        {error.toUpperCase()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)' }}>
      {/* Header with scope buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginRight: 4 }}>MAP</span>
        {scopes.map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              border: scope === s ? '1px solid var(--amber)' : '1px solid var(--border)',
              borderRadius: 2,
              background: scope === s ? 'rgba(255,191,0,0.15)' : 'transparent',
              color: scope === s ? 'var(--amber-bright)' : 'var(--amber-dim)',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              fontWeight: scope === s ? 700 : 400,
            }}
          >
            {s}
          </button>
        ))}
        {loading && <span style={{ fontSize: 9, color: 'var(--amber-dim)', marginLeft: 'auto' }}>LOADING...</span>}
        {!loading && data.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--amber-dim)', marginLeft: 'auto' }}>{data.length} ITEMS</span>
        )}
      </div>

      {/* Treemap */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: 2 }}>
        {nodes.length === 0 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--amber-dim)', fontSize: 12 }}>
            NO DATA AVAILABLE
          </div>
        )}
        <svg
          width={dims.w}
          height={dims.h}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {nodes.map((node, i) => {
            const gap = 1.5;
            const x = node.x + gap;
            const y = node.y + gap;
            const w = Math.max(0, node.w - gap * 2);
            const h = Math.max(0, node.h - gap * 2);
            if (w < 2 || h < 2) return null;

            const pct = (node.item.changePercent as number) ?? 0;
            const fill = changeColor(pct);
            const canShowLabel = w > 36 && h > 18;
            const canShowPct = w > 36 && h > 30;
            const label = (node.item.name as string) ?? node.item.id;
            const displayLabel = w < 60 && label.length > 5 ? label.slice(0, 4) : label.length > 12 ? label.slice(0, 11) + '.' : label;
            const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;

            return (
              <g
                key={`${node.item.id}-${i}`}
                onClick={() => setSymbol(node.item.id)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={fill}
                  rx={2}
                  ry={2}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.5}
                />
                {canShowLabel && (
                  <text
                    x={x + 4}
                    y={y + 12}
                    fill={textColor(pct)}
                    fontSize={w > 80 ? 10 : 8}
                    fontWeight={700}
                    fontFamily="var(--font)"
                  >
                    {displayLabel}
                  </text>
                )}
                {canShowPct && (
                  <text
                    x={x + 4}
                    y={y + 24}
                    fill={textColor(pct)}
                    fontSize={8}
                    fontFamily="var(--font)"
                    opacity={0.9}
                  >
                    {pctStr}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
