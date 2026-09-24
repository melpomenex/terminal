import { NextResponse } from 'next/server';
import { evaluateAlerts, type AlertRuleV2, type MarketSnapshot } from '@/lib/alerts/alert-evaluator';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

/**
 * Server-side alert evaluation. Accepts the user's rule set, builds a real
 * market snapshot per referenced symbol (quote + volume), evaluates the pure
 * engine, and returns fired alerts + updated rule state. Server evaluation
 * keeps thresholds honest even when the browser tab is closed.
 */

export const dynamic = 'force-dynamic';

interface ChartResponse {
  chart?: {
    result?: Array<{
      indicators?: {
        quote?: Array<{ volume?: Array<number | null> }>;
      };
    }>;
  };
}

async function buildSnapshot(symbol: string): Promise<MarketSnapshot> {
  const snap: MarketSnapshot = { symbol, asOf: new Date().toISOString() };
  try {
    const raw = curl(yfChartUrl(symbol, '1d', '1d')) as Record<string, unknown>;
    const meta = extractMeta(raw);
    snap.price = meta.price != null ? Number(meta.price) : null;
    const chart = raw as ChartResponse;
    const volumes: Array<number | null> = chart.chart?.result?.[0]?.indicators?.quote?.[0]?.volume ?? [];
    snap.volume = volumes.reduce<number>((s, v) => s + (v ?? 0), 0) || null;
  } catch { /* price stays null → conditions degrade to not-met */ }
  return snap;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { rules?: AlertRuleV2[] };
    const rules = (body.rules ?? []).filter((r) => r && r.symbol && Array.isArray(r.conditions));
    if (rules.length === 0) return NextResponse.json({ fired: [], updatedRules: [] });

    const symbols = [...new Set(rules.map((r) => r.symbol.toUpperCase()))].slice(0, 40);
    const snapshots = await Promise.all(symbols.map(buildSnapshot));

    // Only re-fire rules whose lastFire predates this evaluation window.
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const actionable = rules.filter((r) => !r.lastFiredAt || r.lastFiredAt < windowStart);

    const { fired, updatedRules } = evaluateAlerts(actionable, snapshots);
    return NextResponse.json({ fired, updatedRules, snapshots: snapshots.map((s) => ({ symbol: s.symbol, price: s.price, volume: s.volume, asOf: s.asOf })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'evaluation failed' }, { status: 400 });
  }
}
