'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData } from '@/lib/types';
import { useTerminalContext, type ChartType } from '@/context/terminal-context';
import { sma, ema, rsi, macd, bollingerBands, vwap, volumeProfile, findSupportResistance, stochastic } from '@/lib/indicators';
import HistoricalDataTable from './historical-data-table';

const COMPARISON_COLORS = ['#00b050', '#4488ff', '#ff88ff', '#88ffff', '#ffff00'];
const MAIN_COMPARISON_COLOR = '#FFB000';

const INDICATOR_KEYS = ['sma-20', 'ema-12', 'rsi-14', 'macd', 'bb-20', 'vwap', 'stoch', 'sr'] as const;
type IndicatorKey = (typeof INDICATOR_KEYS)[number];

const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  'sma-20': 'SMA',
  'ema-12': 'EMA',
  'rsi-14': 'RSI',
  'macd': 'MACD',
  'bb-20': 'BB',
  'vwap': 'VWAP',
  'stoch': 'STOCH',
  'sr': 'S/R',
};

const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  'sma-20': '#00ffff',
  'ema-12': '#ff00ff',
  'rsi-14': '#FFD700',
  'macd': '#FFB000',
  'bb-20': '#FFB000',
  'vwap': '#ff8c00',
  'stoch': '#00ff88',
  'sr': '#ff4444',
};

function toggleSet(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Build an SVG path d-string from parallel x/y data arrays, skipping nulls. */
function buildPath(
  xs: number[],
  ys: (number | null)[],
  yScale: (val: number) => number,
): string {
  const parts: string[] = [];
  let started = false;
  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    if (y == null || !Number.isFinite(y)) { started = false; continue; }
    const px = xs[i];
    const py = yScale(y);
    parts.push(started ? `L ${px.toFixed(1)} ${py.toFixed(1)}` : `M ${px.toFixed(1)} ${py.toFixed(1)}`);
    started = true;
  }
  return parts.join(' ');
}

/** Build a polygon d-string for filled area between two y-series. */
function buildBand(
  xs: number[],
  upper: (number | null)[],
  lower: (number | null)[],
  yScale: (val: number) => number,
): string {
  const upperPts: string[] = [];
  const lowerPts: string[] = [];
  let anyValid = false;

  for (let i = 0; i < upper.length; i++) {
    const u = upper[i];
    const l = lower[i];
    if (u != null && Number.isFinite(u) && l != null && Number.isFinite(l)) {
      const px = xs[i];
      upperPts.push(`${px.toFixed(1)},${yScale(u).toFixed(1)}`);
      lowerPts.unshift(`${px.toFixed(1)},${yScale(l).toFixed(1)}`);
      anyValid = true;
    }
  }

  if (!anyValid) return '';
  return `M ${upperPts.join(' L ')} L ${lowerPts.join(' L ')} Z`;
}

export default function ChartPanel({ panelId }: { panelId?: string }) {
  const { chart, chartRange, setChartRange, chartType, setChartType, loading, comparisonSymbols, watchlist } = useTerminalContext();
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [comparisonData, setComparisonData] = useState<Map<string, ChartData>>(new Map());
  const [enabledIndicators, setEnabledIndicators] = useState<Set<string>>(new Set());
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 600, H = 240;
  const pad = { top: 12, right: 58, bottom: 22, left: 8 };
  const cw = W - pad.left - pad.right;
  const ranges = ['1D', '5D', '1M', '3M', '6M', '1Y'];
  const types: ChartType[] = ['candle', 'line', 'area'];

  // All hooks must be called unconditionally (Rules of Hooks)
  const data = chart;
  const timestamps = data?.timestamps ?? [];
  const open = data?.open ?? [];
  const high = data?.high ?? [];
  const low = data?.low ?? [];
  const close = data?.close ?? [];
  const volume = data?.volume ?? [];
  const isComparison = comparisonSymbols.length > 0;

  // Indicator flags (computed before early returns, all hooks above)
  const hasRSI = enabledIndicators.has('rsi-14');
  const hasMACD = enabledIndicators.has('macd');
  const hasIndicatorsOnMain = enabledIndicators.has('sma-20') || enabledIndicators.has('ema-12') || enabledIndicators.has('bb-20');

  // Sub-pane layout: only when not in comparison mode (comparison mode uses full area for % chart)
  const subPaneCount = (!isComparison && hasRSI ? 1 : 0) + (!isComparison && hasMACD ? 1 : 0);
  const subPaneH = subPaneCount > 0 ? (H - pad.top - pad.bottom) * 0.22 / subPaneCount : 0;
  const mainH = (H - pad.top - pad.bottom) - subPaneH;
  const ch = mainH;
  const rsiTop = pad.top + mainH;
  const rsiH = (!isComparison && hasRSI) ? subPaneH : 0;
  const macdTop = (!isComparison && hasRSI) ? rsiTop + rsiH : pad.top + mainH;
  const macdH = (!isComparison && hasMACD) ? subPaneH : 0;

  // Fetch comparison chart data when symbols or range changes
  useEffect(() => {
    if (comparisonSymbols.length === 0) {
      setComparisonData(new Map());
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const fetchAll = async () => {
      const results = new Map<string, ChartData>();
      await Promise.all(
        comparisonSymbols.map(async (sym) => {
          try {
            const res = await fetch(`/api/yfin/chart/${sym}?range=${chartRange}&interval=1d`, { signal });
            if (!res.ok) return;
            const d: ChartData = await res.json();
            results.set(sym, d);
          } catch {
            // aborted or network error
          }
        }),
      );
      if (!signal.aborted) setComparisonData(results);
    };
    fetchAll();
    return () => controller.abort();
  }, [comparisonSymbols, chartRange]);

  // Normalize all close series to percentage change from first valid point
  const normalized = useMemo(() => {
    if (!isComparison || !data) return null;
    const mainClose = close;
    const mainBase = mainClose.find((v): v is number => v != null && Number.isFinite(v));
    if (mainBase == null) return null;
    const series: { symbol: string; color: string; values: (number | null)[] }[] = [
      { symbol: data.symbol, color: MAIN_COMPARISON_COLOR, values: mainClose.map((v) => (v == null || !Number.isFinite(v) ? null : ((v - mainBase) / mainBase) * 100)) },
    ];
    comparisonSymbols.forEach((sym, idx) => {
      const cd = comparisonData.get(sym);
      if (!cd) return;
      const base = cd.close.find((v): v is number => v != null && Number.isFinite(v));
      if (base == null) return;
      series.push({
        symbol: sym,
        color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
        values: cd.close.map((v) => (v == null || !Number.isFinite(v) ? null : ((v - base) / base) * 100)),
      });
    });
    return series;
  }, [isComparison, data, close, comparisonSymbols, comparisonData]);

  // Compute Y-axis scale: absolute price or normalized percentage
  const { minVal, maxVal, rangeVal } = useMemo(() => {
    if (isComparison && normalized) {
      let mn = Infinity, mx = -Infinity;
      for (const s of normalized) {
        for (const v of s.values) {
          if (v != null && Number.isFinite(v)) {
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
        }
      }
      if (!isFinite(mn)) { mn = -1; mx = 1; }
      const r = mx - mn || 1;
      return { minVal: mn - r * 0.05, maxVal: mx + r * 0.05, rangeVal: (mx + r * 0.05) - (mn - r * 0.05) };
    }
    const allVals = [...high, ...low].filter((v): v is number => v != null && Number.isFinite(v));
    const mn = allVals.length ? Math.min(...allVals) : 0;
    const mx = allVals.length ? Math.max(...allVals) : 1;
    const r = mx - mn || 1;
    return { minVal: mn, maxVal: mx, rangeVal: r };
  }, [isComparison, normalized, high, low]);

  const maxVol = Math.max(...volume.filter((v): v is number => v != null && Number.isFinite(v)), 1);
  const bw = timestamps.length ? Math.max(1.5, Math.min(6, (cw / timestamps.length) * 0.7)) : 3;
  const gap = timestamps.length ? (cw - bw * timestamps.length) / (timestamps.length + 1) : 0;
  const toY = (val: number) => pad.top + ch - ((val - minVal) / rangeVal) * ch;
  const toX = (i: number) => pad.left + gap * (i + 1) + bw * i;

  // Y-axis label formatter
  const formatYLabel = (val: number) => isComparison ? `${val >= 0 ? '+' : ''}${val.toFixed(2)}%` : val.toFixed(2);

  // RSI sub-pane Y mapper
  const rsiToY = (val: number) => rsiTop + rsiH - (val / 100) * rsiH;

  // MACD sub-pane Y mapper
  const macdValues = useMemo(() => {
    if (!hasMACD || isComparison || close.length === 0) return { min: -1, max: 1 };
    const m = macd(close);
    const vals = [
      ...m.macd.filter((v): v is number => v != null && Number.isFinite(v)),
      ...m.signal.filter((v): v is number => v != null && Number.isFinite(v)),
      ...m.histogram.filter((v): v is number => v != null && Number.isFinite(v)),
    ];
    if (vals.length === 0) return { min: -1, max: 1 };
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const rng = mx - mn || 1;
    return { min: mn - rng * 0.1, max: mx + rng * 0.1 };
  }, [hasMACD, isComparison, close]);

  const macdRange = macdValues.max - macdValues.min || 1;
  const macdToY = (val: number) => macdTop + macdH - ((val - macdValues.min) / macdRange) * macdH;
  const macdZeroY = macdToY(0);

  const smaData = useMemo(() => sma(close, 20), [close]);
  const emaData = useMemo(() => ema(close, 12), [close]);
  const rsiData = useMemo(() => rsi(close, 14), [close]);
  const macdData = useMemo(() => macd(close), [close]);
  const bbData = useMemo(() => bollingerBands(close, 20, 2), [close]);
  const vwapData = useMemo(() => vwap(high, low, close, volume), [high, low, close, volume]);
  const stochData = useMemo(() => stochastic(high, low, close, 14, 3), [high, low, close]);
  const srData = useMemo(() => findSupportResistance(high, low, close, 5), [high, low, close]);
  const volProfile = useMemo(() => volumeProfile(close, volume, 20), [close, volume]);

  // Pre-compute x positions array for path building
  const xPositions = useMemo(() => timestamps.map((_, i) => toX(i)), [timestamps]);

  // Build comparison X-to-timestamp mapping for each comparison series
  const comparisonPaths = useMemo(() => {
    if (!isComparison || !normalized || !data) return [];
    return normalized.map((s) => {
      const cd = s.symbol === data.symbol ? data : comparisonData.get(s.symbol);
      if (!cd) return null;
      const mainTs = timestamps;
      const compTs = cd.timestamps;
      const tsToIdx = new Map<number, number>();
      compTs.forEach((t, i) => tsToIdx.set(t, i));
      const points: { x: number; y: number | null }[] = [];
      mainTs.forEach((ts, mainI) => {
        const compI = tsToIdx.get(ts);
        if (compI !== undefined) {
          const normVal = normalized!.find((ns) => ns.symbol === s.symbol)?.values[compI] ?? null;
          points.push({ x: toX(mainI), y: normVal != null ? toY(normVal) : null });
        }
      });
      let d = '';
      let started = false;
      for (const p of points) {
        if (p.y == null || !Number.isFinite(p.y)) { started = false; continue; }
        if (!started) { d += `M${p.x.toFixed(1)},${p.y.toFixed(1)}`; started = true; }
        else { d += `L${p.x.toFixed(1)},${p.y.toFixed(1)}`; }
      }
      return { symbol: s.symbol, color: s.color, path: d };
    }).filter((p): p is { symbol: string; color: string; path: string } => p != null && p.path.length > 0);
  }, [isComparison, normalized, data, timestamps, comparisonData, toX, toY]);

  const hoverData = useMemo(() => {
    if (!hover || !timestamps.length || !data) return null;
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return null;
    const scaleX = W / svgRect.width;
    const mx = hover.x * scaleX;
    let nearest = 0;
    for (let i = 0; i < timestamps.length; i++) {
      if (Math.abs(toX(i) - mx) < Math.abs(toX(nearest) - mx)) nearest = i;
    }
    const c = close[nearest];
    const o = open[nearest];
    const h = high[nearest];
    const l = low[nearest];
    if (c == null || !Number.isFinite(c)) return null;
    const snapY = isComparison && normalized
      ? toY(normalized[0].values[nearest] ?? 0)
      : toY(c);
    const price = isComparison
      ? `${((normalized?.[0].values[nearest] ?? 0) >= 0 ? '+' : '')}${(normalized?.[0].values[nearest] ?? 0).toFixed(2)}%`
      : c.toFixed(2);
    const ohlc = (o != null && h != null && l != null)
      ? `O: ${o.toFixed(2)} H: ${h.toFixed(2)} L: ${l.toFixed(2)} C: ${c.toFixed(2)}`
      : `C: ${c.toFixed(2)}`;
    const ts = timestamps[nearest];
    return { x: toX(nearest) + bw / 2, y: snapY, price, date: new Date(ts * 1000).toLocaleDateString(), ohlc, vol: volume[nearest] };
  }, [hover, timestamps, high, low, open, close, volume, toX, toY, isComparison, normalized]);

  // Early returns after all hooks
  if (loading) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>LOADING...</div>;
  if (!data || !data.timestamps.length) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>NO DATA</div>;

  // In comparison mode, render line chart for main symbol too (using normalized values)
  const showCandles = chartType === 'candle' && !isComparison;
  const showMainLine = isComparison || chartType === 'line' || chartType === 'area';

  // Indicators are only overlaid in non-comparison mode
  const canShowIndicators = !isComparison;
  const liveQuote = watchlist.find((w) => w.symbol === data.symbol);
  const headerPrice = liveQuote?.price ?? data.price ?? 0;
  const headerChange = liveQuote?.change ?? (headerPrice - (liveQuote?.previousClose ?? data.previousClose ?? 0));
  const headerChangePct = liveQuote?.changePercent ?? ((liveQuote?.previousClose ?? data.previousClose ?? 0) > 0
    ? (headerChange / (liveQuote?.previousClose ?? data.previousClose ?? 1)) * 100
    : 0);
  const headerUp = headerChange >= 0;

  const handleToggle = (key: string) => {
    setEnabledIndicators((prev) => toggleSet(prev, key));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', borderBottom: '1px solid var(--border)', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{data.symbol}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: headerUp ? 'var(--amber-bright)' : 'var(--red)' }}>
          ${headerPrice.toFixed(2)}
        </span>
        <span style={{ fontSize: 11, color: headerUp ? 'var(--amber-bright)' : 'var(--red)' }}>
          {`${headerUp ? '+' : ''}${headerChange.toFixed(2)} (${headerUp ? '+' : ''}${headerChangePct.toFixed(2)}%)`}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Indicator toggle buttons */}
          {INDICATOR_KEYS.map((key) => {
            const active = enabledIndicators.has(key) && !isComparison;
            const color = active ? INDICATOR_COLORS[key] : 'var(--amber-dim)';
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                style={{
                  fontSize: 9, padding: '0 5px', height: 16,
                  background: active ? color : 'transparent',
                  color: active ? '#000' : color,
                  fontWeight: active ? 700 : 400,
                  border: active ? `1px solid ${color}` : '1px solid transparent',
                  opacity: active ? 1 : 0.5,
                }}
              >
                {INDICATOR_LABELS[key]}
              </button>
            );
          })}
          <span style={{ width: 6, borderLeft: '1px solid #332200', margin: '0 2px' }} />
          {types.map((t) => (
            <button key={t} onClick={() => setChartType(t)} style={{ fontSize: 10, padding: '0 6px', height: 16, background: t === chartType ? 'var(--amber-dim)' : 'transparent', color: t === chartType ? '#fff' : 'var(--amber-dim)' }}>
              {t === 'candle' ? 'CANDLE' : t.toUpperCase()}
            </button>
          ))}
          <span style={{ width: 4 }} />
          {ranges.map((r) => (
            <button key={r} onClick={() => setChartRange(r.toLowerCase())} style={{ fontSize: 10, padding: '0 6px', height: 16, background: r.toLowerCase() === chartRange ? 'var(--amber-dim)' : 'transparent', color: r.toLowerCase() === chartRange ? '#fff' : 'var(--amber-dim)' }}>
              {r}
            </button>
          ))}
          <span style={{ width: 6, borderLeft: '1px solid #332200', margin: '0 2px' }} />
          <button onClick={() => setShowTable((p) => !p)} style={{ fontSize: 10, padding: '0 6px', height: 16, background: showTable ? 'var(--amber-dim)' : 'transparent', color: showTable ? '#fff' : 'var(--amber-dim)' }}>
            TABLE
          </button>
        </div>
      </div>
      {showTable ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <HistoricalDataTable data={{ timestamps, open, high, low, close, volume }} />
        </div>
      ) : (
      <div style={{ flex: 1, padding: '0 4px', overflow: 'hidden' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseLeave={() => setHover(null)}
        >
          {/* ---- MAIN CHART GRID ---- */}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = pad.top + (ch / 4) * i;
            const val = maxVal - (rangeVal / 4) * i;
            return (<g key={`g-${i}`}><line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#1a1200" strokeWidth={0.5} /><text x={W - pad.right + 3} y={y + 3} fill="#664400" fontSize={8}>{formatYLabel(val)}</text></g>);
          })}

          {/* ---- VOLUME BARS ---- */}
          {!isComparison && timestamps.map((_, i) => {
            const vol = volume[i]; if (vol == null || !Number.isFinite(vol)) return null;
            const vh = (vol / (maxVol || 1)) * (ch * 0.15);
            const isUp = (close[i] ?? 0) >= (open[i] ?? 0);
            return <rect key={`v-${i}`} x={toX(i)} y={pad.top + ch - vh} width={bw} height={vh} fill={isUp ? '#FFB000' : '#FF4400'} opacity={0.1} />;
          })}

          {/* ---- CANDLESTICKS ---- */}
          {showCandles && timestamps.map((_, i) => {
            const o = open[i], h = high[i], l = low[i], c = close[i];
            if (o == null || h == null || l == null || c == null) return null;
            const isUp = c >= o;
            const color = isUp ? '#FFB000' : '#FF4400';
            const x = toX(i);
            return (<g key={`c-${i}`}><line x1={x + bw / 2} y1={toY(h)} x2={x + bw / 2} y2={toY(l)} stroke={color} strokeWidth={0.8} /><rect x={x} y={toY(Math.max(o, c))} width={bw} height={Math.abs(toY(o) - toY(c)) || 1} fill={color} stroke={color} strokeWidth={0.3} /></g>);
          })}

          {/* ---- LINE / AREA (non-comparison) ---- */}
          {showMainLine && !isComparison && (
            <path d={close.map((c, i) => c == null ? '' : `${i === 0 || close[i - 1] == null ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(c).toFixed(1)}`).filter(Boolean).join(' ')} fill="none" stroke="#FFB000" strokeWidth={1.2} />
          )}
          {showMainLine && !isComparison && chartType === 'area' && (
            <path d={close.map((c, i) => c == null ? '' : `${i === 0 || close[i - 1] == null ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(c).toFixed(1)}`).filter(Boolean).join(' ')} fill="url(#areaGradient)" opacity={0.15} />
          )}

          {/* ---- COMPARISON LINES ---- */}
          {isComparison && comparisonPaths.filter((p) => p.symbol === data.symbol).map((p) => (
            <path key={`cmp-main`} d={p.path} fill="none" stroke={p.color} strokeWidth={1.2} />
          ))}
          {isComparison && comparisonPaths.filter((p) => p.symbol !== data.symbol).map((p) => (
            <path key={`cmp-${p.symbol}`} d={p.path} fill="none" stroke={p.color} strokeWidth={1.0} strokeDasharray="4,2" />
          ))}

          {/* ============ INDICATOR OVERLAYS (non-comparison mode only) ============ */}

          {/* Bollinger Bands — filled polygon + upper/lower + middle SMA line */}
          {canShowIndicators && enabledIndicators.has('bb-20') && (
            <g>
              <path
                d={buildBand(xPositions, bbData.upper, bbData.lower, toY)}
                fill="#FFB000" opacity={0.08}
              />
              <path
                d={buildPath(xPositions, bbData.upper, toY)}
                fill="none" stroke="#FFB000" strokeWidth={0.5} opacity={0.25}
              />
              <path
                d={buildPath(xPositions, bbData.lower, toY)}
                fill="none" stroke="#FFB000" strokeWidth={0.5} opacity={0.25}
              />
              <path
                d={buildPath(xPositions, bbData.middle, toY)}
                fill="none" stroke="#FFB000" strokeWidth={0.7} opacity={0.35}
              />
            </g>
          )}

          {/* SMA overlay — cyan */}
          {canShowIndicators && enabledIndicators.has('sma-20') && (
            <path
              d={buildPath(xPositions, smaData, toY)}
              fill="none" stroke="#00ffff" strokeWidth={1}
            />
          )}

          {canShowIndicators && enabledIndicators.has('ema-12') && (
            <path d={buildPath(xPositions, emaData, toY)} fill="none" stroke="#ff00ff" strokeWidth={1} />
          )}
          {canShowIndicators && enabledIndicators.has('vwap') && (
            <path d={buildPath(xPositions, vwapData, toY)} fill="none" stroke="#ff8c00" strokeWidth={1.2} strokeDasharray="4,2" />
          )}
          {canShowIndicators && enabledIndicators.has('sr') && (
            <g>
              {srData.supports.map((s,i)=>{
                const y=toY(s);
                return <g key={`s-${i}`}><line x1={pad.left} y1={y} x2={W-pad.right} y2={y} stroke="#00ff88" strokeWidth={0.8} strokeDasharray="6,3" opacity={0.6} /><text x={pad.left+2} y={y-2} fill="#00ff88" fontSize={7}>SUP {s.toFixed(2)}</text></g>;
              })}
              {srData.resistances.map((r,i)=>{
                const y=toY(r);
                return <g key={`r-${i}`}><line x1={pad.left} y1={y} x2={W-pad.right} y2={y} stroke="#ff4444" strokeWidth={0.8} strokeDasharray="6,3" opacity={0.6} /><text x={pad.left+2} y={y-2} fill="#ff4444" fontSize={7}>RES {r.toFixed(2)}</text></g>;
              })}
            </g>
          )}
          {canShowIndicators && enabledIndicators.has('stoch') && (
            <g>
              <path d={buildPath(xPositions, stochData.k, toY)} fill="none" stroke="#00ff88" strokeWidth={0.8} opacity={0.7} />
              <path d={buildPath(xPositions, stochData.d, toY)} fill="none" stroke="#ffaa00" strokeWidth={0.8} opacity={0.7} />
            </g>
          )}
          {canShowIndicators && volProfile.length>0 && (
            <g>
              {volProfile.map((vp, i)=>{
                const y = toY(vp.price);
                const maxV = Math.max(...volProfile.map(v=>v.volume),1);
                const w = (vp.volume/maxV)*40;
                return <rect key={i} x={W-pad.right - w} y={y-2} width={w} height={3} fill="var(--accent)" opacity={0.15} />;
              })}
            </g>
          )}

          {/* ============ RSI SUB-PANE ============ */}
          {canShowIndicators && hasRSI && (
            <g>
              <line x1={pad.left} y1={rsiTop} x2={W - pad.right} y2={rsiTop} stroke="#1a1200" strokeWidth={0.5} />
              {/* Reference line at 30 (green dashed) */}
              <line x1={pad.left} y1={rsiToY(30)} x2={W - pad.right} y2={rsiToY(30)} stroke="#00aa00" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.6} />
              <text x={pad.left + 2} y={rsiToY(30) - 2} fill="#00aa00" fontSize={7} opacity={0.7}>30</text>
              {/* Reference line at 70 (red dashed) */}
              <line x1={pad.left} y1={rsiToY(70)} x2={W - pad.right} y2={rsiToY(70)} stroke="#ff3333" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.6} />
              <text x={pad.left + 2} y={rsiToY(70) - 2} fill="#ff3333" fontSize={7} opacity={0.7}>70</text>
              {/* Reference line at 50 */}
              <line x1={pad.left} y1={rsiToY(50)} x2={W - pad.right} y2={rsiToY(50)} stroke="#1a1200" strokeWidth={0.3} />
              <text x={W - pad.right + 3} y={rsiTop + 10} fill="#FFD700" fontSize={7} opacity={0.7}>RSI</text>
              {/* RSI line */}
              <path
                d={buildPath(xPositions, rsiData, rsiToY)}
                fill="none" stroke="#FFD700" strokeWidth={1}
              />
            </g>
          )}

          {/* ============ MACD SUB-PANE ============ */}
          {canShowIndicators && hasMACD && (
            <g>
              <line x1={pad.left} y1={macdTop} x2={W - pad.right} y2={macdTop} stroke="#1a1200" strokeWidth={0.5} />
              {/* Zero line */}
              <line x1={pad.left} y1={macdZeroY} x2={W - pad.right} y2={macdZeroY} stroke="#332200" strokeWidth={0.5} />
              <text x={W - pad.right + 3} y={macdTop + 10} fill="#FFB000" fontSize={7} opacity={0.7}>MACD</text>
              {/* Histogram bars */}
              {macdData.histogram.map((v, i) => {
                if (v == null || !Number.isFinite(v)) return null;
                const barH = Math.abs(macdToY(v) - macdZeroY);
                const isPositive = v >= 0;
                return (
                  <rect
                    key={`hist-${i}`}
                    x={toX(i)}
                    y={isPositive ? macdZeroY - barH : macdZeroY}
                    width={bw}
                    height={barH || 1}
                    fill={isPositive ? '#00aa00' : '#ff3333'}
                    opacity={0.5}
                  />
                );
              })}
              {/* MACD line */}
              <path
                d={buildPath(xPositions, macdData.macd, macdToY)}
                fill="none" stroke="#00ccff" strokeWidth={0.8}
              />
              {/* Signal line */}
              <path
                d={buildPath(xPositions, macdData.signal, macdToY)}
                fill="none" stroke="#ff6600" strokeWidth={0.8}
              />
            </g>
          )}

          <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFB000" stopOpacity={1} /><stop offset="100%" stopColor="#FFB000" stopOpacity={0} /></linearGradient></defs>

          {/* ---- COMPARISON LEGEND ---- */}
          {isComparison && (
            <g>
              {comparisonPaths.map((p, idx) => (
                <g key={`legend-${p.symbol}`}>
                  <line x1={pad.left + 4} y1={pad.top + 6 + idx * 10} x2={pad.left + 16} y2={pad.top + 6 + idx * 10} stroke={p.color} strokeWidth={1.5} strokeDasharray={p.symbol === data.symbol ? 'none' : '4,2'} />
                  <text x={pad.left + 20} y={pad.top + 9 + idx * 10} fill={p.color} fontSize={8}>{p.symbol}</text>
                </g>
              ))}
            </g>
          )}

          {/* ---- HOVER CROSSHAIR ---- */}
          {hoverData && (<g>
            <line x1={hoverData.x} y1={pad.top} x2={hoverData.x} y2={pad.top + ch} stroke="#332200" strokeWidth={0.5} strokeDasharray="2,2" />
            <line x1={pad.left} y1={hoverData.y} x2={W - pad.right} y2={hoverData.y} stroke="#332200" strokeWidth={0.5} strokeDasharray="2,2" />
            <rect x={W - pad.right + 1} y={hoverData.y - 7} width={pad.right - 2} height={14} fill="#0a0800" />
            <text x={W - pad.right + 3} y={hoverData.y + 4} fill="var(--amber-bright)" fontSize={9}>{hoverData.price}</text>
            {hoverData.ohlc && (
              <>
                <rect x={pad.left} y={H - pad.bottom + 2} width={cw} height={12} fill="#0a0800" opacity={0.9} />
                <text x={pad.left + 4} y={H - pad.bottom + 11} fill="var(--amber-dim)" fontSize={8}>{hoverData.date}  {hoverData.ohlc}</text>
              </>
            )}
          </g>)}
        </svg>
      </div>
      )}
    </div>
  );
}
