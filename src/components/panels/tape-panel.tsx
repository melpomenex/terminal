'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTerminalContext } from '@/context/terminal-context';
import { getStreamClient } from '@/lib/streaming/stream-client';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

interface MinuteBar {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

interface TickPrint {
  time: number; price: number; size: number; side?: string; condition?: string; venue?: string;
}

/**
 * TAPE — Time & Sales.
 *
 * Consumes the real streaming `trades:<symbol>` topic. When the streaming
 * gateway reports the tick feed as UNAVAILABLE (no consolidated-tape
 * entitlement), the panel says so explicitly and falls back to a clearly
 * labeled DERIVED view of exchange 1-minute aggregates — never fabricated
 * prints.
 */
export default function TapePanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [bars, setBars] = useState<MinuteBar[]>([]);
  const [ticks, setTicks] = useState<TickPrint[]>([]);
  const [tickStatus, setTickStatus] = useState<'CONNECTING' | 'LIVE' | 'UNAVAILABLE'>('CONNECTING');
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [entitlement, setEntitlement] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'BLOCK'>('ALL');
  const [showMinuteBars, setShowMinuteBars] = useState(true);

  // Real tick stream subscription
  useEffect(() => {
    setTicks([]);
    setTickStatus('CONNECTING');
    const client = getStreamClient();
    const unsub = client.subscribe({ topic: 'trades', symbol }, (data) => {
      const frame = data as { quality?: string; entitlementRequired?: string; prints?: TickPrint[] };
      if (frame.quality === 'UNAVAILABLE') {
        setTickStatus('UNAVAILABLE');
        setEntitlement(frame.entitlementRequired ?? 'Real-time tick feed');
        return;
      }
      if (frame.quality === 'LIVE' || frame.quality === 'DELAYED') {
        setTickStatus((prev) => (prev === 'UNAVAILABLE' ? prev : 'LIVE'));
        if (frame.prints?.length) {
          setTicks((prev) => [...frame.prints!, ...prev].slice(0, 400));
          setLastPrice(frame.prints[0].price);
        }
      }
    });
    return unsub;
  }, [symbol]);

  // Honest minute-bar aggregates
  useEffect(() => {
    let cancelled = false;
    const fetchBars = async () => {
      try {
        const r = await fetch(`/api/yfin/tape/${symbol}`);
        const j = await r.json();
        if (cancelled) return;
        setBars(j.bars ?? []);
        if (j.lastPrice != null) setLastPrice(j.lastPrice);
      } catch { if (!cancelled) setBars([]); }
    };
    fetchBars();
    const id = setInterval(fetchBars, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  const rows: Array<{ key: string; time: number; price: number; size: number; side: string; condition: string; block: boolean }> = [];
  if (tickStatus === 'LIVE') {
    for (const t of ticks) {
      rows.push({
        key: `t-${t.time}-${t.price}-${rows.length}`,
        time: t.time, price: t.price, size: t.size,
        side: t.side ?? (t.condition?.includes('BUY') ? 'BUY' : 'SELL'),
        condition: t.condition ?? '@', block: t.size >= 1000 || t.condition === 'BLOCK',
      });
    }
  } else {
    for (const b of bars) {
      rows.push({
        key: `b-${b.time}`,
        time: b.time * 1000, price: b.close, size: b.volume,
        side: b.close >= b.open ? 'BUY' : 'SELL',
        condition: '1M BAR', block: b.volume >= 10_000,
      });
    }
  }

  const filtered = rows.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'BLOCK') return t.block;
    return t.side === filter;
  });

  // Virtualized row rendering: tape streams hundreds of prints; only visible
  // rows mount, keeping updates at 60 FPS regardless of buffer depth.
  const ROW_HEIGHT = 21;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const derivedProvenance = makeProvenance('Exchange 1m aggregates', 'DERIVED', 'USD', {
    entitlementRequired: 'Consolidated Tape (CTA/UP) tick feed',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font)' }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)' }}>TIME & SALES · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {(['ALL', 'BUY', 'SELL', 'BLOCK'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border-soft)'}`, background: filter === f ? 'var(--accent-soft)' : 'transparent', color: filter === f ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2 }}>{f}</button>
          ))}
          {tickStatus !== 'LIVE' && (
            <button onClick={() => setShowMinuteBars((v) => !v)} style={{ fontSize: 9, padding: '1px 6px', border: '1px solid var(--border-soft)', background: showMinuteBars ? 'var(--accent-soft)' : 'transparent', color: showMinuteBars ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, marginLeft: 4 }}>1M BARS</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '4px 8px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, fontSize: 10, alignItems: 'center' }}>
        <span>LAST <b style={{ color: 'var(--text-bright)' }}>{lastPrice?.toFixed(2) ?? '---'}</b></span>
        {tickStatus === 'LIVE' ? (
          <ProvenanceBadge quality="LIVE" compact />
        ) : (
          <ProvenanceBadge provenance={derivedProvenance} compact />
        )}
        {tickStatus === 'UNAVAILABLE' && (
          <span style={{ color: 'var(--negative)', fontSize: 9 }}>
            TICK FEED UNAVAILABLE — {entitlement}
          </span>
        )}
      </div>

      {tickStatus === 'UNAVAILABLE' && !showMinuteBars ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center' }}>
          <span style={{ color: 'var(--negative)', fontWeight: 700, fontSize: 12 }}>● UNAVAILABLE</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, maxWidth: 320 }}>
            Real time &amp; sales requires an entitled consolidated tape ({entitlement}). Qube does not
            simulate tick prints. Enable the 1M BARS view for real exchange minute aggregates.
          </span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '78px 70px 56px 48px 1fr', padding: '3px 8px', fontSize: 8, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span>TIME</span><span style={{ textAlign: 'right' }}>PRICE</span><span style={{ textAlign: 'right' }}>SIZE</span><span style={{ textAlign: 'center' }}>SIDE</span><span>COND</span>
          </div>
          <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const t = filtered[virtualRow.index];
                const d = new Date(t.time);
                const timeStr = tickStatus === 'LIVE'
                  ? d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions)
                  : d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                const isBuy = t.side === 'BUY';
                return (
                  <div
                    key={t.key}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`,
                      display: 'grid', gridTemplateColumns: '78px 70px 56px 48px 1fr', padding: '2px 8px',
                      fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: t.block ? 'rgba(255,176,0,0.06)' : undefined,
                    }}
                  >
                    <span style={{ color: 'var(--text-mute)', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: isBuy ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>{t.price.toFixed(2)}</span>
                    <span style={{ textAlign: 'right', color: t.block ? 'var(--accent)' : 'var(--text-bright)', fontWeight: t.block ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{t.size.toLocaleString()}</span>
                    <span style={{ textAlign: 'center', color: isBuy ? 'var(--positive)' : 'var(--negative)', fontWeight: 700 }}>{isBuy ? 'B' : 'S'}</span>
                    <span style={{ fontSize: 10, color: t.condition === 'BLOCK' ? 'var(--accent)' : 'var(--text-faint)' }}>{t.condition}</span>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: 11 }}>NO PRINTS</div>}
          </div>
          <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{filtered.length} {tickStatus === 'LIVE' ? 'PRINTS' : 'MINUTE BARS'}</span>
            <span>{tickStatus === 'LIVE' ? 'B = BID • S = ASK • BLOCK ≥ 1000 SHS' : 'DERIVED FROM EXCHANGE 1M AGGREGATES'}</span>
          </div>
        </>
      )}
    </div>
  );
}
