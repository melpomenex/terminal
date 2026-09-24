'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import ArticleViewer from './article-viewer';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import type { DataProvenance } from '@/lib/types/provenance';
import type { NewsArticle } from '@/lib/providers/contracts';

function sourceColor(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 45%)`;
}

function formatTime(dateStr: string): { date: string; time: string } {
  if (!dateStr) return { date: '', time: '' };
  try {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  } catch {
    return { date: '', time: '' };
  }
}

const CATEGORIES = ['all', 'markets', 'earnings', 'economy', 'general'] as const;

/**
 * NEWS v2 — multi-source aggregated feed with multi-ticker filters,
 * watchlist linking, keyword include/exclude, category pills and the
 * in-terminal article reader.
 */
export default function NewsFeed({ panelId }: { panelId?: string }) {
  const { setSymbol, watchlist, watchlistKey, selectedArticle, setSelectedArticle, newsFilter, setNewsFilter } = useTerminalContext();
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [provenance, setProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const [tickerFilter, setTickerFilter] = useState<string[]>([]);
  const [watchlistLinked, setWatchlistLinked] = useState(false);
  const [excludeText, setExcludeText] = useState('');

  const effectiveTickers = useMemo(() => {
    if (watchlistLinked) return watchlist.map((w) => w.symbol);
    return tickerFilter;
  }, [watchlistLinked, watchlist, tickerFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (effectiveTickers.length > 0) params.set('tickers', effectiveTickers.join(','));
    if (category !== 'all') params.set('categories', category);
    if (newsFilter.keyword) params.set('q', newsFilter.keyword);
    if (excludeText.trim()) params.set('exclude', excludeText.split(',').map((s) => s.trim()).filter(Boolean).join(','));
    try {
      const res = await fetch(`/api/v2/news?${params.toString()}`);
      const json = await res.json();
      setItems(json.items ?? []);
      setProvenance(json.provenance ?? null);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveTickers, category, newsFilter.keyword, excludeText]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  // Refresh every 60s (news cadence, not quote cadence)
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (selectedArticle) {
    return <ArticleViewer url={selectedArticle} onBack={() => setSelectedArticle(null)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      {/* Filter toolbar */}
      <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: 10 }}>NEWS v2</span>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} style={{ fontSize: 8, padding: '1px 6px', border: `1px solid ${category === c ? 'var(--accent)' : 'var(--border-soft)'}`, background: category === c ? 'var(--accent-soft)' : 'transparent', color: category === c ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 8, cursor: 'pointer', textTransform: 'uppercase' }}>{c}</button>
          ))}
          <button onClick={() => setWatchlistLinked((v) => !v)} title={`Filter to active watchlist (${watchlistKey})`} style={{ fontSize: 8, padding: '1px 6px', border: `1px solid ${watchlistLinked ? 'var(--positive)' : 'var(--border-soft)'}`, background: watchlistLinked ? 'var(--positive-soft)' : 'transparent', color: watchlistLinked ? 'var(--positive)' : 'var(--text-dim)', borderRadius: 8, cursor: 'pointer' }}>
            ⛓ {watchlistLinked ? 'WATCHLIST' : 'ALL TICKERS'}
          </button>
          {provenance && <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={newsFilter.keyword}
            onChange={(e) => setNewsFilter({ ...newsFilter, keyword: e.target.value })}
            placeholder="include keyword…"
            style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none' }}
          />
          <input
            value={excludeText}
            onChange={(e) => setExcludeText(e.target.value)}
            placeholder="-exclude,words…"
            title="Comma-separated keywords to hide"
            style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-dim)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none' }}
          />
        </div>
        {!watchlistLinked && tickerFilter.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            {tickerFilter.map((t) => (
              <span key={t} style={{ fontSize: 8, border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0 4px', borderRadius: 8, cursor: 'pointer' }} onClick={() => setTickerFilter((prev) => prev.filter((x) => x !== t))}>{t} ×</span>
            ))}
          </div>
        )}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading && items.length === 0 && <div style={{ padding: 10, color: 'var(--text-dim)' }}>LOADING FEED…</div>}
        {!loading && items.length === 0 && <div style={{ padding: 10, color: 'var(--text-dim)' }}>NO ARTICLES MATCH FILTERS</div>}
        {items.map((item) => {
          const { date, time } = formatTime(item.publishedAt);
          const isBreaking = item.urgency === 'high';
          return (
            <div
              key={item.id}
              onClick={() => setSelectedArticle(item.url)}
              className="row-hover"
              style={{ padding: '5px 8px', borderBottom: '1px solid var(--row-divider)', cursor: 'pointer', background: isBreaking ? 'rgba(239,68,68,0.05)' : undefined }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 1 }}>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '0 4px', borderRadius: 2, background: sourceColor(item.source), color: '#000' }}>{item.source}</span>
                {isBreaking && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--negative)', animation: 'pulse 1.5s infinite' }}>● BREAKING</span>}
                <span style={{ fontSize: 8, color: 'var(--text-faint)' }}>{date} {time}</span>
                {item.category && <span style={{ fontSize: 7, color: 'var(--text-faint)', border: '1px solid var(--border-soft)', padding: '0 3px', borderRadius: 2, textTransform: 'uppercase' }}>{item.category}</span>}
              </div>
              <div style={{ color: isBreaking ? 'var(--text-bright)' : 'var(--text)', fontWeight: isBreaking ? 700 : 500, lineHeight: 1.3 }}>{item.title}</div>
              {item.tickers.length > 0 && (
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  {item.tickers.slice(0, 4).map((t) => (
                    <span key={t} onClick={(e) => { e.stopPropagation(); setSymbol(t); }} style={{ fontSize: 8, color: 'var(--accent)', border: '1px solid var(--border-soft)', padding: '0 3px', borderRadius: 2, cursor: 'pointer' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>{items.length} ARTICLES · {loading ? 'REFRESHING…' : 'LIVE RSS'}</span>
        <span>CLICK TO READ IN-TERMINAL</span>
      </div>
    </div>
  );
}
