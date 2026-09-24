import { describe, it, expect } from 'vitest';
import {
  blackScholesPrice,
  blackScholesGreeks,
  bawPrice,
  impliedVolatility,
  stdNormalCdf,
  npdf,
  yearsToExpiry,
} from '@/lib/math/options-pricing';

describe('Black-Scholes engine', () => {
  const base = {
    spot: 100, strike: 100, timeToExpiry: 1, volatility: 0.2,
    riskFreeRate: 0.05, dividendYield: 0, optionType: 'CALL' as const,
  };

  it('matches the canonical BSM call value (S=K=100, σ=20%, r=5%, T=1)', () => {
    // Reference: 10.4506 (d1=0.35, d2=0.15, N(d1)=0.63683, N(d2)=0.55962)
    const price = blackScholesPrice(base);
    expect(price).toBeCloseTo(10.4506, 3);
  });

  it('put-call parity holds', () => {
    const { spot, strike, timeToExpiry, volatility, riskFreeRate, dividendYield } = base;
    const call = blackScholesPrice({ ...base, optionType: 'CALL' });
    const put = blackScholesPrice({ ...base, optionType: 'PUT' });
    const parity = call - put - spot * Math.exp(-dividendYield * timeToExpiry) + strike * Math.exp(-riskFreeRate * timeToExpiry);
    expect(parity).toBeCloseTo(0, 8);
  });

  it('returns intrinsic value at zero time/vol', () => {
    expect(blackScholesPrice({ ...base, timeToExpiry: 0 })).toBeCloseTo(0, 8);
    const itm = blackScholesPrice({ ...base, timeToExpiry: 0, strike: 90 });
    expect(itm).toBeCloseTo(10, 8);
  });

  it('degenerates options inputs safely (no NaN/Infinity)', () => {
    for (const bad of [
      { spot: 0 }, { strike: -5 }, { volatility: 0 }, { timeToExpiry: -1 },
    ]) {
      const p = blackScholesPrice({ ...base, ...bad });
      expect(Number.isFinite(p)).toBe(true);
    }
  });
});

describe('Greeks', () => {
  const base = {
    spot: 100, strike: 100, timeToExpiry: 0.5, volatility: 0.25,
    riskFreeRate: 0.04, dividendYield: 0.01, optionType: 'CALL' as const,
  };

  it('ATM call delta ≈ 0.5 area and positive gamma/vega', () => {
    const g = blackScholesGreeks(base);
    expect(g.delta).toBeGreaterThan(0.45);
    expect(g.delta).toBeLessThan(0.60);
    expect(g.gamma).toBeGreaterThan(0);
    expect(g.vegaPerPct).toBeGreaterThan(0);
  });

  it('put delta is negative and mirrors call delta under q=r=0', () => {
    const flat = { ...base, riskFreeRate: 0, dividendYield: 0 };
    const c = blackScholesGreeks({ ...flat, optionType: 'CALL' });
    const p = blackScholesGreeks({ ...flat, optionType: 'PUT' });
    expect(c.delta - p.delta).toBeCloseTo(1, 8);
  });

  it('theta for a long option is negative (decay)', () => {
    const g = blackScholesGreeks(base);
    expect(g.thetaPerDay).toBeLessThan(0);
  });

  it('numerical delta matches analytic delta (finite difference)', () => {
    const h = 0.01;
    const up = blackScholesPrice({ ...base, spot: base.spot + h });
    const dn = blackScholesPrice({ ...base, spot: base.spot - h });
    const numeric = (up - dn) / (2 * h);
    const analytic = blackScholesGreeks(base).delta;
    expect(numeric).toBeCloseTo(analytic, 3);
  });
});

describe('Implied volatility solver', () => {
  it('round-trips: solve IV from a BSM price, then reprice', () => {
    const trueVol = 0.32;
    const price = blackScholesPrice({ spot: 420, strike: 400, timeToExpiry: 0.4, volatility: trueVol, riskFreeRate: 0.045, dividendYield: 0, optionType: 'PUT' });
    const solved = impliedVolatility({ marketPrice: price, spot: 420, strike: 400, timeToExpiry: 0.4, riskFreeRate: 0.045, dividendYield: 0, optionType: 'PUT' });
    expect(solved).not.toBeNull();
    expect(solved!).toBeCloseTo(trueVol, 4);
  });

  it('returns null when premium is below intrinsic (no arbitrage solution)', () => {
    const iv = impliedVolatility({ marketPrice: 0.01, spot: 100, strike: 50, timeToExpiry: 0.5, riskFreeRate: 0.04, dividendYield: 0, optionType: 'CALL' });
    expect(iv).toBeNull();
  });

  it('returns null for non-positive inputs', () => {
    expect(impliedVolatility({ marketPrice: 0, spot: 100, strike: 100, timeToExpiry: 1, riskFreeRate: 0.04, dividendYield: 0, optionType: 'CALL' })).toBeNull();
    expect(impliedVolatility({ marketPrice: 5, spot: 0, strike: 100, timeToExpiry: 1, riskFreeRate: 0.04, dividendYield: 0, optionType: 'CALL' })).toBeNull();
  });
});

describe('Barone-Adesi-Whaley (American)', () => {
  it('equals European price when early exercise has no value (q=0 call)', () => {
    const input = { spot: 100, strike: 100, timeToExpiry: 1, volatility: 0.2, riskFreeRate: 0.05, dividendYield: 0, optionType: 'CALL' as const };
    expect(bawPrice(input)).toBeCloseTo(blackScholesPrice(input), 6);
  });

  it('American put ≥ European put (early exercise premium)', () => {
    const input = { spot: 80, strike: 100, timeToExpiry: 0.5, volatility: 0.25, riskFreeRate: 0.06, dividendYield: 0.02, optionType: 'PUT' as const };
    expect(bawPrice(input)).toBeGreaterThanOrEqual(blackScholesPrice(input) - 1e-9);
  });

  it('deep-ITM American put ≈ intrinsic', () => {
    const input = { spot: 40, strike: 100, timeToExpiry: 0.1, volatility: 0.15, riskFreeRate: 0.05, dividendYield: 0, optionType: 'PUT' as const };
    expect(bawPrice(input)).toBeGreaterThanOrEqual(60 - 1e-6);
    expect(bawPrice(input)).toBeLessThanOrEqual(60.5);
  });
});

describe('normal distribution helpers', () => {
  it('stdNormalCdf matches reference values', () => {
    expect(stdNormalCdf(0)).toBeCloseTo(0.5, 6);
    expect(stdNormalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(stdNormalCdf(-1.96)).toBeCloseTo(0.025, 3);
    expect(stdNormalCdf(9)).toBe(1);
  });

  it('npdf integrates to ~1', () => {
    let sum = 0;
    for (let x = -6; x <= 6; x += 0.001) sum += npdf(x) * 0.001;
    expect(sum).toBeCloseTo(1, 3);
  });
});

describe('yearsToExpiry', () => {
  it('computes a positive year fraction for future dates', () => {
    const future = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
    const y = yearsToExpiry(future);
    expect(y).toBeGreaterThan(0.24);
    expect(y).toBeLessThan(0.25);
  });

  it('clamps past dates to 0 and survives malformed input', () => {
    expect(yearsToExpiry('2020-01-01')).toBe(0);
    expect(yearsToExpiry('not-a-date')).toBe(0);
  });
});
