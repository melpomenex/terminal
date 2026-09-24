/**
 * Pure technical indicator computation functions.
 * All functions accept `number[]` data and return arrays of the same length.
 * Entries where computation is impossible (not enough prior data) are `null`.
 */

/**
 * Simple Moving Average — averages the last `period` values.
 */
export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j] != null && Number.isFinite(data[j])) {
        sum += data[j];
        count++;
      }
    }
    result[i] = count > 0 ? sum / count : null;
  }
  return result;
}

/**
 * Exponential Moving Average — recursive weighting with multiplier k = 2 / (period + 1).
 * Seeds with the SMA of the first `period` values.
 */
export function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period) return result;

  // Seed: SMA of first `period` values
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < period; i++) {
    if (data[i] != null && Number.isFinite(data[i])) {
      seedSum += data[i];
      seedCount++;
    }
  }
  if (seedCount === 0) return result;

  const seed = seedSum / seedCount;
  result[period - 1] = seed;

  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    const prev = result[i - 1];
    if (prev == null || data[i] == null || !Number.isFinite(data[i])) {
      result[i] = prev;
    } else {
      result[i] = data[i] * k + prev * (1 - k);
    }
  }
  return result;
}

/**
 * Relative Strength Index (0–100).
 * Uses Wilder's smoothing (equivalent to EMA with k = 1/period).
 */
export function rsi(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period + 1) return result;

  let gainSum = 0;
  let lossSum = 0;

  // First `period` changes
  for (let i = 1; i <= period; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (prev != null && curr != null && Number.isFinite(prev) && Number.isFinite(curr)) {
      const delta = curr - prev;
      if (delta > 0) gainSum += delta;
      else lossSum += Math.abs(delta);
    }
  }

  const avgGain0 = gainSum / period;
  const avgLoss0 = lossSum / period;
  const rs0 = avgLoss0 === 0 ? 100 : avgGain0 / avgLoss0;
  result[period] = avgLoss0 === 0 ? 100 : 100 - 100 / (1 + rs0);

  const k = 1 / period; // Wilder's smoothing factor
  let prevAvgGain = avgGain0;
  let prevAvgLoss = avgLoss0;

  for (let i = period + 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (prev == null || curr == null || !Number.isFinite(prev) || !Number.isFinite(curr)) {
      result[i] = result[i - 1];
      continue;
    }
    const delta = curr - prev;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;

    const avgGain = prevAvgGain * (1 - k) + gain * k;
    const avgLoss = prevAvgLoss * (1 - k) + loss * k;

    prevAvgGain = avgGain;
    prevAvgLoss = avgLoss;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

/**
 * MACD — Moving Average Convergence Divergence.
 * Returns an object with macd line, signal line (EMA of macd), and histogram (macd − signal).
 */
export function macd(
  data: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = ema(data, fast);
  const slowEma = ema(data, slow);

  const macdLine: (number | null)[] = data.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f != null && s != null) return f - s;
    return null;
  });

  // Signal is EMA of the macd line values, treating null as gaps
  const validMacd: number[] = [];
  const macdIndices: number[] = [];
  macdLine.forEach((v, i) => {
    if (v != null) {
      validMacd.push(v);
      macdIndices.push(i);
    }
  });

  const signalEma = ema(validMacd, signal);

  const signalLine: (number | null)[] = new Array(data.length).fill(null);
  for (let j = 0; j < macdIndices.length; j++) {
    if (signalEma[j] != null) {
      signalLine[macdIndices[j]] = signalEma[j];
    }
  }

  const histogram: (number | null)[] = data.map((_, i) => {
    const m = macdLine[i];
    const s = signalLine[i];
    if (m != null && s != null) return m - s;
    return null;
  });

  return { macd: macdLine, signal: signalLine, histogram };
}

export function bollingerBands(
  data: number[],
  period: number = 20,
  mult: number = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(data, period);
  const upper: (number | null)[] = new Array(data.length).fill(null);
  const lower: (number | null)[] = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    const m = middle[i];
    if (m == null) continue;
    let sumSq = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j] != null && Number.isFinite(data[j])) {
        sumSq += (data[j] - m) ** 2;
        count++;
      }
    }
    if (count < 2) continue;
    const stdDev = Math.sqrt(sumSq / count);
    upper[i] = m + mult * stdDev;
    lower[i] = m - mult * stdDev;
  }
  return { upper, middle, lower };
}

export function vwap(high: number[], low: number[], close: number[], volume: number[]): (number | null)[] {
  const result: (number | null)[] = new Array(close.length).fill(null);
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < close.length; i++) {
    const h = high[i], l = low[i], c = close[i], v = volume[i];
    if (h == null || l == null || c == null || v == null || !isFinite(h) || !isFinite(l) || !isFinite(c) || !isFinite(v)) {
      result[i] = cumVol > 0 ? cumPV / cumVol : null;
      continue;
    }
    const typical = (h + l + c) / 3;
    cumPV += typical * v;
    cumVol += v;
    result[i] = cumVol > 0 ? cumPV / cumVol : null;
  }
  return result;
}

export function atr(high: number[], low: number[], close: number[], period = 14): (number | null)[] {
  const tr: number[] = [];
  for (let i = 0; i < close.length; i++) {
    if (i === 0) tr.push(high[i] - low[i]);
    else {
      const hl = high[i] - low[i];
      const hc = Math.abs(high[i] - close[i - 1]);
      const lc = Math.abs(low[i] - close[i - 1]);
      tr.push(Math.max(hl, hc, lc));
    }
  }
  const result = sma(tr, period);
  return result;
}

export function volumeProfile(close: number[], volume: number[], bins = 24): { price: number; volume: number }[] {
  if (close.length === 0) return [];
  const valid = close.map((c, i) => ({ c, v: volume[i] ?? 0 })).filter(p => p.c != null && isFinite(p.c));
  if (valid.length === 0) return [];
  const min = Math.min(...valid.map(p => p.c));
  const max = Math.max(...valid.map(p => p.c));
  const range = max - min || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    price: min + (range * (i + 0.5)) / bins,
    volume: 0,
  }));
  for (const p of valid) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(((p.c - min) / range) * bins)));
    buckets[idx].volume += p.v;
  }
  return buckets;
}

export function findSupportResistance(high: number[], low: number[], close: number[], lookback = 5): { supports: number[]; resistances: number[] } {
  const supports: number[] = [];
  const resistances: number[] = [];
  for (let i = lookback; i < close.length - lookback; i++) {
    const isSwingLow = low.slice(i - lookback, i).every(v => v >= low[i]) && low.slice(i + 1, i + lookback + 1).every(v => v >= low[i]);
    const isSwingHigh = high.slice(i - lookback, i).every(v => v <= high[i]) && high.slice(i + 1, i + lookback + 1).every(v => v <= high[i]);
    if (isSwingLow && low[i] != null && isFinite(low[i])) supports.push(low[i]);
    if (isSwingHigh && high[i] != null && isFinite(high[i])) resistances.push(high[i]);
  }
  const cluster = (levels: number[]) => {
    if (levels.length === 0) return [];
    levels.sort((a, b) => a - b);
    const clustered: number[] = [];
    let group: number[] = [levels[0]];
    for (let i = 1; i < levels.length; i++) {
      if (Math.abs(levels[i] - group[group.length - 1]) / group[group.length - 1] < 0.008) group.push(levels[i]);
      else {
        clustered.push(group.reduce((a, b) => a + b, 0) / group.length);
        group = [levels[i]];
      }
    }
    clustered.push(group.reduce((a, b) => a + b, 0) / group.length);
    return clustered.slice(-6);
  };
  return { supports: cluster(supports).slice(0, 4), resistances: cluster(resistances).slice(-4) };
}

export function fibLevels(high: number, low: number): { level: number; price: number; label: string }[] {
  const range = high - low;
  return [
    { level: 0, price: low, label: '0%' },
    { level: 0.236, price: low + range * 0.236, label: '23.6%' },
    { level: 0.382, price: low + range * 0.382, label: '38.2%' },
    { level: 0.5, price: low + range * 0.5, label: '50%' },
    { level: 0.618, price: low + range * 0.618, label: '61.8%' },
    { level: 0.786, price: low + range * 0.786, label: '78.6%' },
    { level: 1, price: high, label: '100%' },
  ];
}

export function stochastic(high: number[], low: number[], close: number[], kPeriod = 14, dPeriod = 3): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = new Array(close.length).fill(null);
  for (let i = kPeriod - 1; i < close.length; i++) {
    const highest = Math.max(...high.slice(i - kPeriod + 1, i + 1).filter(v => isFinite(v) && v != null));
    const lowest = Math.min(...low.slice(i - kPeriod + 1, i + 1).filter(v => isFinite(v) && v != null));
    const range = highest - lowest;
    if (range === 0) k[i] = 50;
    else k[i] = ((close[i] - lowest) / range) * 100;
  }
  const d = sma(k.filter(v => v != null) as number[], dPeriod);
  const dFull: (number | null)[] = new Array(close.length).fill(null);
  let idx = 0;
  for (let i = 0; i < close.length; i++) {
    if (k[i] != null) {
      if (idx < d.length && d[idx] != null) dFull[i] = d[idx] as number;
      idx++;
    }
  }
  return { k, d: sma(k.map(v => v ?? 50), dPeriod) };
}

export function williamsR(high: number[], low: number[], close: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(close.length).fill(null);
  for (let i = period - 1; i < close.length; i++) {
    const highest = Math.max(...high.slice(i - period + 1, i + 1).filter(v => isFinite(v)));
    const lowest = Math.min(...low.slice(i - period + 1, i + 1).filter(v => isFinite(v)));
    const range = highest - lowest;
    if (range === 0) result[i] = -50;
    else result[i] = ((highest - close[i]) / range) * -100;
  }
  return result;
}

export function ichimoku(high: number[], low: number[], close: number[]): { tenkan: (number | null)[]; kijun: (number | null)[]; senkouA: (number | null)[]; senkouB: (number | null)[]; chikou: (number | null)[] } {
  const convLine = (period: number) => {
    const res: (number | null)[] = new Array(close.length).fill(null);
    for (let i = period - 1; i < close.length; i++) {
      const h = Math.max(...high.slice(i - period + 1, i + 1));
      const l = Math.min(...low.slice(i - period + 1, i + 1));
      res[i] = (h + l) / 2;
    }
    return res;
  };
  const tenkan = convLine(9);
  const kijun = convLine(26);
  const senkouA: (number | null)[] = new Array(close.length).fill(null);
  const senkouB: (number | null)[] = new Array(close.length).fill(null);
  for (let i = 0; i < close.length; i++) {
    if (tenkan[i] != null && kijun[i] != null) {
      const idx = i + 26;
      if (idx < close.length) senkouA[idx] = (tenkan[i]! + kijun[i]!) / 2;
    }
    if (i >= 51) {
      const h = Math.max(...high.slice(i - 51, i + 1));
      const l = Math.min(...low.slice(i - 51, i + 1));
      const idx = i + 26;
      if (idx < close.length) senkouB[idx] = (h + l) / 2;
    }
  }
  const chikou: (number | null)[] = new Array(close.length).fill(null);
  for (let i = 26; i < close.length; i++) {
    chikou[i - 26] = close[i];
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
}
