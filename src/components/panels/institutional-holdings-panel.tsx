'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

interface InstitutionalHolder {
  cik: string;
  name: string;
  sharesHeld: number;
  value: number;
  pctPortfolio: number | null;
  change: number;
  pctChange: number | null;
  reportDate: string;
}

interface TrendPoint {
  quarter: string;
  pct: number;
}

interface ApiResponse {
  ticker: string;
  cik: string;
  holders: InstitutionalHolder[];
  sharesOutstanding: number | null;
  institutionalPct: number;
  insiderPct: number;
  publicFloatPct: number;
  trendData: TrendPoint[];
  error?: string;
}

function fmtShares(n: number | null | undefined): string {
  if (n == null || n === 0) return '---';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtValue(n: number | null | undefined): string {
  if (n == null || n === 0) return '---';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '---';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function InstitutionalHoldingsPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [holders, setHolders] = useState<InstitutionalHolder[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [instPct, setInstPct] = useState(0);
  const [insiderPct, setInsiderPct] = useState(0);
  const [floatPct, setFloatPct] = useState(100);
  const [sharesOut, setSharesOut] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (sym: string) => {
    const prev = abortRef.current;
    prev?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sec/institutional?ticker=${encodeURIComponent(sym)}`, { signal: ctrl.signal });
      const json: ApiResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setHolders(json.holders ?? []);
      setTrendData(json.trendData ?? []);
      setInstPct(json.institutionalPct ?? 0);
      setInsiderPct(json.insiderPct ?? 0);
      setFloatPct(json.publicFloatPct ?? 100);
      setSharesOut(json.sharesOutstanding ?? null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(symbol);
    return () => { abortRef.current?.abort(); };
  }, [symbol, load]);

  /* Pie chart dimensions */
  const pieSize = 70;
  const pieCx = pieSize / 2;
  const pieCy = pieSize / 2;
  const pieR = 30;

  /* SVG pie slices */
  function pieSlice(startAngle: number, endAngle: number, color: string, label: string) {
    const start = polarToCartesian(pieCx, pieCy, pieR, endAngle);
    const end = polarToCartesian(pieCx, pieCy, pieR, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const d = [
      `M ${pieCx} ${pieCy}`,
      `L ${start.x} ${start.y}`,
      `A ${pieR} ${pieR} 0 ${largeArc} 0 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
    return <path key={label} d={d} fill={color} opacity={0.7} />;
  }

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  /* Sparkline for trend */
  function renderSparkline(data: TrendPoint[]) {
    if (data.length < 2) return null;
    const w = 140, h = 36, pad = 4;
    const min = Math.min(...data.map((d) => d.pct));
    const max = Math.max(...data.map((d) => d.pct));
    const range = max - min || 1;
    const points = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (d.pct - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke="var(--amber)"
          strokeWidth={1.5}
        />
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
          const y = pad + (1 - (d.pct - min) / range) * (h - 2 * pad);
          return <circle key={i} cx={x} cy={y} r={1.5} fill="var(--amber-bright)" />;
        })}
        {/* X labels */}
        {data.filter((_, i) => i % 2 === 0).map((d, idx) => {
          const origIdx = idx * 2;
          const x = pad + (origIdx / (data.length - 1)) * (w - 2 * pad);
          return (
            <text key={d.quarter} x={x} y={h} fontSize={7} fill="var(--amber-dim)" textAnchor="middle">
              {d.quarter}
            </text>
          );
        })}
      </svg>
    );
  }

  const colStyle: React.CSSProperties = {
    fontSize: 9, color: 'var(--amber-dim)', padding: '2px 4px', textAlign: 'right', whiteSpace: 'nowrap',
  };
  const cellStyle: React.CSSProperties = {
    fontSize: 10, padding: '2px 4px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{symbol}</span>
        <span style={{ fontSize: 10, color: 'var(--amber-dim)', marginLeft: 6 }}>INSTITUTIONAL HOLDINGS</span>
        {sharesOut && (
          <span style={{ fontSize: 9, color: 'var(--amber-dim)', marginLeft: 8 }}>
            SHARES OUT: {fmtShares(sharesOut)}
          </span>
        )}
      </div>

      {loading && <div style={{ padding: 8, color: 'var(--amber-dim)' }}>LOADING INSTITUTIONAL DATA...</div>}
      {error && <div style={{ padding: 8, color: 'var(--red)' }}>{error.toUpperCase()}</div>}
      {!loading && !error && holders.length === 0 && (
        <div style={{ padding: 8, color: 'var(--amber-dim)' }}>NO INSTITUTIONAL HOLDINGS DATA FOUND</div>
      )}

      {!loading && !error && (
        <>
          {/* Overview: pie chart + sparkline */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '6px 8px', gap: 12, alignItems: 'center' }}>
            {/* Pie chart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width={pieSize} height={pieSize}>
                {pieSlice(0, instPct / 100 * 360, 'var(--amber)', 'inst')}
                {pieSlice(instPct / 100 * 360, (instPct + insiderPct) / 100 * 360, 'var(--green)', 'insider')}
                {pieSlice((instPct + insiderPct) / 100 * 360, 360, '#333', 'float')}
              </svg>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 8, color: 'var(--amber)' }}>INST {instPct.toFixed(1)}%</span>
                <span style={{ fontSize: 8, color: 'var(--green)' }}>INS {insiderPct.toFixed(1)}%</span>
                <span style={{ fontSize: 8, color: '#666' }}>FLT {floatPct.toFixed(1)}%</span>
              </div>
            </div>

            {/* Trend sparkline */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--amber-dim)', marginBottom: 2 }}>INST OWNERSHIP TREND</div>
              {renderSparkline(trendData)}
            </div>
          </div>

          {/* Holders table headers */}
          {holders.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 50px 65px 50px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ ...colStyle, textAlign: 'left' }}>INSTITUTION</div>
              <div style={colStyle}>SHARES</div>
              <div style={colStyle}>% PORT</div>
              <div style={colStyle}>% OUT</div>
              <div style={colStyle}>VALUE</div>
              <div style={colStyle}>CHG</div>
            </div>
          )}

          {/* Holders rows */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {holders.slice(0, 30).map((h, i) => {
              const pctOut = sharesOut && h.sharesHeld > 0 ? (h.sharesHeld / sharesOut * 100) : null;
              const changeColor = h.pctChange != null
                ? (h.pctChange > 10 ? 'var(--green)' : h.pctChange < -10 ? 'var(--red)' : 'var(--amber)')
                : 'var(--amber-dim)';
              const rowBg = h.pctChange != null
                ? (h.pctChange > 10 ? 'rgba(0,255,0,0.03)' : h.pctChange < -10 ? 'rgba(255,0,0,0.03)' : 'transparent')
                : 'transparent';
              return (
                <div key={`${h.cik}-${i}`} style={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 50px 50px 65px 50px',
                  borderBottom: '1px solid rgba(51,34,0,0.3)', background: rowBg,
                }}>
                  <div style={{ ...cellStyle, textAlign: 'left', color: 'var(--amber)', fontSize: 9 }}>
                    {h.name || '---'}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber)' }}>
                    {fmtShares(h.sharesHeld)}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber-dim)' }}>
                    {h.pctPortfolio != null ? `${h.pctPortfolio.toFixed(1)}%` : '---'}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber-dim)' }}>
                    {pctOut != null ? `${pctOut.toFixed(2)}%` : '---'}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber)' }}>
                    {fmtValue(h.value)}
                  </div>
                  <div style={{ ...cellStyle, color: changeColor }}>
                    {fmtPct(h.pctChange)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '2px 8px', fontSize: 9, color: 'var(--amber-dim)', borderTop: '1px solid var(--border)' }}>
            {holders.length} HOLDERS | SOURCE: SEC EDGAR 13F-HR
          </div>
        </>
      )}
    </div>
  );
}
