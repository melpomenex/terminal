'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import type { StandardizedStatement } from '@/lib/providers/contracts';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import type { DataProvenance } from '@/lib/types/provenance';

type StatementTab = 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';
type PeriodToggle = 'ANNUAL' | 'QUARTERLY' | 'TTM';

function fmtValue(v: number | null | undefined, currencyScale = true): string {
  if (v == null || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (!currencyScale) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(2);
}

function isRatioLine(key: string): boolean {
  return key.startsWith('eps') || key === 'sharesDiluted';
}

/** YoY growth % between consecutive period values. */
function growthLabel(current: number | null, previous: number | null): string | null {
  if (current == null || previous == null || previous === 0) return null;
  const g = ((current - previous) / Math.abs(previous)) * 100;
  return `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`;
}

/**
 * FA — Financial Analysis: multi-period Income Statement, Balance Sheet and
 * Cash Flow with annual/quarterly/TTM toggles, YoY deltas and common-size
 * mode. Backed by the v2 statements API (SEC EDGAR XBRL normalization).
 */
export default function FinancialAnalysisPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [tab, setTab] = useState<StatementTab>('INCOME_STATEMENT');
  const [periodMode, setPeriodMode] = useState<PeriodToggle>('ANNUAL');
  const [statement, setStatement] = useState<StandardizedStatement | null>(null);
  const [provenance, setProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commonSize, setCommonSize] = useState(false);

  const load = useCallback(async (sym: string, type: StatementTab, period: PeriodToggle) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=${type}&period=${period}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStatement((json.statements ?? [])[0] ?? null);
      setProvenance(json.provenance ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
      setStatement(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(symbol, tab, periodMode); }, [symbol, tab, periodMode, load]);

  const periods = statement?.periods ?? [];

  const rows = useMemo(() => {
    if (!statement) return [];
    return statement.lines.map((line) => {
      const cells = periods.map((p) => {
        const v = line.values[p] ?? null;
        if (v == null) return { value: null as number | null, display: '—', growth: null as string | null };
        let display: string;
        if (commonSize && line.percentOf) {
          const base = statement.lines.find((l) => l.key === line.percentOf)?.values[p];
          display = base ? `${((v / base) * 100).toFixed(1)}%` : '—';
        } else {
          display = fmtValue(v, !isRatioLine(line.key));
        }
        const idx = periods.indexOf(p);
        const prevP = periods[idx - 1];
        const prev = prevP ? line.values[prevP] ?? null : null;
        return { value: v, display, growth: growthLabel(v, prev) };
      });
      return { line, cells };
    });
  }, [statement, periods, commonSize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>FA · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        <div style={{ display: 'flex', gap: 2 }}>
          {([['INCOME_STATEMENT', 'INCOME'], ['BALANCE_SHEET', 'BALANCE'], ['CASH_FLOW', 'CASH FLOW']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{ fontSize: 9, padding: '1px 7px', border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border-soft)'}`, background: tab === t ? 'var(--accent-soft)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, marginLeft: 6 }}>
          {(['ANNUAL', 'QUARTERLY', 'TTM'] as const).map((p) => (
            <button key={p} onClick={() => setPeriodMode(p)} style={{ fontSize: 9, padding: '1px 7px', border: `1px solid ${periodMode === p ? 'var(--accent)' : 'var(--border-soft)'}`, background: periodMode === p ? 'var(--accent-soft)' : 'transparent', color: periodMode === p ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>{p}</button>
          ))}
        </div>
        <button onClick={() => setCommonSize((v) => !v)} title="Common-size: each line as % of revenue / assets" style={{ fontSize: 9, padding: '1px 7px', border: `1px solid ${commonSize ? 'var(--accent)' : 'var(--border-soft)'}`, background: commonSize ? 'var(--accent-soft)' : 'transparent', color: commonSize ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>
          {commonSize ? 'COMMON-SIZE' : 'ABSOLUTE'}
        </button>
        <span style={{ marginLeft: 'auto' }}>{provenance && <ProvenanceBadge provenance={provenance} compact />}</span>
      </div>

      {/* Body */}
      {loading && <div style={{ padding: 12, color: 'var(--text-dim)' }}>LOADING {tab.replace('_', ' ')} · SEC XBRL…</div>}
      {error && (
        <div style={{ padding: 12, color: 'var(--negative)', fontSize: 10 }}>
          {error.toUpperCase()} — no SEC XBRL facts available for {symbol} (foreign filers and funds often lack us-gaap facts).
        </div>
      )}
      {!loading && !error && statement && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)', minWidth: 150 }}>
                  {statement.currency} {commonSize ? '% OF BASE' : statement.periodType === 'ANNUAL' ? 'FY' : 'PERIOD'}
                </th>
                {periods.map((p) => (
                  <th key={p} style={{ textAlign: 'right', padding: '4px 8px', fontSize: 9, color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)' }}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ line, cells }) => (
                <tr key={line.key} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                  <td style={{ padding: '3px 8px', paddingLeft: 8 + (line.indent ?? 0) * 12, color: line.key === 'revenue' || line.key === 'netIncome' || line.key === 'totalAssets' || line.key === 'equity' || line.key === 'fcf' ? 'var(--text-bright)' : 'var(--text-dim)', fontWeight: ['revenue', 'grossProfit', 'operatingIncome', 'netIncome', 'totalAssets', 'totalLiabilities', 'equity', 'cfo', 'fcf'].includes(line.key) ? 700 : 400 }}>
                    {line.label}
                  </td>
                  {cells.map((c, i) => (
                    <td key={i} style={{ textAlign: 'right', padding: '3px 8px', color: c.value == null ? 'var(--text-faint)' : 'var(--text-bright)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} title={c.growth ? `YoY ${c.growth}` : undefined}>
                      {c.display}{c.growth && <span style={{ color: c.growth.startsWith('+') ? 'var(--positive)' : 'var(--negative)', fontSize: 8, marginLeft: 4 }}>{c.growth}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '4px 8px', fontSize: 8, color: 'var(--text-faint)' }}>
            Source: SEC EDGAR XBRL companyfacts · values as reported under US-GAAP · growth = period-over-period
          </div>
        </div>
      )}
    </div>
  );
}
