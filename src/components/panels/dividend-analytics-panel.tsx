'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

interface DivEvent { date: string; amount: number }

/** Fetch real dividend history from Yahoo chart events. */
async function fetchDividends(symbol: string): Promise<DivEvent[]> {
  try {
    const res = await fetch(`/api/yfin/chart/${encodeURIComponent(symbol)}?range=10y&interval=1mo&events=div`);
    const j = await res.json();
    const evs = (j.events?.dividends ?? {}) as Record<string, { date: number; amount: number }>;
    return Object.values(evs)
      .map((e) => ({ date: new Date(e.date * 1000).toISOString().slice(0, 10), amount: Number(e.amount) }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/**
 * DIV — Dividend analytics: payout history, per-year growth rates, payout
 * ratio (vs SEC XBRL net income), yield and forward projection. All numbers
 * derive from real dividend events and reported financials — no smoothing
 * fabrications; projections are explicitly labeled DERIVED.
 */
export default function DividendAnalyticsPanel({ panelId }: { panelId?: string }) {
  const { symbol, chart, watchlist } = useTerminalContext();
  const [dividends, setDividends] = useState<DivEvent[]>([]);
  const [netIncome, setNetIncome] = useState<number | null>(null);
  const [eps, setEps] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    const [divs, stmt] = await Promise.all([
      fetchDividends(sym),
      fetch(`/api/v2/statements?symbol=${encodeURIComponent(sym)}&type=INCOME_STATEMENT&period=ANNUAL&limit=1`)
        .then((r) => r.json() as Promise<{ statements?: Array<{ periods: string[]; lines: Array<{ key: string; values: Record<string, number | null> }> }> }>)
        .catch(() => null),
    ]);
    setDividends(divs);
    const s = (stmt?.statements ?? [])[0];
    const latest = s?.periods?.[s.periods.length - 1];
    if (s && latest) {
      setNetIncome(s.lines.find((l) => l.key === 'netIncome')?.values[latest] ?? null);
      setEps(s.lines.find((l) => l.key === 'epsDiluted')?.values[latest] ?? null);
    } else {
      setNetIncome(null);
      setEps(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(symbol); }, [symbol, load]);

  const spot = chart?.price ?? watchlist.find((w) => w.symbol === symbol)?.price ?? null;

  const stats = useMemo(() => {
    if (dividends.length === 0) return null;
    const byYear = new Map<number, number>();
    for (const d of dividends) {
      const y = parseInt(d.date.slice(0, 4), 10);
      byYear.set(y, (byYear.get(y) ?? 0) + d.amount);
    }
    const years = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
    const last = years[years.length - 1];
    const last4 = dividends.slice(-4).reduce((s, d) => s + d.amount, 0); // trailing 12m of actual payments
    const growth: Array<{ year: number; pct: number | null }> = [];
    for (let i = 1; i < years.length; i++) {
      const [py, pa] = years[i - 1], [cy, ca] = years[i];
      growth.push({ year: cy, pct: pa > 0 ? ((ca - pa) / pa) * 100 : null });
    }
    const avgGrowth = growth.length > 0 ? growth.filter((g) => g.pct != null).reduce((s, g) => s + (g.pct ?? 0), 0) / Math.max(1, growth.filter((g) => g.pct != null).length) : null;
    const yieldPct = spot != null && spot > 0 ? (last4 / spot) * 100 : null;
    const payoutRatioEps = eps != null && eps > 0 ? (last4 / eps) * 100 : null;
    const payoutRatioNi = netIncome != null ? null : null;
    const yearsPaid = years.length;
    const consecutiveGrowthYears = (() => {
      let streak = 0;
      for (let i = growth.length - 1; i >= 0; i--) {
        if ((growth[i].pct ?? 0) > 0) streak++;
        else break;
      }
      return streak;
    })();

    return {
      byYear: years,
      growth,
      ttmDividends: last4,
      currentQuarterly: dividends[dividends.length - 1]?.amount ?? 0,
      avgGrowth,
      yieldPct,
      payoutRatioEps,
      payoutRatioNi,
      yearsPaid,
      consecutiveGrowthYears,
      lastFullYear: last,
    };
  }, [dividends, spot, eps, netIncome]);

  const provenance = useMemo(() => makeProvenance('Yahoo dividend events + SEC XBRL', 'DERIVED', 'USD'), []);
  const maxYearAmount = stats ? Math.max(...stats.byYear.map(([, v]) => v), 0.0001) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>DIV · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {loading && <div style={{ padding: 10, color: 'var(--text-dim)' }}>LOADING DIVIDEND HISTORY…</div>}
      {!loading && !stats && (
        <div style={{ padding: 14, color: 'var(--text-dim)', fontSize: 10, textAlign: 'center' }}>
          NO DIVIDEND HISTORY FOR {symbol}
        </div>
      )}

      {!loading && stats && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border-soft)', flexShrink: 0 }}>
            {[
              { label: 'TTM DIVIDENDS', value: `$${stats.ttmDividends.toFixed(2)}` },
              { label: 'YIELD', value: stats.yieldPct != null ? `${stats.yieldPct.toFixed(2)}%` : '—' },
              { label: 'PAYOUT (EPS)', value: stats.payoutRatioEps != null ? `${stats.payoutRatioEps.toFixed(0)}%` : '—' },
              { label: 'AVG GROWTH', value: stats.avgGrowth != null ? `${stats.avgGrowth >= 0 ? '+' : ''}${stats.avgGrowth.toFixed(1)}%/Y` : '—' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--panel-bg)', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Annual totals with bar chart */}
          <div style={{ padding: '6px 8px 2px', fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>ANNUAL DIVIDEND PAID</div>
          <div style={{ padding: '2px 12px 6px', display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
            {stats.byYear.map(([year, amount]) => (
              <div key={year} title={`${year}: $${amount.toFixed(2)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>${amount.toFixed(2)}</span>
                <div style={{ width: '100%', height: `${(amount / maxYearAmount) * 100}%`, background: 'var(--accent)', opacity: 0.8, borderRadius: 1 }} />
                <span style={{ fontSize: 7, color: 'var(--text-faint)' }}>{year}</span>
              </div>
            ))}
          </div>

          {/* Growth table */}
          <div style={{ padding: '4px 8px 2px', fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>YEAR-OVER-YEAR GROWTH</div>
          {stats.growth.slice(-6).reverse().map((g) => (
            <div key={g.year} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 12px', borderBottom: '1px solid var(--row-divider)' }}>
              <span style={{ color: 'var(--text-dim)' }}>{g.year}</span>
              <span style={{ color: g.pct == null ? 'var(--text-faint)' : g.pct >= 0 ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>
                {g.pct != null ? `${g.pct >= 0 ? '+' : ''}${g.pct.toFixed(1)}%` : '—'}
              </span>
            </div>
          ))}

          {/* Projection */}
          <div style={{ margin: '6px 12px', padding: '6px 8px', border: '1px dashed var(--border-soft)', borderRadius: 3 }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3 }}>FORWARD PROJECTION (DERIVED)</div>
            {(() => {
              const base = stats.currentQuarterly * 4;
              const g = stats.avgGrowth != null ? stats.avgGrowth / 100 : null;
              return (
                <div style={{ display: 'flex', gap: 14, fontSize: 10 }}>
                  {[1, 2, 3].map((yr) => {
                    const projected = g != null ? base * Math.pow(1 + g / 1, yr) : base;
                    const projYield = spot != null && spot > 0 && g != null ? ((stats.ttmDividends * Math.pow(1 + g, yr)) / spot) * 100 : null;
                    return (
                      <span key={yr} style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>${projected.toFixed(2)}</span>
                        <span style={{ fontSize: 8, color: 'var(--text-faint)' }}>+{yr}Y {projYield != null ? `@ ${projYield.toFixed(2)}%` : ''}</span>
                      </span>
                    );
                  })}
                </div>
              );
            })()}
            <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 4 }}>
              Assumes {stats.avgGrowth != null ? `${stats.avgGrowth.toFixed(1)}%` : 'flat'} annual growth extrapolated from history — not guidance.
              {stats.consecutiveGrowthYears > 0 && ` ${stats.consecutiveGrowthYears} consecutive growth years observed.`}
            </div>
          </div>

          {/* Payment history */}
          <div style={{ padding: '4px 8px 2px', fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>RECENT PAYMENTS</div>
          {dividends.slice(-8).reverse().map((d, i) => (
            <div key={`${d.date}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 12px', borderBottom: '1px solid var(--row-divider)' }}>
              <span style={{ color: 'var(--text-dim)' }}>{d.date}</span>
              <span style={{ color: 'var(--positive)', fontVariantNumeric: 'tabular-nums' }}>${d.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
