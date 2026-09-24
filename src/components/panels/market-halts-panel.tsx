'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import type { DataProvenance } from '@/lib/types/provenance';

interface Halt {
  id: string;
  symbol: string;
  marketCenter: string;
  haltDate: string;
  haltTime: string;
  reasonCode: string;
  reasonLabel: string;
  resumptionDate?: string;
  resumptionTime?: string;
  quoteOnly: boolean;
}

/**
 * HALT — Market halts monitor. Real-time trade halts from the NasdaqTrader
 * tradehalts feed with reason decoding and resumption times.
 */
export default function MarketHaltsPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [halts, setHalts] = useState<Halt[]>([]);
  const [provenance, setProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = () => {
      fetch('/api/v2/halts')
        .then((r) => r.json())
        .then((j) => { setHalts(j.halts ?? []); setProvenance(j.provenance ?? null); })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return halts;
    return halts.filter((h) => h.symbol.includes(q) || h.reasonCode.includes(q) || h.reasonLabel.toUpperCase().includes(q));
  }, [halts, query]);

  const activeHaltColor = (h: Halt) => (h.resumptionTime ? 'var(--text-dim)' : h.reasonCode.startsWith('M') ? 'var(--negative)' : 'var(--amber-bright)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>HALT · MARKET HALTS</span>
        <span style={{ fontSize: 9, color: halts.length ? 'var(--amber-bright)' : 'var(--text-dim)' }}>{halts.length} TOTAL</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter…" style={{ marginLeft: 'auto', width: 90, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none' }} />
        {provenance && <ProvenanceBadge provenance={provenance} compact />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '74px 44px 72px 60px 1fr 84px', padding: '3px 8px', fontSize: 8, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', flexShrink: 0, fontWeight: 700 }}>
        <span>SYMBOL</span><span>MC</span><span>DATE</span><span>TIME</span><span>REASON</span><span>RESUMES</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 10, color: 'var(--text-dim)' }}>LOADING HALT FEED…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 16, color: 'var(--positive)', textAlign: 'center', fontSize: 11 }}>
            NO TRADE HALTS {query ? 'MATCH FILTER' : 'REPORTED'}
          </div>
        )}
        {filtered.slice(0, 80).map((h) => (
          <div
            key={h.id}
            onClick={() => h.symbol && setSymbol(h.symbol)}
            className="row-hover"
            style={{ display: 'grid', gridTemplateColumns: '74px 44px 72px 60px 1fr 84px', padding: '3px 8px', borderBottom: '1px solid var(--row-divider)', cursor: h.symbol ? 'pointer' : 'default', alignItems: 'center' }}
          >
            <span style={{ fontWeight: 700, color: activeHaltColor(h) }}>{h.symbol || '—'}</span>
            <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>{h.marketCenter || '—'}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{h.haltDate}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{h.haltTime}</span>
            <span style={{ color: h.resumptionTime ? 'var(--text-dim)' : 'var(--text-bright)', fontSize: 10 }}>
              <b style={{ color: 'var(--accent)' }}>{h.reasonCode}</b> — {h.reasonLabel}
            </span>
            <span style={{ color: h.resumptionTime ? 'var(--positive)' : 'var(--negative)', fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>
              {h.resumptionTime ? `${h.resumptionDate ?? ''} ${h.resumptionTime}` : 'PENDING'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)', flexShrink: 0 }}>
        SOURCE: NASDAQTRADER TRADEHALTS · T1 NEWS PENDING · T6 LULD VOLATILITY · M1-M3 MARKET-WIDE CIRCUIT BREAKERS · REFRESH 15s
      </div>
    </div>
  );
}
