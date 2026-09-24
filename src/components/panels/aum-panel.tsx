'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { storageManager } from '@/lib/persistence/storage-manager';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

interface AumSnapshot {
  date: string;   // YYYY-MM-DD
  marketValue: number;
  costBasis: number;
}

const PALETTE = ['#FFB000', '#00b050', '#4d9fff', '#ff4dd2', '#4df3ff', '#ffb000', '#ef4444', '#60a5fa', '#f97316', '#c084fc'];

function loadSnapshots(): AumSnapshot[] {
  try { return JSON.parse(localStorage.getItem('blm_aum_history') ?? '[]'); } catch { return []; }
}
function saveSnapshots(s: AumSnapshot[]): void {
  try { localStorage.setItem('blm_aum_history', JSON.stringify(s.slice(-400))); } catch {}
}

/**
 * AUM — Account analytics: historical assets-under-management curve (one
 * valuation snapshot per day, captured from live portfolio marks) and
 * allocation breakdown. History only exists from the first day the terminal
 * recorded a mark — no synthetic backfill.
 */
export default function AumPanel({ panelId }: { panelId?: string }) {
  const { portfolioPositions, watchlist } = useTerminalContext();
  const [snapshots, setSnapshots] = useState<AumSnapshot[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});

  const symbols = useMemo(() => [...new Set(portfolioPositions.map((p) => p.symbol))], [portfolioPositions]);

  // Price all holdings
  useEffect(() => {
    if (symbols.length === 0) return;
    const onWl = new Map(watchlist.map((w) => [w.symbol, w.price]));
    const missing = symbols.filter((s) => onWl.get(s) == null);
    if (missing.length === 0) {
      setPrices(Object.fromEntries(symbols.map((s) => [s, onWl.get(s) ?? 0]).filter(([, v]) => v != null)));
      return;
    }
    fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(missing.join(','))}`)
      .then((r) => r.json())
      .then((d) => {
        const m: Record<string, number> = {};
        for (const item of (d.items ?? []) as Array<{ symbol: string; price: number | null }>) if (item.price != null) m[item.symbol] = item.price;
        for (const s of symbols) { const wl = onWl.get(s); if (wl != null) m[s] = wl; }
        setPrices(m);
      })
      .catch(() => {});
  }, [symbols, watchlist]);

  const current = useMemo(() => {
    let mv = 0, cost = 0;
    const bySymbol = new Map<string, number>();
    for (const p of portfolioPositions) {
      const price = prices[p.symbol];
      if (price != null) {
        mv += price * p.quantity;
        bySymbol.set(p.symbol, (bySymbol.get(p.symbol) ?? 0) + price * p.quantity);
      }
      cost += p.costBasis * p.quantity;
    }
    return { mv, cost, bySymbol: [...bySymbol.entries()].sort((a, b) => b[1] - a[1]) };
  }, [portfolioPositions, prices]);

  // Record one snapshot per day (idempotent upsert)
  const recordSnapshot = useCallback((mv: number, cost: number) => {
    if (mv <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const existing = loadSnapshots();
    const next = existing.filter((s) => s.date !== today);
    next.push({ date: today, marketValue: mv, costBasis: cost });
    next.sort((a, b) => a.date.localeCompare(b.date));
    saveSnapshots(next);
    setSnapshots(next);
  }, []);

  useEffect(() => {
    if (current.mv > 0) recordSnapshot(current.mv, current.cost);
    else setSnapshots(loadSnapshots());
  }, [current.mv, current.cost, recordSnapshot]);

  const provenance = useMemo(() => makeProvenance('Daily portfolio marks (local)', 'DERIVED', 'USD'), []);

  const totalMv = current.mv || 1;
  const maxMv = Math.max(...snapshots.map((s) => s.marketValue), totalMv, 1);
  const minMv = Math.min(...snapshots.map((s) => s.marketValue), totalMv, totalMv * 0.95);
  const range = maxMv - minMv || 1;
  const yOf = (v: number) => 100 - ((v - minMv) / range) * 92 - 4;

  const first = snapshots[0];
  const allTimePnl = first ? current.mv - first.marketValue : 0;
  const allTimePct = first && first.marketValue > 0 ? (allTimePnl / first.marketValue) * 100 : 0;

  // Allocation pie geometry
  let angle = -Math.PI / 2;
  const slices = current.bySymbol.slice(0, 10).map(([sym, mv], i) => {
    const frac = mv / totalMv;
    const a0 = angle;
    angle += frac * Math.PI * 2;
    const a1 = angle;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (r: number, a: number) => `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
    return { sym, mv, frac, color: PALETTE[i % PALETTE.length], path: `M ${p(50, a0)} A 50 50 0 ${large} 1 ${p(50, a1)} L 50 50 Z` };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>AUM · ACCOUNT ANALYTICS</span>
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border-soft)', flexShrink: 0 }}>
        {[
          { l: 'MARKET VALUE', v: `$${current.mv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, c: 'var(--text-bright)' },
          { l: 'COST BASIS', v: `$${current.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, c: 'var(--text-dim)' },
          { l: 'UNRL P&L', v: current.mv > 0 ? `${current.mv - current.cost >= 0 ? '+' : ''}$${(current.mv - current.cost).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—', c: current.mv - current.cost >= 0 ? 'var(--positive)' : 'var(--negative)' },
          { l: first ? `SINCE ${first.date}` : 'HISTORY', v: first ? `${allTimePnl >= 0 ? '+' : ''}${allTimePct.toFixed(1)}%` : 'STARTING', c: allTimePnl >= 0 ? 'var(--positive)' : 'var(--negative)' },
        ].map((m) => (
          <div key={m.l} style={{ background: 'var(--panel-bg)', padding: '5px 8px' }}>
            <div style={{ fontSize: 7.5, color: 'var(--text-dim)' }}>{m.l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: m.c, fontVariantNumeric: 'tabular-nums' }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* AUM curve */}
      <div style={{ padding: '6px 10px 2px', fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>HISTORICAL AUM</div>
      <svg viewBox="0 0 300 100" style={{ width: '100%', height: 84, background: 'var(--surface-sunken)', margin: '0 10px', borderRadius: 3, maxWidth: 'calc(100% - 20px)' }}>
        {snapshots.length > 1 ? (
          <>
            <polyline
              points={snapshots.map((s, i) => `${(i / (snapshots.length - 1)) * 300},${yOf(s.marketValue)}`).join(' ')}
              fill="none" stroke="var(--accent)" strokeWidth={1.5}
            />
            {/* current point */}
            <circle cx={300} cy={yOf(totalMv)} r={2.4} fill="var(--accent)" />
          </>
        ) : (
          <text x={150} y={52} textAnchor="middle" fontSize={8} fill="var(--text-faint)">
            {snapshots.length === 1 ? 'First mark recorded today — curve builds daily' : 'No marks recorded yet'}
          </text>
        )}
      </svg>
      {snapshots.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 12px', fontSize: 8, color: 'var(--text-faint)' }}>
          <span>{snapshots[0].date}</span>
          <span>{snapshots[snapshots.length - 1].date} · {snapshots.length} marks</span>
        </div>
      )}

      {/* Allocation */}
      <div style={{ padding: '8px 10px 2px', fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>ALLOCATION</div>
      <div style={{ display: 'flex', gap: 12, padding: '2px 12px 10px', flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
        {slices.length > 0 ? (
          <>
            <svg viewBox="0 0 100 100" style={{ width: 92, height: 92, flexShrink: 0 }}>
              {slices.map((s) => <path key={s.sym} d={s.path} fill={s.color} stroke="var(--panel-bg)" strokeWidth={0.6} />)}
            </svg>
            <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
              {slices.map((s) => (
                <div key={s.sym} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10 }}>
                  <span style={{ width: 8, height: 8, background: s.color, borderRadius: 1 }} />
                  <span style={{ color: 'var(--text-bright)', fontWeight: 700, minWidth: 46 }}>{s.sym}</span>
                  <span style={{ color: 'var(--text-dim)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{(s.frac * 100).toFixed(1)}%</span>
                  <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>${s.mv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>No priced holdings — add positions to track allocation.</span>
        )}
      </div>

      <div style={{ padding: '2px 10px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)', flexShrink: 0 }}>
        ONE MARK PER DAY FROM LIVE PORTFOLIO VALUATIONS · NO SYNTHETIC HISTORY
      </div>
    </div>
  );
}
