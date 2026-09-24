'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetClass, InstrumentRef } from '@/lib/types/instrument';
import { securityMasterResolver } from '@/lib/security-master/resolver';

interface RemoteHit {
  symbol: string;
  name: string | null;
  exchange: string | null;
  type: string | null;
}

interface FinderRow {
  ref: InstrumentRef;
  name: string;
  exchange: string;
  score: number;
  source: 'master' | 'remote';
}

const ASSET_CLASS_FILTERS: Array<{ key: AssetClass | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'ALL' },
  { key: 'EQUITY', label: 'EQUITY' },
  { key: 'ETF', label: 'ETF' },
  { key: 'INDEX', label: 'INDEX' },
  { key: 'OPTION', label: 'OPTION' },
  { key: 'FUTURE', label: 'FUTURES' },
  { key: 'FX', label: 'FX' },
  { key: 'CRYPTO', label: 'CRYPTO' },
  { key: 'BOND_GOVT', label: 'GOVTS' },
  { key: 'COMMODITY', label: 'COMMDTY' },
];

interface SecurityFinderModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: InstrumentRef) => void;
}

/**
 * SECF — global multi-asset security finder. Fuzzy-searches the local
 * security master plus the remote search API, with asset-class filter pills
 * and full keyboard navigation (↑↓ select, Enter load, Esc close).
 */
export default function SecurityFinderModal({ open, onClose, onSelect }: SecurityFinderModalProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AssetClass | 'ALL'>('ALL');
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState<RemoteHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setRemote([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced remote search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setRemote([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/yfin/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setRemote(((d.quotes ?? []) as Array<Record<string, unknown>>).map((item) => ({
          symbol: String(item.symbol ?? ''),
          name: item.name != null ? String(item.name) : null,
          exchange: item.exchange != null ? String(item.exchange) : null,
          type: item.type != null ? String(item.type) : null,
        }))))
        .catch(() => setRemote([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const rows = useMemo<FinderRow[]>(() => {
    const q = query.trim();
    const out: FinderRow[] = [];

    // Local security master
    for (const entry of securityMasterResolver.entries()) {
      if (filter !== 'ALL' && entry.assetClass !== filter) continue;
      const score = Math.max(
        securityMasterResolver.fuzzyScore(q, entry.symbol),
        securityMasterResolver.fuzzyScore(q, entry.name) - 5,
      );
      if (q && score <= 0) continue;
      out.push({
        ref: {
          id: `${entry.assetClass}:${entry.mic}:${entry.symbol}`,
          symbol: entry.symbol,
          displaySymbol: entry.symbol,
          assetClass: entry.assetClass,
          name: entry.name,
          exchange: entry.mic,
        },
        name: entry.name,
        exchange: entry.mic,
        score: q ? score : 50,
        source: 'master',
      });
    }

    // Remote hits (deduped against master)
    const seen = new Set(out.map((r) => r.ref.symbol));
    for (const hit of remote) {
      if (seen.has(hit.symbol)) continue;
      const ref = securityMasterResolver.resolve(hit.symbol);
      if (!ref) continue;
      if (filter !== 'ALL' && ref.assetClass !== filter) continue;
      out.push({
        ref: { ...ref, name: hit.name ?? ref.name, exchange: hit.exchange ?? ref.exchange },
        name: hit.name ?? '',
        exchange: hit.exchange ?? '',
        score: 55,
        source: 'remote',
      });
    }

    // Bare-ticker direct resolve at the top when typed
    const direct = q ? securityMasterResolver.resolve(q) : null;
    if (direct && (filter === 'ALL' || direct.assetClass === filter) && !out.some((r) => r.ref.symbol === direct.symbol)) {
      out.unshift({ ref: direct, name: direct.name ?? '', exchange: direct.exchange ?? '', score: 100, source: 'master' });
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 60);
  }, [query, remote, filter]);

  useEffect(() => { setCursor(0); }, [query, filter]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const select = useCallback((row: FinderRow) => {
    onSelect(row.ref);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[cursor]) select(rows[cursor]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Tab') { e.preventDefault(); const i = ASSET_CLASS_FILTERS.findIndex((f) => f.key === filter); setFilter(ASSET_CLASS_FILTERS[(i + 1) % ASSET_CLASS_FILTERS.length].key); }
  };

  if (!open) return null;

  return (
    <div
      className="fade-enter"
      role="dialog"
      aria-label="Security Finder (SECF)"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="overlay-enter"
        style={{
          width: 'min(680px, 94vw)', maxHeight: '72vh', display: 'flex', flexDirection: 'column',
          background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 'var(--font-size-sm)', letterSpacing: 1 }}>SECF</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search any instrument — AAPL, EURUSD, BTC-USD, SPX, CL1 Comdty…"
            autoComplete="off" spellCheck={false}
            style={{
              flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius)',
              padding: '6px 10px', color: 'var(--text-bright)', fontFamily: 'var(--font)', fontSize: 'var(--font-size-base)', outline: 'none',
              textTransform: 'uppercase',
            }}
          />
          {searching && <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xxs)' }}>searching…</span>}
          <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-faint)' }}>{rows.length} hits</span>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 12px', borderBottom: '1px solid var(--border-soft)' }}>
          {ASSET_CLASS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? 'var(--accent)' : 'transparent',
                color: filter === f.key ? 'var(--text-inverse)' : 'var(--text-dim)',
                border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border-soft)'}`,
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xxs)', fontWeight: 700,
                letterSpacing: 0.5, padding: '1px 7px', cursor: 'pointer', fontFamily: 'var(--font)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {rows.length === 0 && (
            <div style={{ padding: '24px 14px', color: 'var(--text-mute)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              No instruments match “{query.toUpperCase()}”. Try a ticker, ISIN-style root, or an asset-class pill.
            </div>
          )}
          {rows.map((row, idx) => {
            const focused = idx === cursor;
            return (
              <div
                key={`${row.ref.id}-${idx}`}
                data-idx={idx}
                tabIndex={-1}
                onMouseEnter={() => setCursor(idx)}
                onClick={() => select(row)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer',
                  background: focused ? 'var(--accent-soft)' : 'transparent',
                  borderBottom: '1px solid var(--row-divider)',
                }}
              >
                <span style={{ minWidth: 26, fontSize: 'var(--font-size-xxs)', fontWeight: 700, color: focused ? 'var(--accent)' : 'var(--text-faint)' }}>
                  {idx + 1}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 'var(--font-size-base)', minWidth: 110 }}>{row.ref.symbol}</span>
                <span style={{ color: 'var(--text)', fontSize: 'var(--font-size-sm)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-dim)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '0 5px' }}>
                  {row.ref.assetClass}
                </span>
                <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-faint)', minWidth: 44, textAlign: 'right' }}>{row.exchange || row.ref.exchange}</span>
                <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-faint)', width: 46, textAlign: 'right' }}>
                  {row.source === 'master' ? 'MASTER' : 'LIVE'}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border-soft)', fontSize: 'var(--font-size-xxs)', color: 'var(--text-faint)', display: 'flex', gap: 14 }}>
          <span>↑↓ NAVIGATE</span><span>ENTER LOAD</span><span>TAB CYCLE FILTER</span><span>ESC CLOSE</span>
          <span style={{ marginLeft: 'auto' }}>QUBE SECURITY MASTER + LIVE SEARCH</span>
        </div>
      </div>
    </div>
  );
}
