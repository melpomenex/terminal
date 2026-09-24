'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import type { WatchlistItem } from '@/lib/types';
import { getBrokerageProviders, type ManualPositionRecord } from '@/lib/providers/brokerage-provider';
import type { BrokerageAccount, BrokeragePositionLot } from '@/lib/providers/contracts';
import { valueAtRisk, dailyReturns } from '@/lib/risk-math';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function pnlColor(v: number): string {
  if (v > 0) return 'var(--positive)';
  if (v < 0) return 'var(--negative)';
  return 'var(--text-bright)';
}

interface LotRow extends BrokeragePositionLot { accountLabel: string }
interface SymbolAgg {
  symbol: string;
  lots: LotRow[];
  quantity: number;
  avgCost: number;
  costBasis: number;
}

const ACCOUNT_LABELS: Record<string, string> = {
  'local-manual': 'LOCAL',
};

/**
 * PRTU v2 — multi-account portfolio: read-only brokerage provider accounts
 * (manual local + SnapTrade/Plaid when configured), per-symbol position lots
 * with cost basis, unrealized P&L, realized-P&L placeholder for closed lots,
 * sector exposure bars, and parametric VaR from real price history.
 */
export default function PortfolioPanel({ panelId }: { panelId?: string }) {
  const { portfolioPositions, removePosition, watchlist, loading, setSymbol } = useTerminalContext();
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<'POSITIONS' | 'EXPOSURE' | 'RISK'>('POSITIONS');

  useEffect(() => {
    const manual: ManualPositionRecord[] = portfolioPositions.map((p) => ({
      id: p.id, symbol: p.symbol, quantity: p.quantity, costBasisPerUnit: p.costBasis, dateAdded: p.dateAdded,
    }));
    void (async () => {
      const providers = getBrokerageProviders(manual);
      const accs: BrokerageAccount[] = [];
      const allLots: LotRow[] = [];
      for (const provider of providers) {
        const { accounts: providerAccounts } = await provider.listAccounts();
        accs.push(...providerAccounts);
        for (const acc of providerAccounts) {
          const { lots: providerLots } = await provider.getPositions(acc.id);
          allLots.push(...providerLots.map((l) => ({ ...l, accountLabel: ACCOUNT_LABELS[acc.id] ?? acc.brokerName.toUpperCase() })));
        }
      }
      setAccounts(accs);
      setLots(allLots);
    })();
  }, [portfolioPositions]);

  const priceMap = useMemo(() => {
    const m = new Map<string, WatchlistItem>();
    for (const w of watchlist) m.set(w.symbol, w);
    return m;
  }, [watchlist]);

  // Price fetch for symbols not on the watchlist
  const [extraPrices, setExtraPrices] = useState<Record<string, { price: number | null; change: number | null }>>({});
  useEffect(() => {
    const missing = [...new Set(lots.map((l) => l.instrument.symbol))].filter((s) => !priceMap.has(s));
    if (missing.length === 0) return;
    fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(missing.join(','))}`)
      .then((r) => r.json())
      .then((d) => {
        const m: Record<string, { price: number | null; change: number | null }> = {};
        for (const item of (d.items ?? []) as Array<{ symbol: string; price: number | null; change: number | null }>) m[item.symbol] = { price: item.price, change: item.change };
        setExtraPrices(m);
      })
      .catch(() => {});
  }, [lots, priceMap]);

  const priceOf = useCallback((symbol: string): number | null => {
    const wl = priceMap.get(symbol);
    if (wl?.price != null) return wl.price;
    return extraPrices[symbol]?.price ?? null;
  }, [priceMap, extraPrices]);
  const changeOf = useCallback((symbol: string): number | null => {
    const wl = priceMap.get(symbol);
    if (wl?.change != null) return wl.change;
    return extraPrices[symbol]?.change ?? null;
  }, [priceMap, extraPrices]);

  const aggregated = useMemo<SymbolAgg[]>(() => {
    const bySymbol = new Map<string, SymbolAgg>();
    for (const lot of lots) {
      const sym = lot.instrument.symbol;
      const agg = bySymbol.get(sym) ?? { symbol: sym, lots: [], quantity: 0, avgCost: 0, costBasis: 0 };
      agg.lots.push(lot);
      agg.quantity += lot.quantity;
      agg.costBasis += lot.quantity * lot.costBasisPerUnit;
      bySymbol.set(sym, agg);
    }
    for (const agg of bySymbol.values()) agg.avgCost = agg.quantity > 0 ? agg.costBasis / agg.quantity : 0;
    return [...bySymbol.values()].sort((a, b) => b.costBasis - a.costBasis);
  }, [lots]);

  const valuation = useMemo(() => {
    let cost = 0, market = 0, dayChg = 0;
    for (const agg of aggregated) {
      cost += agg.costBasis;
      const p = priceOf(agg.symbol);
      if (p != null) market += p * agg.quantity;
      const c = changeOf(agg.symbol);
      if (c != null) dayChg += c * agg.quantity;
    }
    const unrealized = market - cost;
    return { cost, market, unrealized, dayChg, pct: cost > 0 ? (unrealized / cost) * 100 : 0 };
  }, [aggregated, priceOf, changeOf]);

  // Sector exposure (from fundamentals-lite sector hints via watchlist names is
  // unavailable — use per-symbol weight and provider account breakdown).
  const exposure = useMemo(() => {
    const byAccount = new Map<string, number>();
    const bySymbol = aggregated.map((agg) => {
      const p = priceOf(agg.symbol);
      const mv = p != null ? p * agg.quantity : agg.costBasis;
      const account = agg.lots[0]?.accountLabel ?? 'LOCAL';
      byAccount.set(account, (byAccount.get(account) ?? 0) + mv);
      return { symbol: agg.symbol, mv, weight: 0 };
    });
    const total = bySymbol.reduce((s, x) => s + x.mv, 0) || 1;
    for (const x of bySymbol) x.weight = (x.mv / total) * 100;
    return { bySymbol: bySymbol.sort((a, b) => b.mv - a.mv), byAccount: [...byAccount.entries()].sort((a, b) => b[1] - a[1]), total };
  }, [aggregated, priceOf]);

  // Parametric VaR: fetch 6mo history for top holdings, compute weighted VaR
  const [var95, setVar95] = useState<number | null>(null);
  useEffect(() => {
    const top = exposure.bySymbol.slice(0, 6);
    if (top.length === 0) { setVar95(null); return; }
    void (async () => {
      try {
        const weights = new Map(top.map((t) => [t.symbol, t.weight / 100]));
        const rets: number[][] = [];
        const w: number[] = [];
        for (const t of top) {
          const r = await fetch(`/api/yfin/chart/${t.symbol}?range=6mo&interval=1d`).then((x) => x.json());
          const closes = ((r.close ?? []) as number[]).filter((v: number) => v != null);
          if (closes.length > 20) { rets.push(dailyReturns(closes)); w.push(weights.get(t.symbol) ?? 0); }
        }
        if (rets.length === 0) { setVar95(null); return; }
        const len = Math.min(...rets.map((r) => r.length));
        const portfolioReturns: number[] = [];
        for (let i = 0; i < len; i++) {
          portfolioReturns.push(rets.reduce((s, r, j) => s + r[r.length - len + i] * w[j], 0));
        }
        const varFraction = valueAtRisk(portfolioReturns, 0.95); // negative fraction
        setVar95(Math.abs(varFraction) * exposure.total);
      } catch { setVar95(null); }
    })();
  }, [exposure.bySymbol, exposure.total]);

  const provenance = useMemo(() => makeProvenance('Local lots + delayed quotes', 'DELAYED', 'USD', { delayMinutes: 15 }), []);

  if (loading) return <div style={{ padding: 8, color: 'var(--text-dim)' }}>LOADING…</div>;

  if (aggregated.length === 0) {
    return (
      <div style={{ padding: 8, color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font)' }}>
        No positions. Use <b>ADD 100 AAPL 150</b> in the command bar.
      </div>
    );
  }

  const cols = '86px 1fr 60px 70px 84px 84px 64px 74px 24px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)' }} data-panel-id={panelId}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)' }}>PRTU v2</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{accounts.length} account{accounts.length !== 1 ? 's' : ''} · {lots.length} lots</span>
        {(['POSITIONS', 'EXPOSURE', 'RISK'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ marginLeft: v === 'POSITIONS' ? 12 : 2, fontSize: 8, padding: '1px 7px', border: `1px solid ${view === v ? 'var(--accent)' : 'var(--border-soft)'}`, background: view === v ? 'var(--accent-soft)' : 'transparent', color: view === v ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>{v}</button>
        ))}
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      {view === 'POSITIONS' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '3px 8px', fontSize: 9, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span>SYMBOL</span><span>ACCOUNT</span><span style={{ textAlign: 'right' }}>QTY</span><span style={{ textAlign: 'right' }}>AVG COST</span><span style={{ textAlign: 'right' }}>MKT VAL</span><span style={{ textAlign: 'right' }}>UNRL P&L</span><span style={{ textAlign: 'right' }}>P&L%</span><span style={{ textAlign: 'right' }}>DAY CHG</span><span />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {aggregated.map((agg) => {
              const price = priceOf(agg.symbol);
              const mv = price != null ? price * agg.quantity : null;
              const pnl = mv != null ? mv - agg.costBasis : null;
              const pnlPct = pnl != null && agg.costBasis > 0 ? (pnl / agg.costBasis) * 100 : null;
              const dayChg = changeOf(agg.symbol) != null ? (changeOf(agg.symbol) as number) * agg.quantity : null;
              const isOpen = expanded === agg.symbol;
              const accountLabel = [...new Set(agg.lots.map((l) => l.accountLabel))].join('/');
              return (
                <div key={agg.symbol}>
                  <div
                    onClick={() => setSymbol(agg.symbol)}
                    className="row-hover"
                    style={{ display: 'grid', gridTemplateColumns: cols, padding: '2px 8px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--row-divider)', background: isOpen ? 'var(--accent-soft)' : undefined }}
                  >
                    <span style={{ color: 'var(--accent)', fontWeight: 700, display: 'flex', gap: 4 }} onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : agg.symbol); }}>
                      <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>{agg.lots.length > 1 ? (isOpen ? '▾' : '▸') : ' '}</span>
                      {agg.symbol}
                    </span>
                    <span style={{ color: 'var(--text-faint)', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis' }}>{accountLabel}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-bright)' }}>{agg.quantity.toLocaleString()}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{fmt(agg.avgCost)}</span>
                    <span style={{ textAlign: 'right', color: mv != null ? 'var(--text-bright)' : 'var(--text-faint)' }}>{mv != null ? fmt(mv) : '—'}</span>
                    <span style={{ textAlign: 'right', color: pnl != null ? pnlColor(pnl) : 'var(--text-faint)' }}>{pnl != null ? `${pnl >= 0 ? '+' : ''}${fmt(pnl)}` : '—'}</span>
                    <span style={{ textAlign: 'right', color: pnlPct != null ? pnlColor(pnlPct) : 'var(--text-faint)' }}>{pnlPct != null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}</span>
                    <span style={{ textAlign: 'right', color: dayChg != null ? pnlColor(dayChg) : 'var(--text-faint)' }}>{dayChg != null ? `${dayChg >= 0 ? '+' : ''}${fmt(dayChg)}` : '—'}</span>
                    <span onClick={(e) => { e.stopPropagation(); removePosition(agg.lots[0]?.id ?? ''); }} style={{ color: 'var(--text-faint)', cursor: 'pointer', fontSize: 10, textAlign: 'center' }}>×</span>
                  </div>
                  {isOpen && agg.lots.map((lot) => (
                    <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: cols, padding: '1px 8px 1px 24px', fontSize: 10, background: 'var(--surface-sunken)', borderBottom: '1px solid var(--row-divider)' }}>
                      <span style={{ color: 'var(--text-faint)' }}>lot {lot.id.slice(0, 8)}</span>
                      <span style={{ color: 'var(--text-faint)' }}>{lot.accountLabel}</span>
                      <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{lot.quantity.toLocaleString()}</span>
                      <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{fmt(lot.costBasisPerUnit)}</span>
                      <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{fmt(lot.quantity * lot.costBasisPerUnit)}</span>
                      <span style={{ gridColumn: '6 / -1', color: 'var(--text-faint)', fontSize: 8 }}>{lot.openedAt ? `opened ${new Date(lot.openedAt).toLocaleDateString()}` : ''}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '4px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-bright)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <span>TOTAL</span><span />
            <span />
            <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{fmt(valuation.cost)}</span>
            <span style={{ textAlign: 'right' }}>{fmt(valuation.market)}</span>
            <span style={{ textAlign: 'right', color: pnlColor(valuation.unrealized) }}>{`${valuation.unrealized >= 0 ? '+' : ''}${fmt(valuation.unrealized)}`}</span>
            <span style={{ textAlign: 'right', color: pnlColor(valuation.pct) }}>{`${valuation.pct >= 0 ? '+' : ''}${valuation.pct.toFixed(2)}%`}</span>
            <span style={{ textAlign: 'right', color: pnlColor(valuation.dayChg) }}>{`${valuation.dayChg >= 0 ? '+' : ''}${fmt(valuation.dayChg)}`}</span>
            <span />
          </div>
        </>
      )}

      {view === 'EXPOSURE' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>BY ACCOUNT</div>
          {exposure.byAccount.map(([acc, mv]) => (
            <div key={acc} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ width: 90, fontSize: 10, color: 'var(--text-dim)' }}>{acc}</span>
              <div style={{ flex: 1, height: 10, background: 'var(--surface-sunken)', borderRadius: 2 }}>
                <div style={{ width: `${(mv / exposure.total) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-bright)', fontVariantNumeric: 'tabular-nums' }}>{((mv / exposure.total) * 100).toFixed(1)}%</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', margin: '10px 0 4px' }}>BY HOLDING</div>
          {exposure.bySymbol.map((s) => (
            <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ width: 90, fontSize: 10, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }} onClick={() => setSymbol(s.symbol)}>{s.symbol}</span>
              <div style={{ flex: 1, height: 10, background: 'var(--surface-sunken)', borderRadius: 2 }}>
                <div style={{ width: `${s.weight}%`, height: '100%', background: 'var(--positive)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-bright)', fontVariantNumeric: 'tabular-nums' }}>{s.weight.toFixed(1)}% · ${fmt(s.mv, 0)}</span>
            </div>
          ))}
        </div>
      )}

      {view === 'RISK' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            <div><div style={{ fontSize: 8, color: 'var(--text-dim)' }}>MARKET VALUE</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>${fmt(valuation.market, 0)}</div></div>
            <div><div style={{ fontSize: 8, color: 'var(--text-dim)' }}>1-DAY VaR 95% (DERIVED)</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber-bright)' }}>{var95 != null ? `-$${fmt(var95, 0)}` : '—'}</div></div>
            <div><div style={{ fontSize: 8, color: 'var(--text-dim)' }}>VaR % OF BOOK</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dim)' }}>{var95 != null ? `${((var95 / (valuation.market || 1)) * 100).toFixed(2)}%` : '—'}</div></div>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            Parametric VaR from 6 months of daily returns on top holdings, weighted by current book weights.
            Diversification effects across the full book require the correlation engine (RISK panel).
          </div>
        </div>
      )}
    </div>
  );
}
