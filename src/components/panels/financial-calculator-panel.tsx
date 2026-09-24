'use client';

import { useMemo, useState } from 'react';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';
import {
  futureValue, presentValue, annuityPayment, npv, irr, bondPrice, yieldToMaturity,
} from '@/lib/math/financial-math';

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

type CalcTab = 'TVM' | 'NPV_IRR' | 'BOND';

const num = (v: string): number => (v === '' ? Number.NaN : Number(v));

/**
 * CALC — Financial calculator: time-value-of-money (PV/FV/PMT), NPV/IRR
 * cashflow analysis, and a bond price / yield-to-maturity solver.
 */
export default function FinancialCalculatorPanel({ panelId }: { panelId?: string }) {
  const [tab, setTab] = useState<CalcTab>('TVM');

  // TVM state
  const [pv, setPv] = useState('10000');
  const [rate, setRate] = useState('8');
  const [years, setYears] = useState('10');
  const [pmt, setPmt] = useState('0');

  // NPV/IRR state
  const [cfText, setCfText] = useState('-1000, 300, 400, 500');
  const [npvRate, setNpvRate] = useState('10');

  // Bond state
  const [face, setFace] = useState('1000');
  const [coupon, setCoupon] = useState('5');
  const [maturity, setMaturity] = useState('10');
  const [price, setPrice] = useState('980');

  const tvm = useMemo(() => {
    const p = num(pv), r = num(rate), y = num(years), m = num(pmt);
    if ([p, r, y].some(Number.isNaN)) return null;
    const fvLump = futureValue(p, r, y);
    // FV of a constant annual contribution (ordinary annuity)
    const rr = r / 100;
    const fvContrib = Number.isNaN(m) ? 0 : rr > 0 ? m * (Math.pow(1 + rr, y) - 1) / rr : m * y;
    const payment36 = annuityPayment(p, r, 360);
    return { fvLump, fvContrib, total: fvLump + fvContrib, payment36, pvOfFv: presentValue(fvLump, r, y) };
  }, [pv, rate, years, pmt]);

  const flows = useMemo(() => cfText.split(/[,;\s]+/).map((s) => Number(s)).filter((v) => !Number.isNaN(v)), [cfText]);
  const npvResult = useMemo(() => (flows.length > 0 && !Number.isNaN(num(npvRate)) ? npv(num(npvRate), flows) : null), [flows, npvRate]);
  const irrResult = useMemo(() => (flows.length > 1 ? irr(flows) : null), [flows]);

  const bond = useMemo(() => {
    const f = num(face), c = num(coupon), y = num(maturity), p = num(price);
    if ([f, c, y, p].some(Number.isNaN)) return null;
    const impliedPrice = bondPrice(f, c, y, num(rate));
    const ytm = yieldToMaturity(f, c, y, p);
    return { impliedPrice, ytm };
  }, [face, coupon, maturity, price, rate]);

  const provenance = useMemo(() => makeProvenance('Local financial math', 'DERIVED', 'USD'), []);

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder = '0') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 96 }}>
      <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="number"
        step="any"
        style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 11, padding: '3px 6px', fontFamily: 'var(--font)', outline: 'none' }}
      />
    </label>
  );

  const bigStat = (label: string, value: string, color = 'var(--text-bright)') => (
    <div style={{ background: 'var(--panel-bg)', padding: '6px 9px', border: '1px solid var(--border-soft)', borderRadius: 3 }}>
      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>CALC · FINANCIAL CALCULATOR</span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
          {(['TVM', 'NPV_IRR', 'BOND'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ fontSize: 9, padding: '1px 8px', border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border-soft)'}`, background: tab === t ? 'var(--accent-soft)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>{t === 'NPV_IRR' ? 'NPV / IRR' : t}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {tab === 'TVM' && (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {field('PRESENT VALUE $', pv, setPv)}
            {field('RATE %/YR', rate, setRate)}
            {field('YEARS', years, setYears)}
            {field('ANNUAL CONTRIBUTION $', pmt, setPmt)}
          </div>
          {tvm && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {bigStat('FUTURE VALUE (LUMP)', `$${tvm.fvLump.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)}
              {bigStat('FV OF CONTRIBUTIONS', `$${tvm.fvContrib.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)}
              {bigStat('TOTAL FV', `$${tvm.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'var(--accent)')}
              {bigStat('MONTHLY LOAN PMT (30Y)', `$${tvm.payment36.toFixed(2)}`, 'var(--text-dim)')}
              {bigStat('PV ROUND-TRIP CHECK', `$${tvm.pvOfFv.toFixed(2)}`, 'var(--text-dim)')}
            </div>
          )}
          <div style={{ fontSize: 8, color: 'var(--text-faint)' }}>
            FV = PV·(1+r)^t · contribution stream compounded as an ordinary annuity · loan PMT uses monthly convention over 360 periods.
          </div>
        </div>
      )}

      {tab === 'NPV_IRR' && (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>CASHFLOWS (t=0,1,2,… comma separated — negative = outflow)</span>
            <input
              value={cfText}
              onChange={(e) => setCfText(e.target.value)}
              style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 11, padding: '4px 6px', fontFamily: 'var(--font)', outline: 'none', width: '100%' }}
            />
          </label>
          {field('DISCOUNT RATE %', npvRate, setNpvRate)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {bigStat('NPV', npvResult != null ? `$${npvResult.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—', npvResult != null && npvResult >= 0 ? 'var(--positive)' : 'var(--negative)')}
            {bigStat('IRR', irrResult != null ? `${irrResult.toFixed(3)}%` : flows.length > 1 ? 'NO SOLUTION' : '—', irrResult != null ? 'var(--accent)' : 'var(--text-dim)')}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-faint)' }}>
            NPV = Σ CFₜ/(1+r)ᵗ · IRR solved by bisection; requires a sign change in the cashflow series.
          </div>
        </div>
      )}

      {tab === 'BOND' && (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {field('FACE VALUE $', face, setFace)}
            {field('COUPON %', coupon, setCoupon)}
            {field('YEARS TO MATURITY', maturity, setMaturity)}
            {field('MARKET PRICE $', price, setPrice)}
            {field('YIELD FOR PRICING %', rate, setRate)}
          </div>
          {bond && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {bigStat('MODEL PRICE AT YIELD', `$${bond.impliedPrice.toFixed(3)}`)}
              {bigStat('YIELD TO MATURITY', bond.ytm != null ? `${bond.ytm.toFixed(3)}%` : 'NO SOLUTION', 'var(--accent)')}
            </div>
          )}
          <div style={{ fontSize: 8, color: 'var(--text-faint)' }}>
            Semiannual coupon convention · YTM bisected on the standard pricing equation.
          </div>
        </div>
      )}
    </div>
  );
}
