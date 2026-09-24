/**
 * Options pricing engine — Black-Scholes-Merton (European) and
 * Barone-Adesi-Whaley (American) approximation, with full Greeks and an
 * implied-volatility solver (Newton-Raphson with bisection fallback).
 *
 * All functions are pure and dependency-free so they are trivially testable.
 */

/** Standard normal probability density function. */
export function npdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Standard normal CDF (Zelen & Severo approximation, |ε| < 7.5e-8). */
export function stdNormalCdf(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
  const p = 0.2316419, c = 0.3989422804014327;
  const t = 1 / (1 + p * Math.abs(x));
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  const v = 1 - c * Math.exp(-0.5 * x * x) * poly;
  return x >= 0 ? v : 1 - v;
}

export interface BlackScholesInput {
  /** Underlying spot price S */
  spot: number;
  /** Strike K */
  strike: number;
  /** Time to expiry in years T */
  timeToExpiry: number;
  /** Annualized volatility σ (decimal, 0.20 = 20%) */
  volatility: number;
  /** Continuously compounded risk-free rate r (decimal) */
  riskFreeRate: number;
  /** Continuous dividend yield q (decimal) */
  dividendYield: number;
  optionType: 'CALL' | 'PUT';
}

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  /** Theta per calendar day (not per year). */
  thetaPerDay: number;
  /** Sensitivity per 1% (0.01 absolute) vol change. */
  vegaPerPct: number;
  rho: number;
}

/** Black-Scholes-Merton price. */
export function blackScholesPrice(input: BlackScholesInput): number {
  const { spot: S, strike: K, timeToExpiry: T, volatility: sigma, riskFreeRate: r, dividendYield: q, optionType } = input;
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    // Intrinsic at expiry
    const intrinsic = optionType === 'CALL' ? Math.max(0, S - K) : Math.max(0, K - S);
    return intrinsic;
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const discQ = Math.exp(-q * T);
  const discR = Math.exp(-r * T);
  if (optionType === 'CALL') {
    return S * discQ * stdNormalCdf(d1) - K * discR * stdNormalCdf(d2);
  }
  return K * discR * stdNormalCdf(-d2) - S * discQ * stdNormalCdf(-d1);
}

/** Black-Scholes-Merton price + full Greeks. */
export function blackScholesGreeks(input: BlackScholesInput): Greeks {
  const { spot: S, strike: K, timeToExpiry: T, volatility: sigma, riskFreeRate: r, dividendYield: q, optionType } = input;
  const price = blackScholesPrice(input);
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return { price, delta: optionType === 'CALL' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, thetaPerDay: 0, vegaPerPct: 0, rho: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const discQ = Math.exp(-q * T);
  const discR = Math.exp(-r * T);
  const nd1 = npdf(d1);

  const delta = optionType === 'CALL'
    ? discQ * stdNormalCdf(d1)
    : discQ * (stdNormalCdf(d1) - 1);
  const gamma = discQ * nd1 / (S * sigma * sqrtT);
  const vega = S * discQ * nd1 * sqrtT; // per 1.00 vol
  const thetaYear = optionType === 'CALL'
    ? -(S * discQ * nd1 * sigma) / (2 * sqrtT) - r * K * discR * stdNormalCdf(d2) + q * S * discQ * stdNormalCdf(d1)
    : -(S * discQ * nd1 * sigma) / (2 * sqrtT) + r * K * discR * stdNormalCdf(-d2) - q * S * discQ * stdNormalCdf(-d1);
  const thetaPerDay = thetaYear / 365;
  const rho = optionType === 'CALL'
    ? K * T * discR * stdNormalCdf(d2)
    : -K * T * discR * stdNormalCdf(-d2);

  return { price, delta, gamma, thetaPerDay, vegaPerPct: vega / 100, rho };
}

/**
 * Barone-Adesi-Whaley quadratic approximation for American options.
 * Falls back to European BSM price when deep in/deep out of the early
 * exercise region or when inputs degenerate.
 */
export function bawPrice(input: BlackScholesInput): number {
  const { spot: S, strike: K, timeToExpiry: T, volatility: sigma, riskFreeRate: r, dividendYield: q, optionType } = input;
  const european = blackScholesPrice(input);
  if (T <= 0 || sigma <= 0) return european;

  const M = 2 * r / (sigma * sigma);
  const N = 2 * (r - q) / (sigma * sigma);
  const sqrtT = Math.sqrt(T);

  // Critical price iteration (q2 for calls, q1 for puts)
  if (optionType === 'CALL') {
    if (q <= 0) return Math.max(european, S - K); // never optimal to early-exercise
    const nn = 2 * (r - q) / (sigma * sigma);
    const q2 = (-(nn - 1) + Math.sqrt((nn - 1) * (nn - 1) + 4 * M)) / 2;
    // Solve critical S* via simple bisection on early-exercise boundary.
    let lo = K, hi = Math.max(S, K) * 4;
    const exerciseValue = (s: number) => {
      const d1 = (Math.log(s / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
      const d2 = d1 - sigma * sqrtT;
      return s - K - (s * Math.exp(-q * T) * stdNormalCdf(d1) - K * Math.exp(-r * T) * stdNormalCdf(d2));
    };
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2;
      if (exerciseValue(mid) > 0) hi = mid; else lo = mid;
    }
    const SStar = (lo + hi) / 2;
    if (S >= SStar) return Math.max(european, S - K);
    const d1 = (Math.log(SStar / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const A2 = (SStar / q2) * (1 - Math.exp(-q * T) * stdNormalCdf(d1));
    return european + A2 * Math.pow(S / SStar, q2);
  }

  // PUT
  const nn = 2 * (r - q) / (sigma * sigma);
  const q1 = (-(nn - 1) - Math.sqrt((nn - 1) * (nn - 1) + 4 * M)) / 2;
  let lo = Math.min(S, K) * 0.1, hi = K;
  const putExercise = (s: number) => {
    const d1 = (Math.log(s / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    return K - s - (K * Math.exp(-r * T) * stdNormalCdf(-d2) - s * Math.exp(-q * T) * stdNormalCdf(-d1));
  };
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (putExercise(mid) > 0) lo = mid; else hi = mid;
  }
  const SStar = (lo + hi) / 2;
  if (S <= SStar) return Math.max(european, K - S);
  const d1 = (Math.log(SStar / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const A1 = -(SStar / q1) * (1 - Math.exp(-q * T) * stdNormalCdf(-d1));
  return european + A1 * Math.pow(S / SStar, q1);
}

/**
 * Implied volatility from a market price via Newton-Raphson, with a
 * bisection safeguard. Returns null when no bracketing solution exists
 * (e.g. market price below intrinsic or above arbitrage bound).
 */
export function impliedVolatility(params: {
  marketPrice: number;
  spot: number;
  strike: number;
  timeToExpiry: number;
  riskFreeRate: number;
  dividendYield: number;
  optionType: 'CALL' | 'PUT';
}): number | null {
  const { marketPrice, spot, strike: K, timeToExpiry: T, riskFreeRate: r, dividendYield: q, optionType } = params;
  if (!(marketPrice > 0) || T <= 0 || spot <= 0 || K <= 0) return null;

  const intrinsic = optionType === 'CALL' ? Math.max(0, spot * Math.exp(-q * T) - K * Math.exp(-r * T)) : Math.max(0, K * Math.exp(-r * T) - spot * Math.exp(-q * T));
  if (marketPrice < intrinsic * 0.98) return null;

  const price = (sig: number) => blackScholesPrice({ spot, strike: K, timeToExpiry: T, volatility: sig, riskFreeRate: r, dividendYield: q, optionType });

  // Newton-Raphson from a sensible seed
  let sigma = Math.sqrt(2 * Math.PI / T) * marketPrice / spot; // Corrado-Miller style seed
  sigma = Math.min(Math.max(sigma, 0.05), 3.0);
  for (let i = 0; i < 60; i++) {
    const p = price(sigma);
    const diff = p - marketPrice;
    if (Math.abs(diff) < 1e-8) return sigma;
    const d1 = (Math.log(spot / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const vega = spot * Math.exp(-q * T) * npdf(d1) * Math.sqrt(T);
    if (vega < 1e-10) break;
    const next = sigma - diff / vega;
    if (next <= 0 || !Number.isFinite(next)) break;
    sigma = Math.min(Math.max(next, 1e-4), 5.0);
  }

  // Bisection fallback over [0.001, 5.0]
  let lo = 0.001, hi = 5.0;
  const pLo = price(lo), pHi = price(hi);
  if (marketPrice < pLo || marketPrice > pHi) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const pMid = price(mid);
    if (Math.abs(pMid - marketPrice) < 1e-10) return mid;
    if (pMid < marketPrice) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Trading-days-free year fraction from days to expiry (calendar, 365). */
export function yearsToExpiry(expiryDate: string, now: number = Date.now()): number {
  const t = Date.parse(expiryDate.length === 10 ? `${expiryDate}T21:00:00Z` : expiryDate);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (t - now) / (365 * 24 * 3600 * 1000));
}
