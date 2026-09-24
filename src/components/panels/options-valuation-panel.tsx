'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { blackScholesGreeks, impliedVolatility, bawPrice, yearsToExpiry } from '@/lib/math/options-pricing';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

/**
 * OVME — Options Valuation Model Evaluator. Interactive BSM/BAW pricing lab:
 * parameter sliders, market-price IV solver, Greek sensitivity grid, and a
 * P&L-at-expiration diagram with breakevens. All math from
 * `src/lib/math/options-pricing.ts`; results labeled DERIVED.
 */
export default function OptionsValuationPanel({ panelId }: { panelId?: string }) {
  const { symbol, chart, watchlist } = useTerminalContext();
  const spotMarket = chart?.price ?? watchlist.find((w) => w.symbol === symbol)?.price ?? null;

  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [volPct, setVolPct] = useState(30);
  const [ratePct, setRatePct] = useState(4.3);
  const [divPct, setDivPct] = useState(0);
  const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
  const [style, setStyle] = useState<'EUROPEAN' | 'AMERICAN'>('EUROPEAN');
  const [marketPrice, setMarketPrice] = useState<number | ''>('');
  const [position, setPosition] = useState<'LONG' | 'SHORT'>('LONG');

  // Adopt live spot when it arrives
  useEffect(() => {
    if (spotMarket != null && spotMarket > 0) {
      setSpot(Number(spotMarket.toFixed(2)));
      setStrike(Math.round(spotMarket));
    }
  }, [spotMarket, symbol]);

  const T = useMemo(() => yearsToExpiry(expiry), [expiry]);
  const input = useMemo(() => ({
    spot, strike, timeToExpiry: Math.max(T, 1 / 365),
    volatility: volPct / 100,
    riskFreeRate: ratePct / 100,
    dividendYield: divPct / 100,
    optionType,
  }), [spot, strike, T, volPct, ratePct, divPct, optionType]);

  const greeks = useMemo(() => blackScholesGreeks(input), [input]);
  const american = useMemo(() => (style === 'AMERICAN' ? bawPrice(input) : null), [style, input]);

  const solvedIv = useMemo(() => {
    if (marketPrice === '' || Number(marketPrice) <= 0) return null;
    return impliedVolatility({
      marketPrice: Number(marketPrice), spot, strike,
      timeToExpiry: Math.max(T, 1 / 365), riskFreeRate: ratePct / 100,
      dividendYield: divPct / 100, optionType,
    });
  }, [marketPrice, spot, strike, T, ratePct, divPct, optionType]);

  // Sensitivity grid: ±10% spot × ±5 vol points
  const sensitivity = useMemo(() => {
    const spots = [-0.1, -0.05, 0, 0.05, 0.1].map((d) => spot * (1 + d));
    const vols = [volPct - 5, volPct, volPct + 5];
    return { spots, vols, grid: vols.map((v) => spots.map((s) => blackScholesGreeks({ ...input, spot: s, volatility: v / 100 }).price)) };
  }, [spot, volPct, input]);

  // P&L at expiration
  const pnl = useMemo(() => {
    const premium = greeks.price;
    const points: Array<{ s: number; pnl: number }> = [];
    const lo = Math.min(spot, strike) * 0.7, hi = Math.max(spot, strike) * 1.3;
    for (let i = 0; i <= 60; i++) {
      const s = lo + ((hi - lo) * i) / 60;
      const intrinsic = optionType === 'CALL' ? Math.max(0, s - strike) : Math.max(0, strike - s);
      points.push({ s, pnl: (position === 'LONG' ? 1 : -1) * (intrinsic - premium) * 100 });
    }
    const be1 = optionType === 'CALL' ? strike + premium : strike - premium;
    return { points, breakeven: be1, premium, lo, hi };
  }, [spot, strike, optionType, position, greeks.price]);

  const provenance = useMemo(() => makeProvenance('Black-Scholes-Merton / BAW engine', 'DERIVED', 'USD'), []);

  const maxAbsPnl = Math.max(...pnl.points.map((p) => Math.abs(p.pnl)), 1);
  const zeroY = ((maxAbsPnl) / (2 * maxAbsPnl)) * 100;

  const slider = (label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, suffix = '') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 118 }}>
      <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{label} <b style={{ color: 'var(--text-bright)' }}>{value}{suffix}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: 'var(--accent)', height: 12 }} />
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raized)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>OVME · <span style={{ color: 'var(--accent)' }}>{symbol}</span> MODEL EVALUATOR</span>
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {/* Parameters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
        {slider('SPOT', spot, 1, Math.max(spot * 2, 1000), 0.5, setSpot)}
        {slider('STRIKE', strike, 1, Math.max(strike * 2, 1000), 0.5, setStrike)}
        {slider('VOL σ', volPct, 1, 200, 0.5, setVolPct, '%')}
        {slider('RATE r', ratePct, 0, 15, 0.1, setRatePct, '%')}
        {slider('DIV q', divPct, 0, 15, 0.1, setDivPct, '%')}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>EXPIRY (T = {T.toFixed(3)}Y)</span>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', color: 'var(--text-bright)', fontSize: 10, padding: '1px 4px', fontFamily: 'var(--font)' }} />
        </label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
          <button onClick={() => setOptionType('CALL')} style={{ fontSize: 9, padding: '2px 8px', border: `1px solid ${optionType === 'CALL' ? 'var(--positive)' : 'var(--border-soft)'}`, background: optionType === 'CALL' ? 'var(--positive-soft)' : 'transparent', color: optionType === 'CALL' ? 'var(--positive)' : 'var(--text-dim)', cursor: 'pointer', borderRadius: 2 }}>CALL</button>
          <button onClick={() => setOptionType('PUT')} style={{ fontSize: 9, padding: '2px 8px', border: `1px solid ${optionType === 'PUT' ? 'var(--negative)' : 'var(--border-soft)'}`, background: optionType === 'PUT' ? 'var(--negative-soft)' : 'transparent', color: optionType === 'PUT' ? 'var(--negative)' : 'var(--text-dim)', cursor: 'pointer', borderRadius: 2 }}>PUT</button>
          <button onClick={() => setStyle((s) => (s === 'EUROPEAN' ? 'AMERICAN' : 'EUROPEAN'))} style={{ fontSize: 9, padding: '2px 8px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', borderRadius: 2 }}>{style}</button>
          <button onClick={() => setPosition((p) => (p === 'LONG' ? 'SHORT' : 'LONG'))} style={{ fontSize: 9, padding: '2px 8px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', borderRadius: 2 }}>{position}</button>
        </div>
      </div>

      {/* Output: price + Greeks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border-soft)', flexShrink: 0 }}>
        {[
          { l: 'THEO PRICE', v: `$${(style === 'AMERICAN' && american != null ? american : greeks.price).toFixed(3)}` },
          { l: 'DELTA Δ', v: greeks.delta.toFixed(4) },
          { l: 'GAMMA Γ', v: greeks.gamma.toFixed(4) },
          { l: 'THETA Θ/day', v: greeks.thetaPerDay.toFixed(3) },
          { l: 'VEGA ν/1%', v: greeks.vegaPerPct.toFixed(3) },
          { l: 'RHO ρ', v: greeks.rho.toFixed(3) },
          { l: 'BREAKEVEN', v: `$${pnl.breakeven.toFixed(2)}` },
        ].map((m) => (
          <div key={m.l} style={{ background: 'var(--panel-bg)', padding: '5px 8px' }}>
            <div style={{ fontSize: 7.5, color: 'var(--text-dim)' }}>{m.l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-bright)', fontVariantNumeric: 'tabular-nums' }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* IV solver */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>MARKET PRICE</span>
        <input
          type="number" step="0.01" min="0"
          value={marketPrice}
          onChange={(e) => setMarketPrice(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="premium"
          style={{ width: 80, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 10, padding: '2px 6px', fontFamily: 'var(--font)', outline: 'none' }}
        />
        <span style={{ fontSize: 10, color: 'var(--accent)' }}>
          {marketPrice === '' ? '—' : solvedIv != null ? `IMPLIED VOL ${(solvedIv * 100).toFixed(2)}%` : 'NO IV SOLUTION (check premium vs intrinsic)'}
        </span>
        {solvedIv != null && (
          <button onClick={() => setVolPct(Number((solvedIv * 100).toFixed(1)))} style={{ fontSize: 8, padding: '1px 6px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 2, cursor: 'pointer' }}>APPLY σ</button>
        )}
      </div>

      {/* Sensitivity table */}
      <div style={{ padding: '6px 10px', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>SENSITIVITY — PRICE vs SPOT × VOL</div>
        <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ color: 'var(--text-dim)', fontSize: 8, padding: '1px 6px', textAlign: 'right' }}>σ \ S</th>
              {sensitivity.spots.map((s, i) => (
                <th key={i} style={{ color: 'var(--text-dim)', fontSize: 8, padding: '1px 6px', textAlign: 'right' }}>{(s / spot - 1) >= 0 ? '+' : ''}{((s / spot - 1) * 100).toFixed(0)}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensitivity.vols.map((v, vi) => (
              <tr key={v}>
                <td style={{ color: 'var(--text-dim)', fontSize: 8, padding: '1px 6px', textAlign: 'right' }}>{v.toFixed(0)}%</td>
                {sensitivity.grid[vi].map((p, si) => (
                  <td key={si} style={{ color: p > greeks.price ? 'var(--positive)' : p < greeks.price ? 'var(--negative)' : 'var(--text-bright)', padding: '1px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.toFixed(2)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* P&L at expiration */}
      <div style={{ padding: '6px 10px 10px', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>
          P&L AT EXPIRATION · {position} 1 CONTRACT (100×) · PREMIUM ${pnl.premium.toFixed(2)} · BE ${pnl.breakeven.toFixed(2)}
        </div>
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: 110, background: 'var(--surface-sunken)', borderRadius: 3 }}>
          {/* zero line */}
          <line x1={0} y1={zeroY} x2={300} y2={zeroY} stroke="var(--border-light)" strokeDasharray="3 3" strokeWidth={0.7} />
          {/* strike marker */}
          {(() => {
            const x = ((strike - pnl.lo) / (pnl.hi - pnl.lo)) * 300;
            return <line x1={x} y1={0} x2={x} y2={100} stroke="var(--accent)" strokeWidth={0.7} opacity={0.6} />;
          })()}
          {/* P&L polyline */}
          <polyline
            points={pnl.points.map((p) => `${((p.s - pnl.lo) / (pnl.hi - pnl.lo)) * 300},${100 - ((p.pnl + maxAbsPnl) / (2 * maxAbsPnl)) * 100}`).join(' ')}
            fill="none"
            stroke={position === 'LONG' ? 'var(--positive)' : 'var(--negative)'}
            strokeWidth={1.5}
          />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-faint)' }}>
          <span>${pnl.lo.toFixed(0)}</span>
          <span>STRIKE ${strike.toFixed(0)}</span>
          <span>${pnl.hi.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
