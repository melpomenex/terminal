'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTerminalContext } from '@/context/terminal-context';
import type { StructuredTranscript, TranscriptMetadata, TranscriptSegment } from '@/lib/providers/contracts';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import type { DataProvenance } from '@/lib/types/provenance';

/**
 * TRAN — Earnings call transcripts with prepared remarks / Q&A tabs, speaker
 * role filters, full-text keyword search with jump-to-match, and AI
 * extraction anchors (each segment carries a stable id the AI Brain cites).
 */
export default function TranscriptsPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [list, setList] = useState<TranscriptMetadata[]>([]);
  const [provenance, setProvenance] = useState<DataProvenance | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<StructuredTranscript | null>(null);
  const [section, setSection] = useState<'PREPARED_REMARKS' | 'Q_AND_A'>('PREPARED_REMARKS');
  const [roleFilter, setRoleFilter] = useState<'ALL' | TranscriptSegment['speakerRole']>('ALL');
  const [query, setQuery] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setTranscript(null);
    fetch(`/api/v2/transcripts?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((j) => {
        setList(j.transcripts ?? []);
        setProvenance(j.provenance ?? null);
        setSelected((j.transcripts ?? [])[0]?.id ?? null);
        if ((j.transcripts ?? []).length === 0) setError('NO PUBLIC TRANSCRIPTS INDEXED FOR ' + symbol);
      })
      .catch(() => setError('TRANSCRIPT SOURCE UNREACHABLE'))
      .finally(() => setLoading(false));
  }, [symbol]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setTranscript(null);
    fetch(`/api/v2/transcripts?id=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setTranscript(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'transcript load failed'))
      .finally(() => setLoading(false));
  }, [selected]);

  const segments = useMemo(() => {
    let segs = transcript?.segments ?? [];
    segs = segs.filter((s) => s.section === section);
    if (roleFilter !== 'ALL') segs = segs.filter((s) => s.speakerRole === roleFilter);
    return segs;
  }, [transcript, section, roleFilter]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as number[];
    const idxs: number[] = [];
    segments.forEach((s, i) => { if (s.text.toLowerCase().includes(q) || s.speakerName.toLowerCase().includes(q)) idxs.push(i); });
    return idxs;
  }, [query, segments]);

  // Virtualized transcript body: full calls run to tens of thousands of
  // words across 60+ segments; mounting only visible segments keeps
  // scrolling and keyword jumps at 60 FPS.
  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 120,
    overscan: 6,
  });

  const jumpTo = useCallback((i: number) => {
    if (matches.length === 0) return;
    const next = ((i % matches.length) + matches.length) % matches.length;
    setMatchIdx(next);
    virtualizer.scrollToIndex(matches[next], { align: 'center' });
  }, [matches, virtualizer]);

  const speakers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of transcript?.segments ?? []) counts.set(s.speakerName, (counts.get(s.speakerName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [transcript]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>TRAN · <span style={{ color: 'var(--accent)' }}>{symbol}</span></span>
        <select
          value={selected ?? ''}
          onChange={(e) => setSelected(e.target.value)}
          style={{ background: 'var(--surface-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 2, fontSize: 9, padding: '1px 4px', fontFamily: 'var(--font)', maxWidth: 150 }}
        >
          {list.map((t) => <option key={t.id} value={t.id}>{t.quarterLabel}{t.callDate ? ` · ${t.callDate}` : ''}</option>)}
        </select>
        {provenance && <ProvenanceBadge provenance={provenance} compact />}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {([['PREPARED_REMARKS', 'PREPARED'], ['Q_AND_A', 'Q&A']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSection(k)} style={{ fontSize: 9, padding: '1px 7px', border: `1px solid ${section === k ? 'var(--accent)' : 'var(--border-soft)'}`, background: section === k ? 'var(--accent-soft)' : 'transparent', color: section === k ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['ALL', 'EXECUTIVE', 'ANALYST', 'OPERATOR'] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{ fontSize: 8, padding: '1px 5px', border: `1px solid ${roleFilter === r ? 'var(--accent)' : 'var(--border-soft)'}`, background: roleFilter === r ? 'var(--accent-soft)' : 'transparent', color: roleFilter === r ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setMatchIdx(0); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); jumpTo(matchIdx + (e.shiftKey ? -1 : 1)); } }}
          placeholder="search transcript…"
          style={{ flex: 1, minWidth: 80, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none' }}
        />
        {query && (
          <span style={{ fontSize: 9, color: 'var(--text-dim)', display: 'flex', gap: 3, alignItems: 'center' }}>
            <button onClick={() => jumpTo(matchIdx - 1)} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 10 }}>▲</button>
            {matches.length ? matchIdx + 1 : 0}/{matches.length}
            <button onClick={() => jumpTo(matchIdx + 1)} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 10 }}>▼</button>
          </span>
        )}
      </div>

      {/* Body */}
      {loading && <div style={{ padding: 10, color: 'var(--text-dim)' }}>LOADING TRANSCRIPT…</div>}
      {error && !loading && (
        <div style={{ padding: 12, color: 'var(--negative)', fontSize: 10, lineHeight: 1.5 }}>
          {error}
          <div style={{ color: 'var(--text-faint)', marginTop: 4 }}>Transcripts are sourced from public earnings-call records. When none are indexed, Qube reports UNAVAILABLE rather than generating text.</div>
        </div>
      )}
      {!loading && !error && transcript && (
        <>
          <div style={{ padding: '3px 8px', fontSize: 9, color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)', display: 'flex', gap: 10, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{transcript.metadata.quarterLabel}</span>
            <span>{transcript.metadata.callDate}</span>
            <span>{transcript.metadata.participantCount} speakers</span>
            <span>{transcript.metadata.wordCount?.toLocaleString()} words</span>
            {transcript.metadata.sourceUrl && <a href={transcript.metadata.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', marginLeft: 'auto' }}>SOURCE ↗</a>}
          </div>
          <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px' }}>
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const seg = segments[virtualRow.index];
                const i = virtualRow.index;
                const isMatch = query.trim() && matches.includes(i);
                return (
                  <div
                    key={seg.id}
                    data-index={i}
                    data-seg-idx={i}
                    data-transcript-anchor={seg.id}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      marginBottom: 8, background: isMatch ? 'var(--accent-soft)' : 'transparent',
                      borderRadius: 2, padding: isMatch ? '2px 4px' : 0,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 1 }}>
                      <span style={{ fontWeight: 700, color: seg.speakerRole === 'EXECUTIVE' ? 'var(--accent)' : seg.speakerRole === 'ANALYST' ? '#6b8fbd' : 'var(--text-dim)' }}>{seg.speakerName}</span>
                      <span style={{ fontSize: 8, color: 'var(--text-faint)', border: '1px solid var(--border-soft)', padding: '0 3px', borderRadius: 2 }}>{seg.speakerRole}</span>
                      <span style={{ fontSize: 8, color: 'var(--text-faint)' }}>¶{seg.paragraphIndex}</span>
                    </div>
                    <div style={{ color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{seg.text}</div>
                  </div>
                );
              })}
            </div>
            {segments.length === 0 && <div style={{ color: 'var(--text-dim)', padding: 8 }}>NO SEGMENTS IN THIS VIEW</div>}
          </div>
          {speakers.length > 0 && (
            <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 8, flexShrink: 0, overflow: 'hidden' }}>
              {speakers.map(([name, n]) => <span key={name}>{name} ×{n}</span>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
