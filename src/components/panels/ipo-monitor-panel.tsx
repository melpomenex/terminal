'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import type { DataProvenance } from '@/lib/types/provenance';

interface IpoEntry {
  symbol: string;
  companyName: string;
  expectedPricingDate: string | null;
  offerShares: number | null;
  priceRangeLow: number | null;
  priceRangeHigh: number | null;
  leadUnderwriters: string | null;
  exchange: string | null;
  status: 'FILED' | 'EXPECTED' | 'PRICED' | 'WITHDRAWN';
}

const STATUS_TABS = ['ALL', 'EXPECTED', 'PRICED', 'FILED'] as const;
const STATUS_COLOR: Record<IpoEntry['status'], string> = {
  EXPECTED: 'var(--amber-bright)',
  PRICED: 'var(--positive)',
  FILED: '#60a5fa',
  WITHDRAWN: 'var(--text-faint)',
};

/** SEC full-text search link for the S-1 of a given issuer symbol. */
function s1SearchUrl(entry: IpoEntry): string {
  const q = entry.symbol || entry.companyName;
  return `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=S-1`;
}

/**
 * IPO — IPO monitor: filed, expected, priced and trading IPOs with offer
 * ranges and S-1 links. Data: Nasdaq public IPO calendar.
 */
export default function IpoMonitorPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [ipos, setIpos] = useState<IpoEntry[]>([]);
  const [provenance, setProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/v2/ipos')
      .then((r) => r.json())
      .then((j) => { setIpos(j.ipos ?? []); setProvenance(j.provenance ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let out = ipos;
    if (tab !== 'ALL') out = out.filter((i) => i.status === tab);
    const q = query.trim().toUpperCase();
    if (q) out = out.filter((i) => i.symbol.includes(q) || i.companyName.toUpperCase().includes(q));
    return out;
  }, [ipos, tab, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>IPO · CALENDAR</span>
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ fontSize: 8, padding: '1px 6px', border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border-soft)'}`, background: tab === t ? 'var(--accent-soft)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 8, cursor: 'pointer' }}>{t}</button>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter…" style={{ marginLeft: 'auto', width: 90, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none' }} />
        {provenance && <ProvenanceBadge provenance={provenance} compact />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px 90px 70px 90px 36px', padding: '3px 8px', fontSize: 8, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', flexShrink: 0, fontWeight: 700 }}>
        <span>SYMBOL</span><span>COMPANY</span><span>STATUS</span><span>PRICING DATE</span><span>SHARES</span><span>RANGE</span><span>S-1</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 10, color: 'var(--text-dim)' }}>LOADING IPO CALENDAR…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: 12, color: 'var(--text-dim)' }}>NO IPO ENTRIES {query ? 'MATCH FILTER' : 'IN CALENDAR'}</div>}
        {filtered.slice(0, 80).map((ipo, i) => (
          <div key={`${ipo.symbol}-${i}`} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px 90px 70px 90px 36px', padding: '3px 8px', borderBottom: '1px solid var(--row-divider)', alignItems: 'center' }}>
            <span onClick={() => ipo.symbol && setSymbol(ipo.symbol)} style={{ fontWeight: 700, color: 'var(--accent)', cursor: ipo.symbol ? 'pointer' : 'default' }}>{ipo.symbol || '—'}</span>
            <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }} title={`${ipo.companyName}${ipo.leadUnderwriters ? ` · ${ipo.leadUnderwriters}` : ''}`}>{ipo.companyName}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: STATUS_COLOR[ipo.status], border: `1px solid ${STATUS_COLOR[ipo.status]}`, borderRadius: 2, padding: '0 4px', justifySelf: 'start' }}>{ipo.status}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{ipo.expectedPricingDate ?? '—'}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ipo.offerShares != null ? `${(ipo.offerShares / 1e6).toFixed(1)}M` : '—'}</span>
            <span style={{ color: 'var(--text-bright)', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {ipo.priceRangeLow != null && ipo.priceRangeHigh != null ? `$${ipo.priceRangeLow.toFixed(2)}–$${ipo.priceRangeHigh.toFixed(2)}` : '—'}
            </span>
            <a href={`https://www.sec.gov/cgi-bin/srqsb?text=${encodeURIComponent(ipo.symbol || ipo.companyName)}`} target="_blank" rel="noreferrer" title={`SEC S-1 search: ${ipo.companyName}`} onClick={(e) => { e.stopPropagation(); void s1SearchUrl(ipo); }} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: 9 }}>↗</a>
          </div>
        ))}
      </div>

      <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)', flexShrink: 0 }}>
        SOURCE: NASDAQ IPO CALENDAR · S-1 LINKS RESOLVE VIA SEC EDGAR FULL-TEXT SEARCH
      </div>
    </div>
  );
}
