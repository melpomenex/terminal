'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { WatchlistItem } from '@/lib/types';
import { useTerminalContext, WATCHLIST_KEYS } from '@/context/terminal-context';
import { getUsSessionPhase, sessionLabel } from '@/lib/market-hours';
import { getStreamClient } from '@/lib/streaming/stream-client';
import ProvenanceBadge from '@/components/ui/provenance-badge';

function formatChange(n: number | null): string { if (n == null) return '---'; return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`; }
function formatPct(n: number | null): string { if (n == null) return '---'; return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

type SortKey = 'symbol'|'price'|'change'|'changePercent'|'spark'|'volume'|'vwap';
type SortDir = 'asc'|'desc';

/** Configurable column set for QM v2. */
interface QmColumn { key: string; label: string; width: string; align: 'left'|'right'|'center'; }
const ALL_COLUMNS: QmColumn[] = [
  { key: 'last', label: 'LAST', width: '0.9fr', align: 'right' },
  { key: 'chg', label: 'CHG', width: '0.8fr', align: 'right' },
  { key: 'chgPct', label: 'CHG%', width: '0.8fr', align: 'right' },
  { key: 'bid', label: 'BID', width: '0.8fr', align: 'right' },
  { key: 'ask', label: 'ASK', width: '0.8fr', align: 'right' },
  { key: 'volume', label: 'VOL', width: '0.9fr', align: 'right' },
  { key: 'vwap', label: 'VWAP', width: '0.8fr', align: 'right' },
  { key: 'range', label: 'DAY RNG', width: '1fr', align: 'right' },
  { key: 'spark', label: '1D', width: '62px', align: 'center' },
];
const DEFAULT_COLUMNS = ['last', 'chg', 'chgPct', 'volume', 'vwap', 'spark'];

interface ExtendedItem extends WatchlistItem {
  volume?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  bid?: number | null;
  bidSize?: number | null;
  ask?: number | null;
  askSize?: number | null;
}

function fmtCompact(n: number | null): string {
  if (n == null) return '---';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function QuoteMonitor({ panelId }: { panelId?: string }) {
  const { watchlist, symbol, setSymbol, loading, watchlistKey, setWatchlistKey, customWatchlists } = useTerminalContext();
  const [inputVal, setInputVal] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [customSymbols, setCustomSymbols] = useState<string[]>(()=>{
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('blm_custom_quote_tickers') || '[]'); } catch { return []; }
  });
  const [customWatchlist, setCustomWatchlist] = useState<ExtendedItem[]>([]);
  const [live, setLive] = useState<Record<string, Partial<ExtendedItem>>>({});
  const [streamQuality, setStreamQuality] = useState<'LIVE'|'DELAYED'|'STALE'|'UNAVAILABLE'|null>(null);
  const [flashes, setFlashes] = useState<Record<string, 'pos' | 'neg'>>({});
  const prevPrices = useRef<Record<string, number | null>>({});
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [vwaps, setVwaps] = useState<Record<string, number | null>>({});
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterText, setFilterText] = useState('');
  const [columns, setColumns] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLUMNS;
    try { return JSON.parse(localStorage.getItem('blm_qm_columns') || 'null') ?? DEFAULT_COLUMNS; } catch { return DEFAULT_COLUMNS; }
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showWatchlistPicker, setShowWatchlistPicker] = useState(false);

  // ---- Streaming subscription (multiplexed, deduped across panels) --------
  const allStreamSymbols = useMemo(
    () => [...watchlist.map((w) => w.symbol), ...customSymbols],
    [watchlist, customSymbols],
  );

  useEffect(() => {
    const client = getStreamClient();
    const unsubs = allStreamSymbols.map((sym) =>
      client.subscribe({ topic: 'quotes', symbol: sym }, (data) => {
        const frame = data as Partial<ExtendedItem> & { quality?: string };
        if (frame.quality === 'DELAYED' || frame.quality === 'LIVE') setStreamQuality(frame.quality);
        if (frame.price == null) return;
        setLive((prev) => ({
          ...prev,
          [sym]: {
            ...prev[sym],
            price: frame.price,
            previousClose: frame.previousClose,
            change: frame.change,
            changePercent: frame.changePercent,
            bid: frame.bid,
            bidSize: frame.bidSize,
            ask: frame.ask,
            askSize: frame.askSize,
            volume: frame.volume,
          },
        }));
      }),
    );
    const unsubState = client.onStateChange((s) => { if (s !== 'OPEN') setStreamQuality((q) => (q ? 'STALE' : q)); });
    return () => { unsubs.forEach((u) => u()); unsubState(); };
  }, [allStreamSymbols]);

  // ---- Custom symbol fetch (initial fill; stream keeps it fresh) ----------
  useEffect(() => {
    if (customSymbols.length === 0) { setCustomWatchlist([]); return; }
    const fetchCustom = async () => {
      try {
        const res = await fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(customSymbols.join(','))}`);
        const data = await res.json();
        if (data.items) {
          setCustomWatchlist((data.items ?? []).map((item: Record<string, unknown>) => ({
            symbol: String(item.symbol ?? ''),
            price: item.price != null ? Number(item.price) : null,
            previousClose: item.previousClose != null ? Number(item.previousClose) : null,
            change: item.change != null ? Number(item.change) : null,
            changePercent: item.changePercent != null ? Number(item.changePercent) : null,
            high52w: item.high52w != null ? Number(item.high52w) : null,
            low52w: item.low52w != null ? Number(item.low52w) : null,
          })));
        }
      } catch {}
    };
    fetchCustom();
  }, [customSymbols]);

  // ---- Sparks + VWAP (derived from intraday bars, labeled DERIVED) --------
  useEffect(() => {
    const syms = [...watchlist.map((w) => w.symbol), ...customSymbols];
    let cancelled = false;
    syms.forEach(async (sym) => {
      try {
        const r = await fetch(`/api/yfin/chart/${sym}?range=1d&interval=5m`);
        const j = await r.json();
        if (cancelled) return;
        const closes = ((j.close ?? []) as Array<number | null>).filter((v) => v != null) as number[];
        const volumes = ((j.volume ?? []) as Array<number | null>).map((v) => v ?? 0);
        if (closes.length) setSparks((prev) => ({ ...prev, [sym]: closes.slice(-20) }));
        // VWAP = Σ(typical price × volume) / Σ volume, typical = (H + L + C)/3
        const highs = ((j.high ?? []) as Array<number | null>).map((v) => v ?? 0);
        const lows = ((j.low ?? []) as Array<number | null>).map((v) => v ?? 0);
        let pv = 0, vv = 0;
        for (let i = 0; i < closes.length; i++) {
          const typical = ((highs[i] ?? closes[i]) + (lows[i] ?? closes[i]) + closes[i]) / 3;
          pv += typical * (volumes[i] ?? 0);
          vv += volumes[i] ?? 0;
        }
        setVwaps((prev) => ({ ...prev, [sym]: vv > 0 ? pv / vv : null }));
      } catch {}
    });
    return () => { cancelled = true; };
  }, [watchlist, customSymbols]);

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSymbol = inputVal.trim().toUpperCase();
    if (!newSymbol) return;
    if (customSymbols.includes(newSymbol) || watchlist.some((w) => w.symbol.toUpperCase() === newSymbol)) { setInputVal(''); return; }
    setIsValidating(true);
    try {
      const res = await fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(newSymbol)}`);
      const data = await res.json();
      if (data.items && data.items.length > 0 && data.items[0].price !== null) {
        const next = [...customSymbols, newSymbol];
        setCustomSymbols(next);
        localStorage.setItem('blm_custom_quote_tickers', JSON.stringify(next));
      }
    } catch {} finally { setIsValidating(false); setInputVal(''); }
  };
  const handleRemoveCustomSymbol = (symToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = customSymbols.filter((s) => s !== symToRemove);
    setCustomSymbols(next);
    localStorage.setItem('blm_custom_quote_tickers', JSON.stringify(next));
  };

  const toggleColumn = (key: string) => {
    setColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...ALL_COLUMNS.map((c) => c.key)].filter((k) => prev.includes(k) || k === key);
      localStorage.setItem('blm_qm_columns', JSON.stringify(next));
      return next;
    });
  };

  // Merge base watchlist with live stream frames
  const items: ExtendedItem[] = useMemo(() => {
    const base = new Map<string, ExtendedItem>();
    watchlist.forEach((item) => base.set(item.symbol, item));
    customWatchlist.forEach((item) => base.set(item.symbol, item));
    const symbols = [...watchlist.map((w) => w.symbol), ...customSymbols.filter((s) => !watchlist.some((w) => w.symbol === s))];
    return symbols
      .map((sym) => ({ ...(base.get(sym) as ExtendedItem), ...live[sym], symbol: sym }))
      .filter((item) => item && (item.price != null || item.previousClose != null));
  }, [watchlist, customWatchlist, customSymbols, live]);

  const filtered = useMemo(() => {
    let out = items;
    if (filterText) {
      const ft = filterText.toUpperCase();
      out = out.filter((i) => i.symbol.includes(ft));
    }
    const sorted = [...out];
    sorted.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === 'symbol') { av = a.symbol; bv = b.symbol; return sortDir === 'asc' ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string); }
      if (sortKey === 'price') { av = a.price ?? -Infinity; bv = b.price ?? -Infinity; }
      else if (sortKey === 'change') { av = a.change ?? -Infinity; bv = b.change ?? -Infinity; }
      else if (sortKey === 'changePercent') { av = a.changePercent ?? -Infinity; bv = b.changePercent ?? -Infinity; }
      else if (sortKey === 'volume') { av = a.volume ?? -Infinity; bv = b.volume ?? -Infinity; }
      else if (sortKey === 'vwap') { av = vwaps[a.symbol] ?? -Infinity; bv = vwaps[b.symbol] ?? -Infinity; }
      else { const sa = sparks[a.symbol]; const sb = sparks[b.symbol]; av = sa ? (sa[sa.length - 1] - sa[0]) / sa[0] : 0; bv = sb ? (sb[sb.length - 1] - sb[0]) / sb[0] : 0; }
      const diff = (av as number) - (bv as number);
      return sortDir === 'asc' ? diff : -diff;
    });
    return sorted;
  }, [items, filterText, sortKey, sortDir, sparks, vwaps]);

  // Flash on upticks/downticks
  useEffect(() => {
    const next: Record<string, 'pos' | 'neg'> = {};
    for (const item of filtered) {
      const prev = prevPrices.current[item.symbol];
      if (prev != null && item.price != null && prev !== item.price) {
        next[item.symbol] = item.price > prev ? 'pos' : 'neg';
      }
      prevPrices.current[item.symbol] = item.price;
    }
    const keys = Object.keys(next);
    if (keys.length > 0) {
      setFlashes((cur) => ({ ...cur, ...next }));
      const id = setTimeout(() => { setFlashes((cur) => { const copy = { ...cur }; for (const k of keys) delete copy[k]; return copy; }); }, 620);
      return () => clearTimeout(id);
    }
  }, [filtered]);

  const toggleSort = useCallback((k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'symbol' ? 'asc' : 'desc'); }
  }, [sortKey]);

  if (loading && watchlist.length === 0) return <div style={{ padding: 8, color: 'var(--text-dim)' }}>LOADING…</div>;

  if (filtered.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-mute)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>NO TICKERS</div>
        <div style={{ fontSize: 10 }}>Add ticker →</div>
      </div>
    );
  }

  const phase = getUsSessionPhase();
  const phaseColor = phase === 'open' ? 'var(--positive)' : phase === 'pre' || phase === 'after' ? 'var(--amber-bright)' : 'var(--text-mute)';
  const visibleCols = ALL_COLUMNS.filter((c) => columns.includes(c.key));
  const cols = `28px 1.2fr ${visibleCols.map((c) => c.width).join(' ')}`;

  const provenanceObject = {
    sourceProvider: 'Yahoo composite (stream)',
    retrievalTimestamp: new Date().toISOString(),
    quality: (streamQuality ?? 'DELAYED') as 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE',
    delayMinutes: streamQuality === 'LIVE' ? undefined : 15,
    currency: 'USD',
  };

  const watchlistOptions = [...WATCHLIST_KEYS, ...customWatchlists.map((w) => w.name)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--row-stripe)', fontFamily: 'var(--font)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', fontSize: 9, flexShrink: 0, gap: 6 }}>
        <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>QM · {filtered.length}</span>
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowWatchlistPicker((v) => !v); setShowColumnPicker(false); }} style={{ fontSize: 8, padding: '1px 5px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
            LIST: {watchlistKey} ▾
          </button>
          {showWatchlistPicker && (
            <div style={{ position: 'absolute', top: 18, left: 0, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 3, zIndex: 'var(--z-dropdown)', boxShadow: 'var(--shadow)', minWidth: 120 }}>
              {watchlistOptions.map((k) => (
                <div key={k} onClick={() => { setWatchlistKey(k); setShowWatchlistPicker(false); }} style={{ padding: '3px 8px', cursor: 'pointer', fontSize: 9, background: k === watchlistKey ? 'var(--accent-soft)' : 'transparent', color: k === watchlistKey ? 'var(--accent)' : 'var(--text-dim)' }}>
                  {k}
                </div>
              ))}
            </div>
          )}
        </div>
        <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="FILTER" style={{ width: 54, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', color: 'var(--text-bright)', fontSize: 9, padding: '1px 4px', borderRadius: 2 }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowColumnPicker((v) => !v); setShowWatchlistPicker(false); }} style={{ fontSize: 8, padding: '1px 5px', border: '1px solid var(--border-soft)', background: showColumnPicker ? 'var(--accent-soft)' : 'transparent', color: showColumnPicker ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer' }}>COLS ▾</button>
          {showColumnPicker && (
            <div style={{ position: 'absolute', top: 18, right: 0, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 3, zIndex: 'var(--z-dropdown)', boxShadow: 'var(--shadow)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 4 }}>
              {ALL_COLUMNS.map((c) => (
                <label key={c.key} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 9, color: columns.includes(c.key) ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', padding: '1px 3px' }}>
                  <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} style={{ accentColor: 'var(--accent)' }} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <ProvenanceBadge provenance={provenanceObject} compact />
        <span style={{ color: phaseColor, fontWeight: 700 }}>{sessionLabel(phase)}</span>
      </div>

      <div style={{ padding: '4px 8px', fontSize: 8, color: 'var(--text-dim)', display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--border)', fontWeight: 700, flexShrink: 0, background: 'var(--panel-bg)' }}>
        <span>#</span>
        <span style={{ cursor: 'pointer' }} onClick={() => toggleSort('symbol')}>TICKER {sortKey === 'symbol' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
        {visibleCols.map((c) => (
          <span key={c.key} style={{ textAlign: c.align, cursor: 'pointer' }} onClick={() => toggleSort(c.key as SortKey)}>
            {c.label} {sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {filtered.map((item, i) => {
          const isSelected = item.symbol === symbol;
          const change = item.change;
          const changePercent = item.changePercent;
          const isUp = changePercent != null ? changePercent >= 0 : (change != null && change >= 0);
          const chgColor = changePercent == null && change == null ? 'var(--text-mute)' : isUp ? 'var(--positive)' : 'var(--negative)';
          const isCustom = customSymbols.includes(item.symbol);
          const flash = flashes[item.symbol];
          const zebra = i % 2 === 1 ? 'var(--row-stripe)' : 'transparent';
          const spark = sparks[item.symbol] ?? [];
          const sparkMin = spark.length ? Math.min(...spark) : 0;
          const sparkMax = spark.length ? Math.max(...spark) : 1;
          const sparkRange = sparkMax - sparkMin || 1;
          const vwap = vwaps[item.symbol];
          const cell = (key: string) => {
            switch (key) {
              case 'last': return <span key={key} style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{item.price != null ? item.price.toFixed(2) : '---'}</span>;
              case 'chg': return <span key={key} style={{ textAlign: 'right', fontWeight: 600, color: chgColor, fontVariantNumeric: 'tabular-nums' }}>{formatChange(change)}</span>;
              case 'chgPct': return <span key={key} style={{ textAlign: 'right', fontWeight: 700, color: chgColor, fontVariantNumeric: 'tabular-nums' }}>{formatPct(changePercent)}</span>;
              case 'bid':
              case 'ask': {
                // Real NBBO when a provider supplies it; otherwise explicit
                // '—' — never a synthetic price ± tick fabrication.
                const v = key === 'bid' ? item.bid : item.ask;
                const sz = key === 'bid' ? item.bidSize : item.askSize;
                return <span key={key} title={v == null ? 'No NBBO from current provider (composite quote only)' : `Size ${sz ?? 'n/a'}`} style={{ textAlign: 'right', color: v == null ? 'var(--text-faint)' : 'var(--text-bright)', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
                  {v != null ? `${v.toFixed(2)}${sz != null ? `×${fmtCompact(sz)}` : ''}` : '—'}
                </span>;
              }
              case 'volume': return <span key={key} style={{ textAlign: 'right', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{fmtCompact(item.volume ?? null)}</span>;
              case 'vwap':
                return <span key={key} title="Volume-weighted average price (derived from intraday bars)" style={{ textAlign: 'right', color: vwap != null ? (item.price != null && item.price > vwap ? 'var(--positive)' : 'var(--negative)') : 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
                  {vwap != null ? vwap.toFixed(2) : '—'}
                </span>;
              case 'range': {
                const hi = item.dayHigh, lo = item.dayLow;
                return <span key={key} style={{ textAlign: 'right', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{hi != null && lo != null ? `${lo.toFixed(2)}–${hi.toFixed(2)}` : '—'}</span>;
              }
              case 'spark':
                return (
                  <span key={key} style={{ display: 'flex', justifyContent: 'center' }}>
                    {spark.length > 1 ? (
                      <svg width={54} height={16} viewBox={`0 0 54 16`} style={{ display: 'block' }}>
                        <polyline points={spark.map((v, idx) => `${(idx / (spark.length - 1)) * 54},${16 - ((v - sparkMin) / sparkRange) * 14 - 1}`).join(' ')} fill="none" stroke={isUp ? 'var(--positive)' : 'var(--negative)'} strokeWidth={1.2} />
                        <circle cx={54} cy={16 - ((spark[spark.length - 1] - sparkMin) / sparkRange) * 14 - 1} r={1.6} fill={isUp ? 'var(--positive)' : 'var(--negative)'} />
                      </svg>
                    ) : <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>---</span>}
                  </span>
                );
              default: return null;
            }
          };
          return (
            <div
              key={item.symbol}
              onClick={() => setSymbol(item.symbol)}
              className={`row-hover ${flash === 'pos' ? 'flash-positive' : flash === 'neg' ? 'flash-negative' : ''}`}
              style={{
                display: 'grid', gridTemplateColumns: cols, padding: '4px 8px', alignItems: 'center', cursor: 'pointer',
                background: isSelected ? 'var(--accent-soft)' : zebra, borderBottom: '1px solid var(--row-divider)',
                color: isSelected ? 'var(--accent)' : 'var(--text-bright)', height: 26,
              }}
            >
              <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{i + 1}</span>
              <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                {item.symbol}
                {isCustom && <span onClick={(e) => handleRemoveCustomSymbol(item.symbol, e)} style={{ color: 'var(--negative)', fontSize: 8, padding: '0 2px', cursor: 'pointer', borderRadius: 2, background: 'var(--negative-soft)' }}>×</span>}
              </span>
              {visibleCols.map((c) => cell(c.key))}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAddTicker} style={{ padding: '5px 8px', borderTop: '1px solid var(--border-soft)', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700 }}>+ ADD:</span>
        <input type="text" placeholder="TSLA" value={inputVal} onChange={(e) => setInputVal(e.target.value)} disabled={isValidating} style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, padding: '2px 6px', fontSize: 10, color: 'var(--text-bright)', fontFamily: 'var(--font)', textTransform: 'uppercase' }} />
        {isValidating && <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>…</span>}
        <span style={{ fontSize: 8, color: 'var(--text-faint)' }}>{filtered.filter((w) => (w.changePercent ?? 0) > 0).length}↑ {filtered.filter((w) => (w.changePercent ?? 0) < 0).length}↓</span>
      </form>
    </div>
  );
}
