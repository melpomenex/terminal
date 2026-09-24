/**
 * Pure mathematics for risk / correlation analysis.
 * No external dependencies.
 */

/* ── helpers ─────────────────────────────────────────── */

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function covariance(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += (x[i] - mx) * (y[i] - my);
  return sum / x.length;
}

/* ── public API ──────────────────────────────────────── */

/**
 * Pearson correlation coefficient between two equal-length arrays.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const sx = x.slice(0, n);
  const sy = y.slice(0, n);
  const denom = stdDev(sx) * stdDev(sy);
  if (denom === 0) return 0;
  return covariance(sx, sy) / denom;
}

/**
 * Build an N x N correlation matrix from an array of return-series arrays.
 * returns[i] is the array of daily returns for symbol i.
 */
export function correlationMatrix(returns: number[][]): number[][] {
  const n = returns.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const r = pearsonCorrelation(returns[i], returns[j]);
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }
  return matrix;
}

/**
 * Annualized volatility from daily returns (trading-day convention: 252 days).
 */
export function annualizedVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  return Math.sqrt(252) * stdDev(returns);
}

/**
 * Annualized Sharpe ratio.
 * riskFreeRate is expressed as a daily rate (default 0).
 */
export function sharpeRatio(returns: number[], riskFreeRate = 0): number {
  if (returns.length < 2) return 0;
  const sd = stdDev(returns);
  if (sd === 0) return 0;
  const excessMean = mean(returns) - riskFreeRate;
  return (excessMean / sd) * Math.sqrt(252);
}

/**
 * Beta of a stock vs the market, computed from daily returns.
 */
export function beta(stockReturns: number[], marketReturns: number[]): number {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < 2) return 0;
  const sr = stockReturns.slice(0, n);
  const mr = marketReturns.slice(0, n);
  const varM = variance(mr);
  if (varM === 0) return 0;
  return covariance(sr, mr) / varM;
}

/**
 * Maximum drawdown from a price series.
 * Returns the drawdown as a positive fraction (e.g. 0.25 = 25%).
 */
export function maxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  let peak = prices[0];
  let maxDD = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) peak = prices[i];
    const dd = (peak - prices[i]) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * Historical Value-at-Risk at the given confidence level (default 95%).
 * Returns VaR as a positive number (the worst expected loss).
 */
export function valueAtRisk(returns: number[], confidence = 0.95): number {
  if (returns.length < 2) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return -sorted[Math.min(idx, sorted.length - 1)];
}

/**
 * Rolling annualized volatility using a sliding window (default 30 days).
 * Returns an array of length prices.length - window, aligned to the end.
 */
export function rollingVolatility(prices: number[], window = 30): number[] {
  if (prices.length < window + 1) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(prices[i - 1] === 0 ? 0 : (prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const result: number[] = [];
  for (let i = window; i <= returns.length; i++) {
    const slice = returns.slice(i - window, i);
    result.push(Math.sqrt(252) * stdDev(slice));
  }
  return result;
}

/**
 * Compute simple daily returns from a price series.
 */
export function dailyReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    out.push(prices[i - 1] === 0 ? 0 : (prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return out;
}
