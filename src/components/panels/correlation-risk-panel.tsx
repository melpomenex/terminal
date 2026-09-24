'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import {
  correlationMatrix,
  annualizedVolatility,
  sharpeRatio,
  beta,
  maxDrawdown,
  valueAtRisk,
  rollingVolatility,
  dailyReturns,
} from '@/lib/risk-math';

/* ── Types ─────────────────────────────────────────── */

interface SymbolData {
  symbol: string;
  closes: number[];
}

interface RiskRow {
  symbol: string;
  vol: number;
  sharpe: number;
  betaVal: number;
  maxDD: number;
  var95: number;
}

/* ── Helpers ───────────────────────────────────────── */

function fmt2(v: number): string { return v.toFixed(2); }
function fmtPct(v: number): string { return (v * 100).toFixed(2) + '%'; }

function corrColor(r: number): string {
  if (r >= 0.6) return 'rgba(0,140,255,0.7)';
  if (r >= 0.3) return 'rgba(0,140,255,0.4)';
  if (r >= 0) return 'rgba(0,140,255,0.15)';
  if (r >= -0.3) return 'rgba(255,60,0,0.15)';
  if (r >= -0.6) return 'rgba(255,60,0,0.4)';
  return 'rgba(255,60,0,0.7)';
}

/* ── Component ─────────────────────────────────────── */

export default function CorrelationRiskPanel({ panelId }: { panelId?: string }) {
  const { watchlist, portfolioPositions, symbol } = useTerminalContext();
  const [symbolData, setSymbolData] = useState<SymbolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [showCorrelation, setShowCorrelation] = useState(true);
  const mounted = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /* Collect symbols from the watchlist (limit to 12 for performance) */
  const symbols = useMemo(() => {
    const syms = watchlist.map((w) => w.symbol).slice(0, 12);
    if (!syms.includes('SPY')) syms.push('SPY');
    return syms;
  }, [watchlist]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const res = await fetch(`/api/yfin/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`);
            const data = await res.json();
            const closes: number[] = (data.close ?? []).filter((v: number) => v > 0);
            return { symbol: sym, closes };
          } catch {
            return { symbol: sym, closes: [] };
          }
        }),
      );
      if (mounted.current) setSymbolData(results.filter((d) => d.closes.length > 30));
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [symbols]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived data ─────────────────────────────── */

  const returnsMatrix = useMemo(
    () => symbolData.map((d) => dailyReturns(d.closes)),
    [symbolData],
  );

  const corrMatrix = useMemo(
    () => returnsMatrix.length >= 2 ? correlationMatrix(returnsMatrix) : [],
    [returnsMatrix],
  );

  const spyIdx = symbolData.findIndex((d) => d.symbol === 'SPY');
  const spyReturns = spyIdx >= 0 ? returnsMatrix[spyIdx] : [];

  const riskRows: RiskRow[] = useMemo(() => {
    return symbolData.map((d, i) => {
      const ret = returnsMatrix[i];
      const spyRet = spyReturns.length > 0 ? spyReturns : ret;
      return {
        symbol: d.symbol,
        vol: annualizedVolatility(ret),
        sharpe: sharpeRatio(ret),
        betaVal: spyReturns.length > 0 ? beta(ret, spyReturns) : 0,
        maxDD: maxDrawdown(d.closes),
        var95: valueAtRisk(ret, 0.95),
      };
    });
  }, [symbolData, returnsMatrix, spyReturns]);

  /* ── Rolling vol chart for selected symbol ────── */

  const selectedIdx = selectedSymbol ? symbolData.findIndex((d) => d.symbol === selectedSymbol) : -1;
  const rollingVol = selectedIdx >= 0 ? rollingVolatility(symbolData[selectedIdx].closes, 30) : [];

  /* ── Portfolio analytics ──────────────────────── */

  const portfolioAnalytics = useMemo(() => {
    const positions = portfolioPositions.filter((p) =>
      symbolData.some((d) => d.symbol === p.symbol),
    );
    if (positions.length < 2) return null;

    const totalValue = positions.reduce((s, p) => {
      const d = symbolData.find((sd) => sd.symbol === p.symbol);
      const lastPrice = d ? d.closes[d.closes.length - 1] : p.costBasis;
      return s + p.quantity * lastPrice;
    }, 0);
    if (totalValue === 0) return null;

    const weights = positions.map((p) => {
      const d = symbolData.find((sd) => sd.symbol === p.symbol);
      const lastPrice = d ? d.closes[d.closes.length - 1] : p.costBasis;
      return (p.quantity * lastPrice) / totalValue;
    });

    const positionReturns = positions.map((p) => {
      const idx2 = symbolData.findIndex((d) => d.symbol === p.symbol);
      return idx2 >= 0 ? returnsMatrix[idx2] : [];
    });

    /* Weighted expected return */
    const expReturn = weights.reduce((s, w, i) => {
      const mean = positionReturns[i].length > 0
        ? positionReturns[i].reduce((a, v) => a + v, 0) / positionReturns[i].length
        : 0;
      return s + w * mean;
    }, 0) * 252;

    /* Portfolio vol */
    const n = Math.min(...positionReturns.map((r) => r.length));
    if (n < 2) return null;
    const portVar = weights.reduce((s, w, i) => {
      const ri = positionReturns[i].slice(0, n);
      const mean = ri.reduce((a, v) => a + v, 0) / n;
      return s + w * w * ri.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    }, 0);
    const portVol = Math.sqrt(portVar * 252);

    /* Diversification score: average pairwise correlation inverted to 0-100 */
    const posSymbols = positions.map((p) => p.symbol);
    const posIndices = posSymbols.map((s) => symbolData.findIndex((d) => d.symbol === s)).filter((i) => i >= 0);
    let corrSum = 0;
    let corrCount = 0;
    for (let i = 0; i < posIndices.length; i++) {
      for (let j = i + 1; j < posIndices.length; j++) {
        corrSum += Math.abs(corrMatrix[posIndices[i]]?.[posIndices[j]] ?? 0);
        corrCount++;
      }
    }
    const avgCorr = corrCount > 0 ? corrSum / corrCount : 0;
    const diversScore = Math.max(0, Math.min(100, ((1 - avgCorr) * 100)));

    return {
      expReturn,
      portVol,
      portSharpe: portVol > 0 ? expReturn / portVol : 0,
      diversScore,
    };
  }, [portfolioPositions, symbolData, returnsMatrix, corrMatrix]);

  /* ── Render ───────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ padding: 8, color: 'var(--amber-dim)', fontFamily: 'var(--font)', fontSize: 12 }}>
        LOADING RISK ANALYSIS...
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

  const cellSize = Math.max(28, Math.min(48, 380 / (symbolData.length || 1)));
  const n = symbolData.length;

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
          CORRELATION &amp; RISK
        </span>
        <button
          onClick={() => setShowCorrelation(!showCorrelation)}
          style={{
            fontSize: 9,
            color: 'var(--amber)',
            background: 'transparent',
            border: '1px solid var(--amber-dim)',
            cursor: 'pointer',
            padding: '1px 6px',
            fontFamily: 'inherit',
          }}
        >
          {showCorrelation ? 'RISK TABLE' : 'HEATMAP'}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* ── Correlation heatmap ─────────────── */}
        {showCorrelation && n >= 2 && (
          <div style={{ padding: '8px 8px 4px' }}>
            <div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 4, fontWeight: 700 }}>
              CORRELATION MATRIX
            </div>
            <div style={{ minHeight: 0 }}>
              <svg
                width={(n + 1) * cellSize + 4}
                height={(n + 1) * cellSize + 4}
                style={{ display: 'block' }}
              >
                {/* Header row */}
                {symbolData.map((d, j) => (
                  <text
                    key={`h-${d.symbol}`}
                    x={(j + 1) * cellSize + cellSize / 2}
                    y={cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--amber-dim)"
                    fontSize={Math.min(9, cellSize * 0.3)}
                    fontWeight={700}
                  >
                    {d.symbol.length > 5 ? d.symbol.slice(0, 5) : d.symbol}
                  </text>
                ))}
                {/* Rows */}
                {symbolData.map((d, i) => (
                  <g key={`row-${d.symbol}`}>
                    {/* Row label */}
                    <text
                      x={cellSize / 2}
                      y={(i + 1) * cellSize + cellSize / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="var(--amber-dim)"
                      fontSize={Math.min(9, cellSize * 0.3)}
                      fontWeight={700}
                    >
                      {d.symbol.length > 5 ? d.symbol.slice(0, 5) : d.symbol}
                    </text>
                    {/* Cells */}
                    {symbolData.map((_, j) => {
                      const r = corrMatrix[i]?.[j] ?? 0;
                      return (
                        <g key={`c-${i}-${j}`}>
                          <rect
                            x={(j + 1) * cellSize + 1}
                            y={(i + 1) * cellSize + 1}
                            width={cellSize - 2}
                            height={cellSize - 2}
                            fill={corrColor(r)}
                            rx={2}
                          />
                          <text
                            x={(j + 1) * cellSize + cellSize / 2}
                            y={(i + 1) * cellSize + cellSize / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="var(--amber)"
                            fontSize={Math.min(9, cellSize * 0.32)}
                          >
                            {r.toFixed(2)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                ))}
              </svg>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, color: 'var(--amber-dim)' }}>
              <span><span style={{ color: 'rgba(255,60,0,0.7)' }}>-1.0</span> NEG</span>
              <span><span style={{ color: 'rgba(255,60,0,0.15)' }}> 0.0</span> NEUTRAL</span>
              <span><span style={{ color: 'rgba(0,140,255,0.7)' }}>+1.0</span> POS</span>
            </div>
          </div>
        )}

        {/* ── Risk metrics table ──────────────── */}
        {!showCorrelation && (
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 4, fontWeight: 700 }}>
              RISK METRICS
            </div>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '56px 1fr 1fr 1fr 1fr 1fr',
              padding: '3px 0',
              fontSize: 9,
              color: 'var(--amber-dim)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>SYM</span>
              <span style={{ textAlign: 'right' }}>VOL</span>
              <span style={{ textAlign: 'right' }}>SHARPE</span>
              <span style={{ textAlign: 'right' }}>BETA</span>
              <span style={{ textAlign: 'right' }}>MAX DD</span>
              <span style={{ textAlign: 'right' }}>VaR95</span>
            </div>
            {riskRows.map((row) => {
              const isSelected = selectedSymbol === row.symbol;
              return (
                <div
                  key={row.symbol}
                  onClick={() => setSelectedSymbol(isSelected ? null : row.symbol)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px 1fr 1fr 1fr 1fr 1fr',
                    padding: '2px 0',
                    fontSize: 11,
                    color: isSelected ? 'var(--amber-bright)' : 'var(--amber)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(255,176,0,0.06)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{row.symbol}</span>
                  <span style={{ textAlign: 'right' }}>{fmtPct(row.vol)}</span>
                  <span style={{ textAlign: 'right', color: row.sharpe > 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt2(row.sharpe)}
                  </span>
                  <span style={{ textAlign: 'right' }}>{fmt2(row.betaVal)}</span>
                  <span style={{ textAlign: 'right', color: 'var(--red)' }}>{fmtPct(row.maxDD)}</span>
                  <span style={{ textAlign: 'right', color: 'var(--red)' }}>{fmtPct(row.var95)}</span>
                </div>
              );
            })}

            {/* Rolling volatility chart for selected symbol */}
            {selectedSymbol && rollingVol.length > 1 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 4, fontWeight: 700 }}>
                  30-DAY ROLLING VOL: {selectedSymbol}
                </div>
                <RollingVolChart data={rollingVol} width={360} height={80} />
              </div>
            )}
          </div>
        )}

        {/* ── Portfolio analytics ─────────────── */}
        {portfolioAnalytics && (
          <div style={{ padding: '8px 8px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 4, fontWeight: 700 }}>
              PORTFOLIO ANALYTICS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11 }}>
              <span style={{ color: 'var(--amber-dim)' }}>Exp. Return</span>
              <span style={{ textAlign: 'right', color: portfolioAnalytics.expReturn > 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmtPct(portfolioAnalytics.expReturn)}
              </span>
              <span style={{ color: 'var(--amber-dim)' }}>Portfolio Vol</span>
              <span style={{ textAlign: 'right' }}>{fmtPct(portfolioAnalytics.portVol)}</span>
              <span style={{ color: 'var(--amber-dim)' }}>Portfolio Sharpe</span>
              <span style={{ textAlign: 'right', color: portfolioAnalytics.portSharpe > 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt2(portfolioAnalytics.portSharpe)}
              </span>
              <span style={{ color: 'var(--amber-dim)' }}>Diversification</span>
              <span style={{ textAlign: 'right', color: portfolioAnalytics.diversScore > 60 ? 'var(--green)' : portfolioAnalytics.diversScore > 30 ? 'var(--amber)' : 'var(--red)' }}>
                {fmt2(portfolioAnalytics.diversScore)}%
              </span>
            </div>
          </div>
        )}
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
        <span>{symbolData.length} SYMBOLS</span>
        <span>{showCorrelation ? 'SWITCH TO RISK TABLE' : 'SWITCH TO HEATMAP'}</span>
      </div>
    </div>
  );
}

/* ── Rolling volatility mini chart ───────────────── */

function RollingVolChart({ data, width, height }: { data: number[]; width: number; height: number }) {
  const max = Math.max(...data, 0.01);
  const min = Math.min(...data, 0);
  const range = max - min || 0.01;
  const padY = 4;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padY + ((max - v) / range) * (height - padY * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="rgba(255,255,255,0.02)" rx={2} />
      <polyline
        points={points}
        fill="none"
        stroke="var(--amber)"
        strokeWidth={1.5}
      />
      {/* Y axis labels */}
      <text x={2} y={10} fontSize={8} fill="var(--amber-dim)">{fmtPct(max)}</text>
      <text x={2} y={height - 2} fontSize={8} fill="var(--amber-dim)">{fmtPct(min)}</text>
    </svg>
  );
}
