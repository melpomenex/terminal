'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import type { StandardizedStatement } from '@/lib/providers/contracts';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

interface QuarterRow {
  period: string;
  epsActual: number | null;
  revenueActual: number | null;
  netIncome: number | null;
  yoyEpsGrowth: number | null;
  yoyRevenueGrowth: number | null;
}

/**
 * ERN — Earnings: historical quarterly EPS / revenue actuals with YoY growth
 * and beat/miss context. Actuals come from SEC EDGAR XBRL (always real).
 * Consensus estimates require a licensed provider; until one is configured
 * those columns are explicitly marked UNAVAILABLE rather than estimated.
 */
export default function EarningsPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [statement, setStatement] = useState<StandardizedStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=INCOME_STATEMENT&period=QUARTERLY&limit=8`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStatement((json.statements ?? [])[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
      setStatement(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(symbol); }, [symbol, load]);

  const rows = useMemo<QuarterRow[]>(() => {
    if (!statement) return [];
    const get = (p: string, key: string) => statement.lines.find((l) => l.key === key)?.values[p] ?? null;
    const periods = statement.periods;
    return periods.map((p) => {
      const eps = get(p, 'epsDiluted');
      const rev = get(p, 'revenue');
      // YoY = compare against the quarter 4 slots back
      const idx = periods.indexOf(p);
      const yearAgo = idx >= 4 ? periods[idx - 4] : null;
      const epsPrev = yearAgo ? get(yearAgo, 'epsDiluted') : null;
      const revPrev = yearAgo ? get(yearAgo, 'revenue') : null;
      return {
        period: p,
        epsActual: eps,
        revenueActual: rev,
        netIncome: get(p, 'netIncome'),
        yoyEpsGrowth: eps != null && epsPrev != null && epsPrev !== 0 ? ((eps - epsPrev) / Math.abs(epsPrev)) * 100 : null,
        yoyRevenueGrowth: rev != null && revPrev != null && revPrev !== 0 ? ((rev - revPrev) / Math.abs(revPrev)) * 100 : null,
      };
    }).reverse();
  }, [statement]);

  const beats = rows.filter((r) => (r.yoyEpsGrowth ?? 0) > 0).length;
  const misses = rows.filter((r) => (r.yoyEpsGrowth ?? 0) < 0).length;
  const provenance = useMemo(() => makeProvenance('SEC EDGAR XBRL (10-Q EPS/revenue)', 'LIVE', 'USD'), []);
  const estimatesUnavailable = useMemo(() => makeProvenance('No consensus provider', 'UNAVAILABLE', 'USD', {
    entitlementRequired: 'Licensed consensus estimates (e.g. Refinitiv, FactSet, Zacks)',
  }), []);

  const fmtBig = (v: number | null): string => {
    if (v == null) return '—';
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    return `${sign}$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font)' }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-bright)' }}>ERN · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{rows.length} QUARTERS · {beats}↑ {misses}↓ YoY</span>
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {loading && <div style={{ padding: 8, color: 'var(--text-dim)' }}>LOADING EARNINGS…</div>}
      {error && <div style={{ padding: 8, color: 'var(--negative)', fontSize: 10 }}>{error.toUpperCase()} — no SEC quarterly XBRL facts.</div>}

      {!loading && !error && rows.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '84px repeat(5, 1fr)', borderBottom: '1px solid var(--border-light)', fontSize: 10, color: 'var(--text-dim)', padding: '3px 6px', flexShrink: 0 }}>
            <span>PERIOD</span>
            <span style={{ textAlign: 'right' }}>EPS ACT</span>
            <span style={{ textAlign: 'right' }} title="Consensus estimate — requires licensed provider">EPS EST*</span>
            <span style={{ textAlign: 'right' }}>EPS YoY</span>
            <span style={{ textAlign: 'right' }}>REVENUE</span>
            <span style={{ textAlign: 'right' }}>REV YoY</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {rows.map((r) => (
              <div key={r.period} style={{ display: 'grid', gridTemplateColumns: '84px repeat(5, 1fr)', borderBottom: '1px solid rgba(51,34,0,0.3)', fontSize: 11, padding: '2px 6px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{r.period}</span>
                <span style={{ textAlign: 'right', color: 'var(--text-bright)', fontVariantNumeric: 'tabular-nums' }}>{r.epsActual != null ? r.epsActual.toFixed(2) : '—'}</span>
                <span style={{ textAlign: 'right', color: 'var(--text-faint)' }} title="No consensus provider configured">—</span>
                <span style={{ textAlign: 'right', color: r.yoyEpsGrowth == null ? 'var(--text-faint)' : r.yoyEpsGrowth >= 0 ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>
                  {r.yoyEpsGrowth != null ? `${r.yoyEpsGrowth >= 0 ? '+' : ''}${r.yoyEpsGrowth.toFixed(1)}%` : '—'}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmtBig(r.revenueActual)}</span>
                <span style={{ textAlign: 'right', color: r.yoyRevenueGrowth == null ? 'var(--text-faint)' : r.yoyRevenueGrowth >= 0 ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>
                  {r.yoyRevenueGrowth != null ? `${r.yoyRevenueGrowth >= 0 ? '+' : ''}${r.yoyRevenueGrowth.toFixed(1)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ padding: '3px 8px', fontSize: 9, color: 'var(--text-faint)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>* EST columns</span>
            <ProvenanceBadge provenance={estimatesUnavailable} compact />
            <span style={{ marginLeft: 'auto' }}>ACTUALS: SEC XBRL 10-Q</span>
          </div>
        </>
      )}
      {!loading && !error && rows.length === 0 && <div style={{ padding: 8, color: 'var(--text-dim)' }}>NO QUARTERLY XBRL DATA</div>}
    </div>
  );
}
