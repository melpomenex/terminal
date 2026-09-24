/**
 * Market data provenance & quality classification.
 *
 * Every dataset rendered in Qube Terminal carries a `DataProvenance` record so
 * users can always inspect where a number came from, how fresh it is, and what
 * quality tier it belongs to. Synthetic data must never be presented without a
 * visible `SIMULATED` label.
 */

export type QualityLevel =
  | 'LIVE'
  | 'DELAYED'
  | 'DERIVED'
  | 'SIMULATED'
  | 'STALE'
  | 'UNAVAILABLE';

export interface DataProvenance {
  /** e.g. "Polygon", "SEC-EDGAR", "Nasdaq", "TwelveData" */
  sourceProvider: string;
  /** ISO 8601 retrieval time */
  retrievalTimestamp: string;
  /** ISO 8601 exchange print time, when applicable */
  exchangeTimestamp?: string;
  quality: QualityLevel;
  /** For DELAYED feeds, e.g. 15 */
  delayMinutes?: number;
  /** e.g. "NASDAQ TotalView L2" when quality is UNAVAILABLE for entitlement reasons */
  entitlementRequired?: string;
  /** ISO 4217 */
  currency: string;
}

/** Visual standards for the provenance badge (see ProvenanceBadge component). */
export const QUALITY_STYLES: Record<QualityLevel, { color: string; label: string; description: string }> = {
  LIVE: {
    color: '#00b050',
    label: 'LIVE',
    description: 'Real-time exchange-entitled data',
  },
  DELAYED: {
    color: '#ffb000',
    label: 'DELAYED',
    description: 'Exchange-delayed public quote feed',
  },
  DERIVED: {
    color: '#00ccff',
    label: 'DERIVED',
    description: 'Computed analytics (Greeks, VaR, indicators)',
  },
  SIMULATED: {
    color: '#ff00ff',
    label: 'SIMULATED',
    description: 'Backtest simulation or demo sandbox data',
  },
  STALE: {
    color: '#ff6600',
    label: 'STALE',
    description: 'Cached data — provider temporarily unavailable',
  },
  UNAVAILABLE: {
    color: '#ef4444',
    label: 'UNAVAILABLE',
    description: 'Feature requires entitlement or provider is down',
  },
};

/** Milliseconds between retrieval and now; used for latency indicators. */
export function provenanceAgeMs(provenance: DataProvenance, now: number = Date.now()): number {
  const t = Date.parse(provenance.retrievalTimestamp);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - t);
}

/** Classify a cached payload's staleness when a refresh attempt failed. */
export function downgradeToStale(provenance: DataProvenance, maxAgeMs = 120_000): DataProvenance {
  return provenanceAgeMs(provenance) > maxAgeMs
    ? { ...provenance, quality: 'STALE' }
    : provenance;
}

export function makeProvenance(
  sourceProvider: string,
  quality: QualityLevel,
  currency = 'USD',
  extra?: Partial<Omit<DataProvenance, 'sourceProvider' | 'quality' | 'currency'>>,
): DataProvenance {
  return {
    sourceProvider,
    retrievalTimestamp: new Date().toISOString(),
    quality,
    currency,
    ...extra,
  };
}
