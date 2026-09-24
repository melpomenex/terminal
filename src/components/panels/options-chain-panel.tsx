'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTerminalContext } from '@/context/terminal-context';
import { impliedVolatility, blackScholesGreeks, yearsToExpiry } from '@/lib/math/options-pricing';
import ProvenanceBadge from '@/components/ui/provenance-badge';

interface OptionContract {
  expiry: string;
  type: 'call' | 'put';
  strike: number;
  last: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  /** Provider-supplied implied volatility (decimal) when available. */
  iv?: number | null;
}

interface ExpirationGroup {
  expiry: string;
  calls: OptionContract[];
  puts: OptionContract[];
}

interface OptionsData {
  expirations: string[];
  groups: ExpirationGroup[];
}

/** Per-row analytics derived strictly from real market inputs. */
interface RowAnalytics {
  /** IV as decimal (provider or solved); null = not derivable. */
  callIv: number | null;
  putIv: number | null;
  callDelta: number | null;
  putDelta: number | null;
  /** true when IV came from the Black-Scholes solver rather than provider. */
  ivIsDerived: boolean;
}

const RISK_FREE_RATE = 0.043; // ~13-week T-bill; refined later by FRED integration

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  } catch {
    return iso;
  }
}

function fmtNum(n: number | undefined | null, decimals = 2): string {
  if (n == null || isNaN(n)) return '0.00';
  return n.toFixed(decimals);
}

function fmtVol(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '---';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtIv(iv: number | null): string {
  if (iv == null) return '—';
  return `${(iv * 100).toFixed(1)}%`;
}

const CALL_COLS = ['Last', 'Bid', 'Ask', 'Vol', 'IV', 'Δ'];
const PUT_COLS = ['Δ', 'IV', 'Vol', 'Bid', 'Ask', 'Last'];

export default function OptionsChainPanel({ panelId }: { panelId?: string }) {
  const { symbol, chart, watchlist } = useTerminalContext();
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/yfin/options-chain?symbol=${encodeURIComponent(sym)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (raw.error) throw new Error(raw.error);

      const contracts: OptionContract[] = raw.contracts ?? [];
      const expirations: string[] = raw.expirations ?? [];

      const expirySet = [...new Set(contracts.map((c) => c.expiry))];
      const groups: ExpirationGroup[] = expirySet.map((exp) => ({
        expiry: exp,
        calls: contracts.filter((c) => c.expiry === exp && c.type === 'call'),
        puts: contracts.filter((c) => c.expiry === exp && c.type === 'put'),
      }));

      const result: OptionsData = {
        expirations: expirations.length > 0 ? expirations : expirySet,
        groups,
      };
      setData(result);
      if (expirySet.length > 0) setSelectedExpiry(expirySet[0]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(symbol);
  }, [symbol, load]);

  const currentPrice = chart?.price ?? watchlist.find((w) => w.symbol === symbol)?.price ?? 0;
  const activeGroup = data?.groups.find((g) => g.expiry === selectedExpiry);

  const rows: { strike: number; call?: OptionContract; put?: OptionContract }[] = useMemo(() => {
    if (!activeGroup) return [];
    const callMap = new Map(activeGroup.calls.map((c) => [c.strike, c]));
    const putMap = new Map(activeGroup.puts.map((p) => [p.strike, p]));
    const allStrikes = new Set([...activeGroup.calls.map((c) => c.strike), ...activeGroup.puts.map((p) => p.strike)]);
    return Array.from(allStrikes).sort((a, b) => a - b).map((strike) => ({ strike, call: callMap.get(strike), put: putMap.get(strike) }));
  }, [activeGroup]);

  /**
   * Real analytics pass: provider IV first; when absent, solve IV from the
   * real bid/ask mid via Black-Scholes. No synthetic formulas.
   */
  const analytics = useMemo(() => {
    if (!activeGroup || currentPrice <= 0) return new Map<number, RowAnalytics>();
    const T = yearsToExpiry(activeGroup.expiry);
    const out = new Map<number, RowAnalytics>();
    let anyDerived = false;

    for (const { strike, call, put } of rows) {
      let callIv = call?.iv ?? null;
      let putIv = put?.iv ?? null;
      let callDelta: number | null = null;
      let putDelta: number | null = null;

      if (callIv == null && call && T > 0) {
        const mid = call.bid != null && call.ask != null && call.ask > call.bid
          ? (call.bid + call.ask) / 2
          : call.last;
        if (mid != null && mid > 0) {
          const solved = impliedVolatility({ marketPrice: mid, spot: currentPrice, strike, timeToExpiry: T, riskFreeRate: RISK_FREE_RATE, dividendYield: 0, optionType: 'CALL' });
          if (solved != null) { callIv = solved; anyDerived = true; }
        }
      }
      if (putIv == null && put && T > 0) {
        const mid = put.bid != null && put.ask != null && put.ask > put.bid
          ? (put.bid + put.ask) / 2
          : put.last;
        if (mid != null && mid > 0) {
          const solved = impliedVolatility({ marketPrice: mid, spot: currentPrice, strike, timeToExpiry: T, riskFreeRate: RISK_FREE_RATE, dividendYield: 0, optionType: 'PUT' });
          if (solved != null) { putIv = solved; anyDerived = true; }
        }
      }

      if (callIv != null && T > 0) {
        callDelta = blackScholesGreeks({ spot: currentPrice, strike, timeToExpiry: T, volatility: callIv, riskFreeRate: RISK_FREE_RATE, dividendYield: 0, optionType: 'CALL' }).delta;
      }
      if (putIv != null && T > 0) {
        putDelta = blackScholesGreeks({ spot: currentPrice, strike, timeToExpiry: T, volatility: putIv, riskFreeRate: RISK_FREE_RATE, dividendYield: 0, optionType: 'PUT' }).delta;
      }

      out.set(strike, { callIv, putIv, callDelta, putDelta, ivIsDerived: call?.iv == null || put?.iv == null });
    }
    void anyDerived;
    return out;
  }, [rows, activeGroup, currentPrice]);

  const totalCallVolume = useMemo(
    () => (activeGroup?.calls ?? []).reduce((s, c) => s + (c.volume ?? 0), 0),
    [activeGroup],
  );
  const totalPutVolume = useMemo(
    () => (activeGroup?.puts ?? []).reduce((s, p) => s + (p.volume ?? 0), 0),
    [activeGroup],
  );

  const gridCols = 'repeat(6, 1fr) 72px repeat(6, 1fr)';

  const colStyle: React.CSSProperties = {
    fontSize: 9,
    color: 'var(--amber-dim)',
    textAlign: 'right',
    padding: '4px 6px',
    fontWeight: 700,
    letterSpacing: '0.02em'
  };

  const cellStyle: React.CSSProperties = {
    fontSize: 10.5,
    color: '#d1d5db',
    textAlign: 'right',
    padding: '3px 6px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  // Watchlist metrics for dashboard
  const wlEntry = watchlist.find((w) => w.symbol.toUpperCase() === symbol.toUpperCase());
  const dailyChg = wlEntry?.change ?? 0;
  const dailyChgPct = wlEntry?.changePercent ?? 0;
  const isUp = dailyChg >= 0;

  const ivDerivedProvenance = {
    sourceProvider: 'Black-Scholes IV solver on real quotes',
    retrievalTimestamp: new Date().toISOString(),
    quality: 'DERIVED' as const,
    currency: 'USD',
  };

  // Virtualized strike ladder: chains carry 100+ strikes; only visible rows
  // mount so scrolling and IV recomputes stay at 60 FPS. (Declared before
  // early returns — hooks must run unconditionally.)
  const CHAIN_ROW_H = 22;
  const chainScrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => chainScrollRef.current,
    estimateSize: () => CHAIN_ROW_H,
    overscan: 14,
  });

  if (loading) return <div style={{ padding: 12, color: 'var(--amber-dim)', fontSize: 11 }}>LOADING OPTIONS CHAIN...</div>;
  if (error) return <div style={{ padding: 12, color: 'var(--red)', fontSize: 11 }}>{error.toUpperCase()}</div>;
  if (!data || data.expirations.length === 0) return <div style={{ padding: 12, color: 'var(--amber-dim)', fontSize: 11 }}>NO OPTIONS DATA</div>;

  // First strike above spot anchors the LAST PRICE banner
  const bannerStrikeIndex = currentPrice > 0 ? rows.findIndex((r) => r.strike > currentPrice) : -1;

  const renderChainRow = (row: { strike: number; call?: OptionContract; put?: OptionContract }, index: number): React.ReactNode => {
    const c = row.call;
    const p = row.put;
    const a = analytics.get(row.strike);
    const isCallITM = row.strike < currentPrice;
    const isPutITM = row.strike > currentPrice;
    return (
      <div
        key={row.strike}
        data-index={index}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%',
          height: `${CHAIN_ROW_H}px`, transform: `translateY(${index * CHAIN_ROW_H}px)`,
          display: 'grid', gridTemplateColumns: gridCols,
          borderBottom: '1px solid #111114',
          alignItems: 'center'
        }}
      >
        {/* CALL SIDE */}
        <div style={{ ...cellStyle, background: isCallITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtNum(c?.last)}</div>
        <div style={{ ...cellStyle, color: '#888899', background: isCallITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtNum(c?.bid)}</div>
        <div style={{ ...cellStyle, color: '#888899', background: isCallITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtNum(c?.ask)}</div>
        <div style={{ ...cellStyle, background: isCallITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtVol(c?.volume)}</div>
        <div title={a?.callIv == null ? 'IV not derivable from current quotes' : 'Black-Scholes implied vol from real bid/ask mid'} style={{ ...cellStyle, color: 'var(--amber-dim)', background: isCallITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtIv(a?.callIv ?? null)}</div>
        <div title="Delta (Black-Scholes)" style={{ ...cellStyle, color: '#6b8fbd', background: isCallITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{a?.callDelta != null ? a.callDelta.toFixed(2) : '—'}</div>

        {/* STRIKE CENTER COLUMN */}
        <div
          style={{
            ...cellStyle,
            textAlign: 'center',
            fontWeight: 700,
            color: '#ffb000',
            background: '#151518',
            borderLeft: '1px solid #1f1f22',
            borderRight: '1px solid #1f1f22',
            padding: '3px 0'
          }}
        >
          {row.strike.toFixed(2)}
        </div>

        {/* PUT SIDE */}
        <div title="Delta (Black-Scholes)" style={{ ...cellStyle, color: '#6b8fbd', textAlign: 'left', background: isPutITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{a?.putDelta != null ? a.putDelta.toFixed(2) : '—'}</div>
        <div title={a?.putIv == null ? 'IV not derivable from current quotes' : 'Black-Scholes implied vol from real bid/ask mid'} style={{ ...cellStyle, color: 'var(--amber-dim)', textAlign: 'left', background: isPutITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtIv(a?.putIv ?? null)}</div>
        <div style={{ ...cellStyle, background: isPutITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtVol(p?.volume)}</div>
        <div style={{ ...cellStyle, color: '#888899', background: isPutITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtNum(p?.bid)}</div>
        <div style={{ ...cellStyle, color: '#888899', background: isPutITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtNum(p?.ask)}</div>
        <div style={{ ...cellStyle, background: isPutITM ? 'rgba(255, 176, 0, 0.03)' : 'transparent' }}>{fmtNum(p?.last)}</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#0a0a0c', fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      {/* Top Header & Expirations Pills */}
      <div style={{
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1f1f22',
        background: '#0d0d0f',
        flexShrink: 0
      }}>
        {/* Horizontal Expiration Pills */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {data.expirations.slice(0, 6).map((exp) => {
            const isSel = exp === selectedExpiry;
            return (
              <button
                key={exp}
                onClick={() => setSelectedExpiry(exp)}
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  color: isSel ? '#000' : '#888899',
                  background: isSel ? '#ffb000' : '#18181b',
                  border: `1px solid ${isSel ? '#ffb000' : '#28282c'}`,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)'
                }}
              >
                {fmtDate(exp)}
              </button>
            );
          })}
        </div>

        {/* Dashboard Badge — real aggregated contract volumes only */}
        <div style={{
          background: '#151518',
          border: '1px solid #28282c',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 9.5,
          color: '#d1d5db',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          fontWeight: 600
        }}>
          <span style={{ color: 'var(--amber-dim)' }}>{rows.length} Strikes</span>
          <span style={{ color: '#555566' }}>|</span>
          <span>Spot: ${currentPrice.toFixed(2)}</span>
          <span style={{ color: isUp ? '#00b050' : '#ef4444' }}>
            {isUp ? '+' : ''}{dailyChg.toFixed(2)} ({isUp ? '+' : ''}{dailyChgPct.toFixed(2)}%)
          </span>
          <span style={{ color: '#555566' }}>|</span>
          <span title="Real contract volume summed across this expiry">C {fmtVol(totalCallVolume)} / P {fmtVol(totalPutVolume)}</span>
          <ProvenanceBadge provenance={ivDerivedProvenance} compact />
        </div>
      </div>

      {/* Columns Header Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        padding: '4px 0',
        borderBottom: '1px solid #1f1f22',
        background: '#070709',
        flexShrink: 0
      }}>
        {/* CALLS HEADER */}
        {CALL_COLS.map((col) => <div key={`ch-${col}`} style={colStyle}>{col}</div>)}

        {/* CENTER STRIKE HEADER */}
        <div style={{ ...colStyle, textAlign: 'center', color: '#ffb000', fontWeight: 700 }}>STRIKE</div>

        {/* PUTS HEADER */}
        {PUT_COLS.map((col) => <div key={`ph-${col}`} style={{ ...colStyle, textAlign: col === 'IV' || col === 'Δ' ? 'left' : 'right' }}>{col}</div>)}
      </div>

      {/* Virtualized strike ladder + LAST PRICE banner pinned at the ATM boundary */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={chainScrollRef} style={{ height: '100%', overflowY: 'auto' }}>
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => renderChainRow(rows[virtualRow.index], virtualRow.index))}
          </div>
          {rows.length === 0 && (
            <div style={{ padding: 16, color: 'var(--amber-dim)', textAlign: 'center' }}>NO OPTION CONTRACTS AVAILABLE FOR EXPIRATION</div>
          )}
        </div>
        {currentPrice > 0 && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0,
              top: bannerStrikeIndex >= 0
                ? `${Math.max(0, bannerStrikeIndex) * CHAIN_ROW_H - 9}px`
                : `${rows.length * CHAIN_ROW_H - 9}px`,
              background: isUp ? 'rgba(0, 176, 80, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              borderTop: `1px dashed ${isUp ? '#00b050' : '#ef4444'}`,
              borderBottom: `1px dashed ${isUp ? '#00b050' : '#ef4444'}`,
              color: isUp ? '#00b050' : '#ef4444',
              padding: '2px 0', textAlign: 'center', fontSize: 9.5,
              fontWeight: 700, letterSpacing: '0.08em',
              pointerEvents: 'none',
            }}
          >
            LAST PRICE: {currentPrice.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
