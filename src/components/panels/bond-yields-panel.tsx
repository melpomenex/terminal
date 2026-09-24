'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface CurvePoint {
  maturity: string;
  label: string;
  years: number;
  symbol: string;
  yield: number | null;
  previousClose: number | null;
  change: number | null;
}

interface Spread {
  name: string;
  value: number | null;
  inverted: boolean;
}

interface TreasuryData {
  curve: CurvePoint[];
  spreads: Spread[];
  fetchedAt: string;
}

interface HistoryPoint {
  time: number;
  value: number;
}

interface HistoryData {
  maturity: string;
  symbol: string;
  range: string;
  data: HistoryPoint[];
}

const REFRESH_MS = 60_000;

function fmtYield(v: number | null): string {
  if (v == null) return '---';
  return v.toFixed(3);
}

function fmtChange(v: number | null): string {
  if (v == null) return '---';
  return `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
}

function fmtSpread(v: number | null): string {
  if (v == null) return '---';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)} bps`;
}

function fmtBps(v: number | null): string {
  if (v == null) return '---';
  const bps = v * 100;
  return `${bps >= 0 ? '+' : ''}${bps.toFixed(0)} bps`;
}

// Yield curve SVG chart
function YieldCurveSVG({ curve, onSelectMaturity }: { curve: CurvePoint[]; onSelectMaturity: (m: string) => void }) {
  const validPoints = curve.filter((p) => p.yield != null);
  if (validPoints.length < 2) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-dim)', fontSize: 11 }}>
        INSUFFICIENT DATA FOR CURVE
      </div>
    );
  }

  const W = 320;
  const H = 130;
  const padL = 36;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const allYields = validPoints.map((p) => p.yield as number);
  const minYield = Math.floor(Math.min(...allYields) * 4) / 4 - 0.25;
  const maxYield = Math.ceil(Math.max(...allYields) * 4) / 4 + 0.25;
  const yRange = maxYield - minYield || 1;

  const maxYears = Math.max(...validPoints.map((p) => p.years));
  const xScale = (years: number) => padL + (years / Math.max(maxYears, 30)) * plotW;
  const yScale = (y: number) => padT + plotH - ((y - minYield) / yRange) * plotH;

  // Grid lines
  const yTicks: number[] = [];
  const step = yRange > 3 ? 1 : 0.5;
  for (let t = Math.ceil(minYield / step) * step; t <= maxYield; t += step) {
    yTicks.push(Math.round(t * 100) / 100);
  }

  const polyline = validPoints.map((p) => `${xScale(p.years)},${yScale(p.yield!)}`).join(' ');

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {/* Background */}
      <rect x={0} y={0} width={W} height={H} fill="rgba(0,0,0,0.3)" />

      {/* Y grid lines */}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={yScale(t)} x2={W - padR} y2={yScale(t)} stroke="rgba(255,200,50,0.08)" strokeWidth={0.5} />
          <text x={padL - 4} y={yScale(t) + 3} fill="var(--amber-dim)" fontSize={8} textAnchor="end" fontFamily="inherit">
            {t.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X labels */}
      {validPoints.map((p) => (
        <text key={p.maturity} x={xScale(p.years)} y={H - 4} fill="var(--amber-dim)" fontSize={8} textAnchor="middle" fontFamily="inherit">
          {p.maturity}
        </text>
      ))}

      {/* Curve line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--amber)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {validPoints.map((p) => (
        <circle
          key={p.maturity}
          cx={xScale(p.years)}
          cy={yScale(p.yield!)}
          r={4}
          fill="var(--amber)"
          stroke="var(--amber-bright)"
          strokeWidth={0.5}
          style={{ cursor: p.symbol ? 'pointer' : 'default' }}
          onClick={() => p.symbol && onSelectMaturity(p.maturity)}
        >
          <title>{`${p.label}: ${fmtYield(p.yield)}%`}</title>
        </circle>
      ))}

      {/* Axis labels */}
      <text x={W / 2} y={H - 0} fill="var(--amber-dim)" fontSize={7} textAnchor="middle" fontFamily="inherit">MATURITY</text>
      <text x={4} y={H / 2} fill="var(--amber-dim)" fontSize={7} textAnchor="middle" fontFamily="inherit" transform={`rotate(-90,4,${H / 2})`}>YIELD %</text>
    </svg>
  );
}

// Historical line chart
function HistoryChart({ data, maturity, onClose }: { data: HistoryData; maturity: string; onClose: () => void }) {
  if (!data.data.length) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--amber-dim)', fontSize: 11 }}>NO HISTORY DATA</span>
        <button onClick={onClose} style={{ marginTop: 6, fontSize: 10, color: 'var(--amber)', background: 'transparent', border: '1px solid var(--amber-dim)', cursor: 'pointer', padding: '2px 10px', fontFamily: 'inherit' }}>
          BACK
        </button>
      </div>
    );
  }

  const W = 320;
  const H = 120;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const vals = data.data.map((d) => d.value);
  const minV = Math.min(...vals) - 0.1;
  const maxV = Math.max(...vals) + 0.1;
  const vRange = maxV - minV || 1;

  const tMin = data.data[0].time;
  const tMax = data.data[data.data.length - 1].time;
  const tRange = tMax - tMin || 1;

  const xScale = (t: number) => padL + ((t - tMin) / tRange) * plotW;
  const yScale = (v: number) => padT + plotH - ((v - minV) / vRange) * plotH;

  const points = data.data.map((d) => `${xScale(d.time)},${yScale(d.value)}`).join(' ');

  // Y ticks
  const yTicks: number[] = [];
  const step = vRange > 2 ? 1 : 0.5;
  for (let t = Math.ceil(minV / step) * step; t <= maxV; t += step) {
    yTicks.push(Math.round(t * 100) / 100);
  }

  // X date labels (pick 4-5 spread across)
  const xLabelCount = 4;
  const xLabels: Array<{ time: number; label: string }> = [];
  for (let i = 0; i < xLabelCount; i++) {
    const idx = Math.floor((i / (xLabelCount - 1)) * (data.data.length - 1));
    const d = data.data[idx];
    const dt = new Date(d.time);
    xLabels.push({ time: d.time, label: `${dt.getMonth() + 1}/${dt.getDate()}` });
  }

  const lastVal = data.data[data.data.length - 1].value;
  const firstVal = data.data[0].value;
  const chg = lastVal - firstVal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: W, padding: '2px 0' }}>
        <span style={{ fontSize: 10, color: 'var(--amber-bright)', fontWeight: 700 }}>{maturity} YIELD - 1Y</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--amber)' }}>{fmtYield(lastVal)}%</span>
          <span style={{ fontSize: 10, color: chg >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtChange(chg)}</span>
          <button onClick={onClose} style={{ fontSize: 9, color: 'var(--amber-dim)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
            BACK
          </button>
        </div>
      </div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <rect x={0} y={0} width={W} height={H} fill="rgba(0,0,0,0.3)" />

        {/* Y grid */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={yScale(t)} x2={W - padR} y2={yScale(t)} stroke="rgba(255,200,50,0.08)" strokeWidth={0.5} />
            <text x={padL - 4} y={yScale(t) + 3} fill="var(--amber-dim)" fontSize={8} textAnchor="end" fontFamily="inherit">{t.toFixed(1)}</text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map((xl) => (
          <text key={xl.time} x={xScale(xl.time)} y={H - 6} fill="var(--amber-dim)" fontSize={7} textAnchor="middle" fontFamily="inherit">{xl.label}</text>
        ))}

        {/* Area fill */}
        <polygon
          points={`${xScale(data.data[0].time)},${yScale(data.data[0].value)} ${points} ${xScale(data.data[data.data.length - 1].time)},${padT + plotH} ${xScale(data.data[0].time)},${padT + plotH}`}
          fill="rgba(255,200,50,0.06)"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--amber)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />

        {/* Last point */}
        <circle cx={xScale(data.data[data.data.length - 1].time)} cy={yScale(lastVal)} r={3} fill="var(--amber-bright)" />
      </svg>
    </div>
  );
}

export default function BondYieldsPanel({ panelId }: { panelId?: string }) {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMaturity, setSelectedMaturity] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchTreasury = useCallback(async () => {
    try {
      const res = await fetch('/api/yfin/treasury');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TreasuryData = await res.json();
      if (mounted.current) {
        setData(json);
        setError(null);
        setLoading(false);
      }
    } catch (e) {
      if (mounted.current) {
        setError(String(e));
        setLoading(false);
      }
    }
  }, []);

  const fetchHistory = useCallback(async (maturity: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/yfin/treasury-history/${encodeURIComponent(maturity)}?range=1y&interval=1d`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: HistoryData = await res.json();
      if (mounted.current) {
        setHistory(json);
        setHistoryLoading(false);
      }
    } catch (e) {
      if (mounted.current) {
        setHistoryError(String(e));
        setHistoryLoading(false);
      }
    }
  }, []);

  // Fetch on mount + interval
  useEffect(() => {
    fetchTreasury();
    const id = setInterval(fetchTreasury, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchTreasury]);

  // Fetch history when a maturity is selected
  useEffect(() => {
    if (selectedMaturity) {
      fetchHistory(selectedMaturity);
    } else {
      setHistory(null);
      setHistoryError(null);
    }
  }, [selectedMaturity, fetchHistory]);

  const handleSelectMaturity = (maturity: string) => {
    if (selectedMaturity === maturity) {
      setSelectedMaturity(null);
    } else {
      setSelectedMaturity(maturity);
    }
  };

  const handleBackFromHistory = () => {
    setSelectedMaturity(null);
    setHistory(null);
    setHistoryError(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--amber-dim)' }}>LOADING YIELD DATA...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--red)' }}>ERR: {error}</span>
      </div>
    );
  }

  const curve = data?.curve ?? [];
  const spreads = data?.spreads ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--amber-bright)', fontWeight: 700, letterSpacing: '0.05em' }}>
          US TREASURY YIELDS
        </span>
        <span style={{ fontSize: 9, color: 'var(--amber-dim)' }}>
          YCRV
        </span>
      </div>

      {/* Error bar */}
      {error && (
        <div style={{ padding: '2px 8px', fontSize: 10, color: 'var(--red)', background: 'rgba(255,50,50,0.05)' }}>
          ERR: {error}
        </div>
      )}

      {/* Yield Curve Chart or History Chart */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
        {selectedMaturity ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {historyLoading && (
              <span style={{ fontSize: 11, color: 'var(--amber-dim)', padding: 20 }}>LOADING HISTORY...</span>
            )}
            {historyError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--red)' }}>ERR: {historyError}</span>
                <button onClick={handleBackFromHistory} style={{ fontSize: 10, color: 'var(--amber)', background: 'transparent', border: '1px solid var(--amber-dim)', cursor: 'pointer', padding: '2px 10px', fontFamily: 'inherit' }}>
                  BACK
                </button>
              </div>
            )}
            {history && !historyLoading && !historyError && (
              <HistoryChart data={history} maturity={selectedMaturity} onClose={handleBackFromHistory} />
            )}
          </div>
        ) : (
          <YieldCurveSVG curve={curve} onSelectMaturity={handleSelectMaturity} />
        )}
      </div>

      {/* Yield table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr 64px 64px',
        padding: '3px 8px',
        fontSize: 9,
        color: 'var(--amber-dim)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span>MAT</span>
        <span />
        <span style={{ textAlign: 'right' }}>YIELD</span>
        <span style={{ textAlign: 'right' }}>CHG</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {curve.map((p) => {
          const isUp = (p.change ?? 0) >= 0;
          const chgColor = p.change == null ? 'var(--amber-dim)' : isUp ? 'var(--green)' : 'var(--red)';
          const isSelected = selectedMaturity === p.maturity;
          const isInterp = !p.symbol;

          return (
            <div
              key={p.maturity}
              onClick={() => p.symbol && handleSelectMaturity(p.maturity)}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 64px 64px',
                padding: '2px 8px',
                fontSize: 12,
                color: isInterp ? 'var(--amber-dim)' : 'var(--amber)',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                cursor: p.symbol ? 'pointer' : 'default',
                background: isSelected ? 'rgba(255,200,50,0.08)' : 'transparent',
              }}
            >
              <span style={{ fontWeight: 700, color: isSelected ? 'var(--amber-bright)' : 'var(--amber)' }}>
                {p.maturity}
              </span>
              <span style={{ fontSize: 9, color: 'var(--amber-dim)', alignSelf: 'center' }}>
                {isInterp ? 'interp' : ''}
              </span>
              <span style={{ textAlign: 'right' }}>
                {fmtYield(p.yield)}
              </span>
              <span style={{ textAlign: 'right', color: chgColor }}>
                {fmtChange(p.change)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Spreads */}
      <div style={{
        padding: '4px 8px',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 9, color: 'var(--amber-dim)', marginBottom: 2, letterSpacing: '0.05em' }}>
          KEY SPREADS
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {spreads.map((s) => (
            <div key={s.name} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{ fontSize: 9, color: 'var(--amber-dim)' }}>{s.name}:</span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: s.value == null ? 'var(--amber-dim)' : s.inverted ? 'var(--red)' : 'var(--green)',
              }}>
                {fmtBps(s.value)}
              </span>
            </div>
          ))}
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
        <span>{data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString() : '---'}</span>
        <span>REFRESH 60s | CLICK MATURITY FOR HISTORY</span>
      </div>
    </div>
  );
}
