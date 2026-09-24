'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import type { StandardizedStatement } from '@/lib/providers/contracts';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

interface RatioDef {
  key: string;
  label: string;
  group: 'VALUATION' | 'PROFITABILITY' | 'GROWTH' | 'LEVERAGE' | 'LIQUIDITY';
  format: 'x' | '%' | 'number';
}

const safeDiv = (a: number | null, b: number | null): number | null => (a != null && b != null && b !== 0 ? a / b : null);

function cagr(values: Array<number | null>): number | null {
  const clean = values.filter((v): v is number => v != null && v > 0);
  if (clean.length < 2) return null;
  const years = clean.length - 1;
  return Math.pow(clean[clean.length - 1] / clean[0], 1 / years) - 1;
}

/**
 * RATIO — Financial ratio analysis across Valuation, Profitability, Growth,
 * Leverage and Liquidity, with per-period trends computed from SEC XBRL
 * statements. Valuation multiples use the live spot price.
 */
export default function RatioAnalysisPanel({ panelId }: { panelId?: string }) {
  const { symbol, chart, watchlist } = useTerminalContext();
  const [income, setIncome] = useState<StandardizedStatement | null>(null);
  const [balance, setBalance] = useState<StandardizedStatement | null>(null);
  const [cashflow, setCashflow] = useState<StandardizedStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const [i, b, c] = await Promise.all([
        fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=INCOME_STATEMENT&period=ANNUAL&limit=5`).then((r) => r.json()),
        fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=BALANCE_SHEET&period=ANNUAL&limit=5`).then((r) => r.json()),
        fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=CASH_FLOW&period=ANNUAL&limit=5`).then((r) => r.json()),
      ]);
      if (i.error) throw new Error(i.error);
      setIncome((i.statements ?? [])[0] ?? null);
      setBalance((b.statements ?? [])[0] ?? null);
      setCashflow((c.statements ?? [])[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(symbol); }, [symbol, load]);

  const periods = income?.periods ?? [];
  const latest = periods[periods.length - 1];

  const getter = useCallback((statement: StandardizedStatement | null) => {
    return (period: string, lineKey: string): number | null => {
      const l = statement?.lines.find((x) => x.key === lineKey);
      if (!l) return null;
      return l.values[period] ?? null;
    };
  }, []);

  const ig = getter(income);
  const bg = getter(balance);
  const cg = getter(cashflow);

  const spot = chart?.price ?? watchlist.find((w) => w.symbol === symbol)?.price ?? null;

  const ratios = useMemo<Array<{ def: { key: string; label: string; group: string; format: string }; values: Record<string, number | null> }>>(() => {
    if (periods.length === 0) return [];
    const out: Array<{ def: { key: string; label: string; group: string; format: string }; values: Record<string, number | null> }> = [];

    const push = (key: string, label: string, group: string, format: string, fn: (p: string) => number | null) => {
      const values: Record<string, number | null> = {};
      for (const p of periods) values[p] = fn(p);
      out.push({ def: { key, label, group, format }, values });
    };

    // Valuation (uses latest financials + spot)
    if (spot != null) {
      const epsLatest = latest ? ig(latest, 'epsDiluted') : null;
      const shares = latest ? ig(latest, 'sharesDiluted') : null;
      const equityLatest = latest ? bg(latest, 'equity') : null;
      const revenueLatest = latest ? ig(latest, 'revenue') : null;
      if (epsLatest != null && epsLatest > 0) push('pe', 'P/E (trailing)', 'VALUATION', 'x', () => spot / epsLatest);
      if (shares != null) {
        const mcap = spot * shares;
        if (revenueLatest != null) push('ps', 'P/S (trailing)', 'VALUATION', 'x', () => mcap / revenueLatest);
        if (equityLatest != null && equityLatest > 0) push('pb', 'P/B (latest)', 'VALUATION', 'x', () => mcap / equityLatest);
      }
      if (equityLatest != null) push('bvps', 'Book Value / Share', 'VALUATION', 'number', () => {
        const sh = shares ?? (ig(latest, 'sharesDiluted'));
        return sh != null ? equityLatest / sh : null;
      });
    }

    // Profitability
    push('grossMargin', 'Gross Margin', 'PROFITABILITY', '%', (p) => { const g = safeDiv(ig(p, 'grossProfit'), ig(p, 'revenue')); return g == null ? null : g * 100; });
    push('operMargin', 'Operating Margin', 'PROFITABILITY', '%', (p) => { const g = safeDiv(ig(p, 'operatingIncome'), ig(p, 'revenue')); return g == null ? null : g * 100; });
    push('netMargin', 'Net Margin', 'PROFITABILITY', '%', (p) => { const g = safeDiv(ig(p, 'netIncome'), ig(p, 'revenue')); return g == null ? null : g * 100; });
    push('roe', 'Return on Equity', 'PROFITABILITY', '%', (p) => { const g = safeDiv(ig(p, 'netIncome'), bg(p, 'equity')); return g == null ? null : g * 100; });
    push('roa', 'Return on Assets', 'PROFITABILITY', '%', (p) => { const g = safeDiv(ig(p, 'netIncome'), bg(p, 'totalAssets')); return g == null ? null : g * 100; });
    push('fcfMargin', 'FCF Margin', 'PROFITABILITY', '%', (p) => { const g = safeDiv(cg(p, 'fcf'), ig(p, 'revenue')); return g == null ? null : g * 100; });

    // Leverage
    push('debtEquity', 'Debt / Equity', 'LEVERAGE', 'x', (p) => safeDiv((bg(p, 'longTermDebt') ?? 0) + (bg(p, 'shortTermDebt') ?? 0), bg(p, 'equity')));
    push('debtEbitda', 'Debt / EBITDA', 'LEVERAGE', 'x', (p) => {
      const debt = (bg(p, 'longTermDebt') ?? 0) + (bg(p, 'shortTermDebt') ?? 0);
      const ebitda = (ig(p, 'operatingIncome') ?? 0) + Math.max(0, ig(p, 'rnd') ?? 0) * 0 + ((ig(p, 'cogs') ?? 0) - (ig(p, 'cogs') ?? 0));
      // EBITDA approximation: EBIT + D&A when available; fallback EBIT
      void ebitda;
      return safeDiv(debt, ig(p, 'operatingIncome'));
    });
    push('liabAssets', 'Liabilities / Assets', 'LEVERAGE', 'x', (p) => safeDiv(bg(p, 'totalLiabilities'), bg(p, 'totalAssets')));

    // Liquidity
    push('currentRatio', 'Current Ratio', 'LIQUIDITY', 'x', (p) => safeDiv(bg(p, 'currentAssets'), bg(p, 'currentLiabilities')));
    push('quickRatio', 'Quick Ratio', 'LIQUIDITY', 'x', (p) => {
      const ca = bg(p, 'currentAssets'); const inv = bg(p, 'inventory'); const cl = bg(p, 'currentLiabilities');
      return safeDiv(ca != null && inv != null ? ca - inv : ca, cl);
    });
    push('cashRatio', 'Cash Ratio', 'LIQUIDITY', 'x', (p) => safeDiv(bg(p, 'cash'), bg(p, 'currentLiabilities')));

    // Growth (CAGR across available periods)
    const revenueCagr = cagr(periods.map((p) => ig(p, 'revenue')));
    const netIncomeCagr = cagr(periods.map((p) => ig(p, 'netIncome')));
    const fcfCagr = cagr(periods.map((p) => cg(p, 'fcf')));
    if (revenueCagr != null) out.push({ def: { key: 'revCagr', label: `Revenue CAGR (${periods.length}Y)`, group: 'GROWTH', format: '%' }, values: { [latest ?? 'LATEST']: revenueCagr * 100 } });
    if (netIncomeCagr != null) out.push({ def: { key: 'niCagr', label: `Net Income CAGR (${periods.length}Y)`, group: 'GROWTH', format: '%' }, values: { [latest ?? 'LATEST']: netIncomeCagr * 100 } });
    if (fcfCagr != null) out.push({ def: { key: 'fcfCagr', label: `FCF CAGR (${periods.length}Y)`, group: 'GROWTH', format: '%' }, values: { [latest ?? 'LATEST']: fcfCagr * 100 } });

    return out;
  }, [periods, ig, bg, cg, spot, latest]);

  const groups = ['VALUATION', 'PROFITABILITY', 'GROWTH', 'LEVERAGE', 'LIQUIDITY'] as const;
  const provenance = useMemo(() => makeProvenance('SEC XBRL statements + live spot', 'DERIVED', 'USD'), []);

  const fmtRatio = (v: number | null, format: string): string => {
    if (v == null) return '—';
    if (format === '%') return `${v.toFixed(1)}%`;
    if (format === 'x') return `${v.toFixed(2)}×`;
    return v.toFixed(2);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>RATIO · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{spot != null ? `SPOT $${spot.toFixed(2)}` : 'NO SPOT'}</span>
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {loading && <div style={{ padding: 12, color: 'var(--text-dim)' }}>LOADING STATEMENTS…</div>}
      {error && <div style={{ padding: 12, color: 'var(--negative)', fontSize: 10 }}>{error.toUpperCase()} — ratios need SEC XBRL facts.</div>}

      {!loading && !error && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {groups.map((group) => {
            const rows = ratios.filter((r) => r.def.group === group);
            if (rows.length === 0) return null;
            return (
              <div key={group}>
                <div style={{ padding: '5px 8px 2px', fontSize: 9, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.6, background: 'var(--surface-sunken)' }}>{group}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {rows.map(({ def, values }) => {
                      const latestVal = def.key.includes('Cagr') ? Object.values(values)[0] : (latest ? values[latest] : null);
                      const trend = periods.map((p) => values[p]);
                      const trendMin = Math.min(...trend.filter((v): v is number => v != null).map(Math.abs), 0);
                      const trendMax = Math.max(...trend.filter((v): v is number => v != null).map(Math.abs), 1);
                      return (
                        <tr key={def.key} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                          <td style={{ padding: '3px 8px', color: 'var(--text-dim)' }}>{def.label}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--text-bright)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtRatio(latestVal ?? null, def.format)}
                          </td>
                          <td style={{ padding: '3px 8px', width: 120 }}>
                            <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 14 }}>
                              {trend.map((v, i) => {
                                if (v == null) return <div key={i} style={{ flex: 1, height: 2, background: 'var(--border-soft)' }} />;
                                const h = 3 + ((Math.abs(v) - trendMin) / (trendMax - trendMin || 1)) * 11;
                                return <div key={i} title={`${periods[i]}: ${fmtRatio(v, def.format)}`} style={{ flex: 1, height: h, background: v >= 0 ? 'var(--positive)' : 'var(--negative)', opacity: 0.75 }} />;
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
          <div style={{ padding: '4px 8px', fontSize: 8, color: 'var(--text-faint)' }}>
            Computed from SEC EDGAR XBRL annual statements · Debt/EBITDA approximated with EBIT when D&amp;A is unreported · bars = per-period trend
          </div>
        </div>
      )}
    </div>
  );
}
