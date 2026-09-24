/**
 * Alert evaluation engine — multi-condition triggers evaluated server-side
 * against the latest market-data snapshot. Condition kinds:
 *
 *   PRICE_ABOVE / PRICE_BELOW  — last price crossing a threshold
 *   VOLUME_ABOVE               — session volume exceeding a threshold
 *   IV_ABOVE / IV_BELOW        — at-the-money implied volatility level
 *   EARNINGS_DATE_WITHIN       — days until next earnings report ≤ N
 *   FILING_RELEASED            — new SEC filing of a form type appeared
 *   BREAKING_NEWS              — high-urgency headline mentioning the symbol
 *
 * The engine is pure: it maps (rules, snapshot) → fired events with no I/O,
 * so the same code runs in the /api/v2/alerts/evaluate route (server truth)
 * and in unit tests.
 */

export type AlertConditionKind =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'VOLUME_ABOVE'
  | 'IV_ABOVE'
  | 'IV_BELOW'
  | 'EARNINGS_DATE_WITHIN'
  | 'FILING_RELEASED'
  | 'BREAKING_NEWS';

export interface AlertCondition {
  kind: AlertConditionKind;
  /** Threshold: price/volume/IV level, or days for EARNINGS_DATE_WITHIN, or form type for FILING_RELEASED. */
  value?: number | string;
}

export interface AlertRuleV2 {
  id: string;
  name: string;
  symbol: string;
  /** All conditions must hold (AND); single condition is the common case. */
  conditions: AlertCondition[];
  /** ISO date of last firing; suppresses re-firing until reset. */
  lastFiredAt?: string;
  enabled: boolean;
  createdAt: string;
}

export interface MarketSnapshot {
  symbol: string;
  price?: number | null;
  volume?: number | null;
  atmIv?: number | null;
  nextEarningsDate?: string | null;
  /** Accession numbers present in the snapshot window. */
  recentFilings?: Array<{ form: string; accessionNumber: string; filedAt: string }>;
  breakingHeadlines?: Array<{ title: string; url?: string; publishedAt: string }>;
  asOf: string;
}

export interface FiredAlert {
  ruleId: string;
  ruleName: string;
  symbol: string;
  firedAt: string;
  /** Human-readable description of which conditions held. */
  reasons: string[];
  headlineUrl?: string;
}

function evalCondition(cond: AlertCondition, snap: MarketSnapshot, now: Date = new Date()): { met: boolean; reason?: string; url?: string } {
  switch (cond.kind) {
    case 'PRICE_ABOVE': {
      const t = Number(cond.value);
      if (snap.price == null || Number.isNaN(t)) return { met: false };
      return snap.price > t ? { met: true, reason: `price ${snap.price.toFixed(2)} > ${t}` } : { met: false };
    }
    case 'PRICE_BELOW': {
      const t = Number(cond.value);
      if (snap.price == null || Number.isNaN(t)) return { met: false };
      return snap.price < t ? { met: true, reason: `price ${snap.price.toFixed(2)} < ${t}` } : { met: false };
    }
    case 'VOLUME_ABOVE': {
      const t = Number(cond.value);
      if (snap.volume == null || Number.isNaN(t)) return { met: false };
      return snap.volume > t ? { met: true, reason: `volume ${snap.volume.toLocaleString()} > ${t.toLocaleString()}` } : { met: false };
    }
    case 'IV_ABOVE': {
      const t = Number(cond.value);
      if (snap.atmIv == null || Number.isNaN(t)) return { met: false };
      return snap.atmIv * 100 > t ? { met: true, reason: `ATM IV ${(snap.atmIv * 100).toFixed(1)}% > ${t}%` } : { met: false };
    }
    case 'IV_BELOW': {
      const t = Number(cond.value);
      if (snap.atmIv == null || Number.isNaN(t)) return { met: false };
      return snap.atmIv * 100 < t ? { met: true, reason: `ATM IV ${(snap.atmIv * 100).toFixed(1)}% < ${t}%` } : { met: false };
    }
    case 'EARNINGS_DATE_WITHIN': {
      const days = Number(cond.value ?? 5);
      if (!snap.nextEarningsDate) return { met: false };
      const until = (Date.parse(snap.nextEarningsDate) - now.getTime()) / 86_400_000;
      return until >= 0 && until <= days
        ? { met: true, reason: `earnings in ${Math.ceil(until)}d (≤ ${days}d)` }
        : { met: false };
    }
    case 'FILING_RELEASED': {
      const form = String(cond.value ?? '').toUpperCase();
      const hits = (snap.recentFilings ?? []).filter((f) => !form || f.form.toUpperCase() === form || f.form.toUpperCase().startsWith(form));
      if (hits.length === 0) return { met: false };
      return { met: true, reason: `new ${hits[0].form} filed ${hits[0].filedAt}` };
    }
    case 'BREAKING_NEWS': {
      const kw = cond.value != null ? String(cond.value).toUpperCase() : snap.symbol;
      const hit = (snap.breakingHeadlines ?? []).find((h) => h.title.toUpperCase().includes(kw));
      if (!hit) return { met: false };
      return { met: true, reason: `breaking: ${hit.title.slice(0, 90)}`, url: hit.url };
    }
    default:
      return { met: false };
  }
}

/**
 * Evaluate rules against snapshots. A rule fires when every condition is met
 * and it hasn't already fired (caller-supplied `lastFiredAt` guards repeats).
 * Returns fired alerts plus updated rules with lastFiredAt stamped.
 */
export function evaluateAlerts(
  rules: AlertRuleV2[],
  snapshots: MarketSnapshot[],
  now: Date = new Date(),
): { fired: FiredAlert[]; updatedRules: AlertRuleV2[] } {
  const bySymbol = new Map(snapshots.map((s) => [s.symbol.toUpperCase(), s]));
  const fired: FiredAlert[] = [];
  const updatedRules = rules.map((rule) => {
    if (!rule.enabled) return rule;
    const snap = bySymbol.get(rule.symbol.toUpperCase());
    if (!snap) return rule;

    const results = rule.conditions.map((c) => evalCondition(c, snap, now));
    const allMet = results.every((r) => r.met);
    if (!allMet) return rule;

    fired.push({
      ruleId: rule.id,
      ruleName: rule.name,
      symbol: rule.symbol,
      firedAt: now.toISOString(),
      reasons: results.map((r) => r.reason).filter((r): r is string => r != null),
      headlineUrl: results.find((r) => r.url != null)?.url,
    });
    return { ...rule, lastFiredAt: now.toISOString() };
  });
  return { fired, updatedRules };
}

/** Serialize rules into the compact command-bar form for HELP display. */
export function describeRule(rule: AlertRuleV2): string {
  return `${rule.name}: ${rule.symbol} ${rule.conditions.map((c) => `${c.kind}${c.value != null ? ` ${c.value}` : ''}`).join(' AND ')}`;
}
