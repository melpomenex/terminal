/**
 * Multi-symbol comparative research workflows.
 *
 * Drives `COMPARE NVDA AMD INTC` end-to-end:
 *   1. Data plane — fetches real quotes + XBRL financials per symbol in
 *      parallel and assembles a metric comparison matrix.
 *   2. Orchestration plane — a plan of panel actions the shell applies to
 *      build a side-by-side workspace with distinct color-link groups.
 *   3. Synthesis plane — guidance contrast + risk synthesis prompts for the
 *      AI Brain, grounded in the fetched data (no invented numbers).
 *
 * Client-side module: runs in the browser against the v2 API routes.
 */

import type { LinkGroupColor } from '@/lib/tiling-types';

export interface CompareMetrics {
  symbol: string;
  price: number | null;
  changePct: number | null;
  revenue: number | null;
  netIncome: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  fiscalPeriod: string | null;
  error?: string;
}

export interface ComparePlanAction {
  kind: 'open_panel';
  panelType: string;
  instrument: string;
  linkGroup: LinkGroupColor;
  label: string;
}

export interface CompareResult {
  symbols: string[];
  metrics: CompareMetrics[];
  plan: ComparePlanAction[];
  synthesisPrompt: string;
}

const LINK_GROUP_CYCLE: LinkGroupColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

interface QuoteResponse { price?: number | null; previousClose?: number | null }

async function fetchMetrics(symbol: string): Promise<CompareMetrics> {
  const base: CompareMetrics = {
    symbol, price: null, changePct: null, revenue: null, netIncome: null,
    operatingMarginPct: null, netMarginPct: null, fiscalPeriod: null,
  };
  try {
    const quote: QuoteResponse = await fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => (d.items ?? [])[0] ?? {});
    base.price = quote.price ?? null;
    base.changePct = quote.price != null && quote.previousClose
      ? Number((((quote.price - quote.previousClose) / quote.previousClose) * 100).toFixed(2))
      : null;
  } catch { /* quote optional */ }

  try {
    const stmt = await fetch(`/api/v2/statements?symbol=${encodeURIComponent(symbol)}&type=INCOME_STATEMENT&period=ANNUAL&limit=1`)
      .then((r) => r.json());
    const s = (stmt.statements ?? [])[0];
    if (s) {
      const latest = s.periods[s.periods.length - 1];
      const line = (key: string) => s.lines.find((l: { key: string }) => l.key === key)?.values[latest] ?? null;
      base.revenue = line('revenue');
      base.netIncome = line('netIncome');
      base.fiscalPeriod = latest;
      const revenue = base.revenue ?? 0;
      const opInc = line('operatingIncome');
      base.operatingMarginPct = opInc != null && revenue > 0 ? Number(((opInc / revenue) * 100).toFixed(1)) : null;
      base.netMarginPct = base.netIncome != null && revenue > 0 ? Number(((base.netIncome / revenue) * 100).toFixed(1)) : null;
    }
  } catch { /* statements optional (non-US listings) */ }

  return base;
}

/**
 * Run the full comparative workflow. `panelTypes` controls which panes the
 * orchestration plan opens per symbol (defaults to chart + FA + transcripts).
 */
export async function runComparison(
  symbols: string[],
  panelTypes: string[] = ['chart', 'financial-analysis', 'transcripts'],
): Promise<CompareResult> {
  const metrics = await Promise.all(symbols.slice(0, 4).map(fetchMetrics));

  const plan: ComparePlanAction[] = [];
  symbols.slice(0, 4).forEach((symbol, i) => {
    const group = LINK_GROUP_CYCLE[i % LINK_GROUP_CYCLE.length];
    panelTypes.forEach((panelType) => {
      plan.push({ kind: 'open_panel', panelType, instrument: symbol, linkGroup: group, label: `${symbol} ${panelType}` });
    });
  });

  const synthesisPrompt = buildSynthesisPrompt(symbols, metrics);
  return { symbols, metrics, plan, synthesisPrompt };
}

/** Grounded synthesis prompt for the brain — includes only fetched values. */
export function buildSynthesisPrompt(symbols: string[], metrics: CompareMetrics[]): string {
  const table = metrics.map((m) => ({
    symbol: m.symbol,
    price: m.price,
    changePct: m.changePct,
    revenueFY: m.revenue,
    netIncomeFY: m.netIncome,
    operatingMargin: m.operatingMarginPct != null ? `${m.operatingMarginPct}%` : null,
    netMargin: m.netMarginPct != null ? `${m.netMarginPct}%` : null,
    fiscalPeriod: m.fiscalPeriod,
    dataGap: m.revenue == null ? 'XBRL facts unavailable' : undefined,
  }));
  return [
    `Compare ${symbols.join(' vs ')} using ONLY the fetched data below. Do not estimate missing values.`,
    `Fetched metrics: ${JSON.stringify(table)}`,
    'Structure: (1) scale comparison, (2) profitability comparison with fiscal periods cited,',
    '(3) call extract_guidance for each symbol and contrast forward outlooks,',
    '(4) synthesize relative risks (margin compression, growth deceleration, valuation context via get_quote),',
    '(5) end with a markdown comparison table. Cite accession numbers / transcript quarters for every claim.',
  ].join('\n');
}

/**
 * Apply a comparison plan to the tiling workspace: opens one pane per
 * (symbol × panelType) with per-symbol color-link groups so users can change
 * instruments per column independently.
 */
export function planDescription(plan: ComparePlanAction[]): string {
  const groups = new Map<string, string[]>();
  for (const p of plan) {
    (groups.get(p.linkGroup) ?? groups.set(p.linkGroup, []).get(p.linkGroup)!).push(`${p.instrument} ${p.panelType}`);
  }
  return [...groups.entries()].map(([g, panes]) => `${g}: ${panes.join(', ')}`).join(' | ');
}
