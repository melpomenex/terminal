'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { getStreamClient } from '@/lib/streaming/stream-client';
import ProvenanceBadge from '@/components/ui/provenance-badge';

interface Level {
  price: number; size: number; mm?: string; total: number;
}

interface BookData {
  bids: Level[];
  asks: Level[];
  mid?: number | null;
  spread?: number | null;
  spreadBps?: number | null;
  imbalance?: number | null;
  quality?: string;
  entitlementRequired?: string;
  topOfBook?: { last: number; bid: number | null; ask: number | null; currency?: string | null; exchange?: string | null } | null;
}

/**
 * DEPTH — Level 2 order book.
 *
 * Subscribes to the real `depth:<symbol>` stream topic. Without an entitled
 * depth feed, the panel displays an explicit ENTITLEMENT REQUIRED state with
 * the real top-of-book composite — never a synthetic book.
 */
export default function DepthPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [data, setData] = useState<BookData | null>(null);
  const [streamLive, setStreamLive] = useState(false);
  const [entitlement, setEntitlement] = useState<string | null>(null);

  // Real depth stream subscription
  useEffect(() => {
    setStreamLive(false);
    const client = getStreamClient();
    const unsub = client.subscribe({ topic: 'depth', symbol }, (payload) => {
      const frame = payload as BookData & { entitlementRequired?: string; quality?: string };
      if (frame.quality === 'UNAVAILABLE') {
        setEntitlement(frame.entitlementRequired ?? 'Depth-of-book feed');
        setData((prev) => prev ?? frame);
        return;
      }
      if (frame.bids?.length || frame.asks?.length) {
        setStreamLive(true);
        setEntitlement(null);
        setData(frame);
      }
    });
    return unsub;
  }, [symbol]);

  // Fallback metadata fetch (top-of-book + entitlement text)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/yfin/depth/${symbol}`)
      .then((r) => r.json())
      .then((j: BookData) => { if (!cancelled && !streamLive) setData(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [symbol, streamLive]);

  const hasBook = streamLive && (data?.bids?.length ?? 0) + (data?.asks?.length ?? 0) > 0;

  if (!data) return <div style={{ padding: 8, color: 'var(--text-dim)' }}>LOADING DEPTH {symbol}…</div>;

  // Top-of-book summary line (real data whenever present)
  const topLast = data.topOfBook?.last ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font)' }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)' }}>LEVEL 2 · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        {hasBook
          ? <ProvenanceBadge quality="LIVE" compact />
          : <ProvenanceBadge quality="UNAVAILABLE" compact />}
      </div>

      {!hasBook ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, textAlign: 'center' }}>
          <span style={{ color: 'var(--negative)', fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>● ENTITLEMENT REQUIRED</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, maxWidth: 340, lineHeight: 1.6 }}>
            A real Level 2 order book requires an entitled depth-of-book feed
            ({entitlement ?? 'Nasdaq TotalView / NYSE OpenBook'}). Qube never simulates book levels
            or market-maker inventory.
          </span>
          {topLast != null && (
            <div style={{ marginTop: 8, padding: '6px 12px', border: '1px solid var(--border-soft)', borderRadius: 3, background: 'var(--surface-sunken)', fontSize: 11 }}>
              <span style={{ color: 'var(--text-mute)', fontSize: 9 }}>COMPOSITE LAST </span>
              <b style={{ color: 'var(--text-bright)' }}>{topLast.toFixed(2)}</b>
              <span style={{ color: 'var(--text-faint)', fontSize: 9 }}> · delayed public quote</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-soft)', flex: 1, minHeight: 0 }}>
            <div style={{ background: 'var(--panel-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 54px 38px 1fr', padding: '3px 6px', fontSize: 8, color: 'var(--positive)', borderBottom: '1px solid var(--border)', background: 'var(--positive-soft)' }}>
                <span>BID</span><span style={{ textAlign: 'right' }}>SIZE</span><span>MM</span><span style={{ textAlign: 'right' }}>TOTAL</span>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {data.bids.map((b, i) => {
                  const maxSize = Math.max(...data.bids.map((x) => x.size), 1);
                  return (
                    <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '60px 54px 38px 1fr', padding: '2px 6px', fontSize: 11, borderBottom: '1px solid rgba(0,255,0,0.06)' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(b.size / maxSize) * 100}%`, background: 'rgba(0,176,80,0.12)', pointerEvents: 'none' }} />
                      <span style={{ position: 'relative', color: 'var(--positive)', fontWeight: i === 0 ? 700 : 400 }}>{b.price.toFixed(2)}</span>
                      <span style={{ position: 'relative', textAlign: 'right', color: 'var(--text-bright)' }}>{b.size.toLocaleString()}</span>
                      <span style={{ position: 'relative', color: 'var(--text-dim)', fontSize: 10 }}>{b.mm ?? '—'}</span>
                      <span style={{ position: 'relative', textAlign: 'right', color: 'var(--text-mute)', fontVariantNumeric: 'tabular-nums' }}>{b.total.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: 'var(--panel-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 54px 38px 1fr', padding: '3px 6px', fontSize: 8, color: 'var(--negative)', borderBottom: '1px solid var(--border)', background: 'var(--negative-soft)' }}>
                <span>ASK</span><span style={{ textAlign: 'right' }}>SIZE</span><span>MM</span><span style={{ textAlign: 'right' }}>TOTAL</span>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {data.asks.map((a, i) => {
                  const maxSize = Math.max(...data.asks.map((x) => x.size), 1);
                  return (
                    <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '60px 54px 38px 1fr', padding: '2px 6px', fontSize: 11, borderBottom: '1px solid rgba(255,0,0,0.06)' }}>
                      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(a.size / maxSize) * 100}%`, background: 'rgba(239,68,68,0.10)', pointerEvents: 'none' }} />
                      <span style={{ position: 'relative', color: 'var(--negative)', fontWeight: i === 0 ? 700 : 400 }}>{a.price.toFixed(2)}</span>
                      <span style={{ position: 'relative', textAlign: 'right', color: 'var(--text-bright)' }}>{a.size.toLocaleString()}</span>
                      <span style={{ position: 'relative', color: 'var(--text-dim)', fontSize: 10 }}>{a.mm ?? '—'}</span>
                      <span style={{ position: 'relative', textAlign: 'right', color: 'var(--text-mute)' }}>{a.total.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '4px 8px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border)', flexShrink: 0, fontSize: 10 }}>
            <span>BID TOTAL <b style={{ color: 'var(--positive)' }}>{data.bids.reduce((s, b) => s + b.size, 0).toLocaleString()}</b></span>
            <span>ASK TOTAL <b style={{ color: 'var(--negative)' }}>{data.asks.reduce((s, a) => s + a.size, 0).toLocaleString()}</b></span>
            <span>SPREAD <b>{data.spread ?? '—'}</b>{data.spreadBps != null && <span style={{ color: 'var(--text-dim)' }}> ({data.spreadBps} bps)</span>}</span>
          </div>
        </>
      )}
    </div>
  );
}
