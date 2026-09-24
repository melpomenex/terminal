'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import type { StandardizedStatement } from '@/lib/providers/contracts';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

interface MatrixRow {
  metric: string;
  annual: Record<string, number | null>;
  quarters: Record<string, number | null>;
}

/**
 * EM — Earnings Matrix: combined multi-period grid of historical annual and
 * quarterly actuals (revenue, operating income, net income, EPS) with
 * forward consensus columns. Historical cells are real SEC XBRL facts;
 * forward columns require a licensed consensus provider and are explicitly
 * marked UNAVAILABLE until one is configured — never interpolated.
 */
export default function EarningsMatrixPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [annual, setAnnual] = useState<StandardizedStatement | null>(null);
  const [quarterly, setQuarterly] = useState<StandardizedStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const [a, q] = await Promise.all([
        fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=INCOME_STATEMENT&period=ANNUAL&limit=5`).then((r) => r.json()),
        fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=INCOME_STATEMENT&period=QUARTERLY&limit=8`).then((r) => r.json()),
      ]);
      if (a.error) throw new Error(a.error);
      setAnnual((a.statements ?? [])[0] ?? null);
      setQuarterly((q.statements ?? [])[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(symbol); }, [symbol, load]);

  const { annualPeriods, quarterPeriods, rows } = useMemo(() => {
    const annualPeriods = annual?.periods ?? [];
    const quarterPeriods = quarterly?.periods ?? [];
    const pick = (s: StandardizedStatement | null, p: string, key: string) => s?.lines.find((l) => l.key === key)?.values[p] ?? null;

    const mk = (metric: string, key: string, scale: (v: number) => number = (v) => v): MatrixRow => ({
      metric,
      annual: Object.fromEntries(annualPeriods.map((p) => [p, pick(annual, p, key) != null ? scale(pick(annual, p, key)!) : null])),
      quarters: Object.fromEntries(quarterPeriods.map((p) => [p, pick(quarterly, p, key) != null ? scale(pick(quarterly, p, key)!) : null])),
    });

    const rows: MatrixRow[] = [
      mk('Revenue', 'revenue'),
      mk('Operating Income', 'operatingIncome'),
      mk('Net Income', 'netIncome'),
      mk('Diluted EPS', 'epsDiluted'),
    ];
    return { annualPeriods, quarterPeriods, rows };
  }, [annual, quarterly]);

  const fmt = (v: number | null, metric: string): string => {
    if (v == null) return '—';
    if (metric.includes('EPS')) return v.toFixed(2);
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
    return v.toFixed(0);
  };

  const provenance = useMemo(() => makeProvenance('SEC EDGAR XBRL', 'LIVE', 'USD'), []);
  const forwardProvenance = useMemo(() => makeProvenance('No consensus provider', 'UNAVAILABLE', 'USD', {
    entitlementRequired: 'Licensed forward estimates (Refinitiv / FactSet / Visible Alpha)',
  }), []);

  // Forward columns: next 4 periods after latest quarter (labels only)
  const forwardCols = useMemo(() => ['FY+1', 'FY+2', 'NTM'], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font)', fontSize: 10.5 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>EM · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        <button onClick={() => setExpanded((v) => !v)} style={{ fontSize: 9, padding: '1px 6px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
          {expanded ? 'COLLAPSE QUARTERS' : 'EXPAND QUARTERS'}
        </button>
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {loading && <div style={{ padding: 8, color: 'var(--text-dim)' }}>LOADING MATRIX…</div>}
      {error && <div style={{ padding: 8, color: 'var(--negative)', fontSize: 10 }}>{error.toUpperCase()} — no SEC XBRL facts.</div>}

      {!loading && !error && rows.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)' }}>
                <th rowSpan={2} style={{ textAlign: 'left', padding: '3px 6px', fontSize: 9, color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)', minWidth: 100 }}>METRIC</th>
                <th colSpan={annualPeriods.length} style={{ padding: '2px 4px', fontSize: 8, color: 'var(--accent)', borderBottom: '1px solid var(--border-soft)', letterSpacing: 0.5 }}>ANNUAL (ACTUAL)</th>
                {expanded && <th colSpan={quarterPeriods.length} style={{ padding: '2px 4px', fontSize: 8, color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)', letterSpacing: 0.5 }}>QUARTERLY (ACTUAL)</th>}
                <th colSpan={forwardCols.length} style={{ padding: '2px 4px', fontSize: 8, color: 'var(--text-faint)', borderBottom: '1px solid var(--border-soft)', letterSpacing: 0.5 }}>FORWARD (CONSENSUS)</th>
              </tr>
              <tr style={{ position: 'sticky', top: 17, background: 'var(--surface-raised)' }}>
                {annualPeriods.map((p) => <th key={p} style={{ padding: '2px 4px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, borderBottom: '1px solid var(--border-soft)' }}>{p}</th>)}
                {expanded && quarterPeriods.map((p) => <th key={p} style={{ padding: '2px 4px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, borderBottom: '1px solid var(--border-soft)' }}>{p}</th>)}
                {forwardCols.map((p) => <th key={p} style={{ padding: '2px 4px', fontSize: 9, color: 'var(--text-faint)', fontWeight: 400, borderBottom: '1px dashed var(--border-soft)' }}>{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.metric} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                  <td style={{ padding: '2px 6px', color: 'var(--text-bright)', fontWeight: 600 }}>{row.metric}</td>
                  {annualPeriods.map((p) => (
                    <td key={p} style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--text-bright)', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.annual[p] ?? null, row.metric)}</td>
                  ))}
                  {expanded && quarterPeriods.map((p) => (
                    <td key={p} style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.quarters[p] ?? null, row.metric)}</td>
                  ))}
                  {forwardCols.map((p) => (
                    <td key={p} title="Requires licensed consensus provider" style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--text-faint)', background: 'rgba(255,255,255,0.015)' }}>—</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '4px 8px', fontSize: 8, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Historical: SEC EDGAR XBRL actuals</span>
            <ProvenanceBadge provenance={forwardProvenance} compact suffix="forward" />
          </div>
        </div>
      )}
      {!loading && !error && rows.length === 0 && <div style={{ padding: 8, color: 'var(--text-dim)' }}>NO MATRIX DATA</div>}
    </div>
  );
}
