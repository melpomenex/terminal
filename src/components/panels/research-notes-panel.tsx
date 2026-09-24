'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { storageManager } from '@/lib/persistence/storage-manager';
import { securityMasterResolver } from '@/lib/security-master/resolver';

interface ResearchNote {
  id: string;
  title: string;
  content: string;
  associatedSymbols: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_COLLECTION = 'researchNotes' as const;
const AUTOSAVE_MS = 900;

/** Minimal, dependency-free markdown -> HTML renderer for notes. */
function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc(md).split('\n');
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const l = line.trimEnd();
    const inline = (s: string) => s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:#1a1a1f;padding:0 3px;border-radius:2px">$1</code>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color:#4d9fff">$1</a>');
    if (/^###\s/.test(l)) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h4 style="margin:8px 0 3px;color:#FFD700;font-size:12px">${inline(l.slice(4))}</h4>`); continue; }
    if (/^##\s/.test(l)) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h3 style="margin:10px 0 4px;color:#FFD700;font-size:13px">${inline(l.slice(3))}</h3>`); continue; }
    if (/^#\s/.test(l)) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h2 style="margin:10px 0 5px;color:#FFB000;font-size:14px">${inline(l.slice(2))}</h2>`); continue; }
    if (/^[-*]\s/.test(l)) { if (!inList) { out.push('<ul style="margin:4px 0 4px 18px">'); inList = true; } out.push(`<li style="margin:2px 0">${inline(l.slice(2))}</li>`); continue; }
    if (inList) { out.push('</ul>'); inList = false; }
    if (!l) { out.push('<div style="height:6px"></div>'); continue; }
    if (/^>\s/.test(l)) { out.push(`<blockquote style="border-left:2px solid #996600;margin:4px 0;padding:2px 8px;color:#888899">${inline(l.slice(2))}</blockquote>`); continue; }
    out.push(`<p style="margin:3px 0;line-height:1.55">${inline(l)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

/**
 * NOTE — Rich research notes: multi-document tabs, markdown formatting,
 * ticker tag associations, full-text search, and autosave through the
 * schema-versioned persistence manager. Distinct from the tagged trading
 * journal in notes-panel.tsx, which is preserved untouched.
 */
export default function ResearchNotesPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  // Initial load from persistence
  useEffect(() => {
    storageManager.load<ResearchNote[]>(STORAGE_COLLECTION, []).then((stored) => {
      loaded.current = true;
      setNotes(stored);
      setActiveId(stored[0]?.id ?? null);
    });
  }, []);

  // Debounced autosave
  const persist = useCallback((next: ResearchNote[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved('saving');
    saveTimer.current = setTimeout(() => {
      void storageManager.save(STORAGE_COLLECTION, next).then(() => {
        setSaved('saved');
        setTimeout(() => setSaved('idle'), 1200);
      });
    }, AUTOSAVE_MS);
  }, []);

  const update = useCallback((patch: Partial<ResearchNote> & { id: string }) => {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === patch.id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n));
      persist(next);
      return next;
    });
  }, [persist]);

  const createNote = useCallback(() => {
    const note: ResearchNote = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`,
      title: 'Untitled research',
      content: `# Thesis\n\n## Bull case\n- \n\n## Bear case\n- \n\n## Catalysts\n- \n`,
      associatedSymbols: [symbol],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => {
      const next = [note, ...prev];
      persist(next);
      return next;
    });
    setActiveId(note.id);
    setMode('edit');
  }, [symbol, persist]);

  const deleteNote = useCallback((id: string) => {
    if (!window.confirm('Delete this research note? This cannot be undone.')) return;
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      persist(next);
      return next;
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }, [persist]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.associatedSymbols.some((s) => s.toLowerCase().includes(q)) ||
      n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [notes, search]);

  const occurrences = useMemo(() => {
    if (!active || !search.trim()) return 0;
    return (active.content.toLowerCase().split(search.trim().toLowerCase()).length - 1) + (active.title.toLowerCase().split(search.trim().toLowerCase()).length - 1);
  }, [active, search]);

  const addTickerTag = useCallback((raw: string) => {
    const ref = securityMasterResolver.resolve(raw);
    if (!active || !ref || active.associatedSymbols.includes(ref.symbol)) return;
    update({ id: active.id, associatedSymbols: [...active.associatedSymbols, ref.symbol] });
  }, [active, update]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>NOTE · RESEARCH</span>
        <button onClick={createNote} style={{ fontSize: 9, padding: '1px 8px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}>+ NEW</button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="full-text search…" style={{ flex: 1, minWidth: 60, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none' }} />
        {search && <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{filteredNotes.length} notes{active ? ` · ${occurrences} hits` : ''}</span>}
        <span style={{ fontSize: 8, color: saved === 'saved' ? 'var(--positive)' : 'var(--text-faint)' }}>
          {saved === 'saving' ? 'SAVING…' : saved === 'saved' ? '✓ SAVED' : 'AUTOSAVE'}
        </span>
      </div>

      {/* Document tabs */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', gap: 2, padding: '2px 6px', borderBottom: '1px solid var(--border-soft)', overflowX: 'auto', flexShrink: 0 }}>
          {filteredNotes.map((n) => (
            <div
              key={n.id}
              onClick={() => { setActiveId(n.id); setMode('read'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 3, background: activeId === n.id ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${activeId === n.id ? 'var(--accent)' : 'transparent'}`, fontSize: 9, color: activeId === n.id ? 'var(--accent)' : 'var(--text-dim)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              <span>{n.title || 'Untitled'}</span>
              <span onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }} style={{ color: 'var(--text-faint)', fontSize: 8 }}>×</span>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {notes.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-mute)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>NO RESEARCH DOCUMENTS</span>
          <button onClick={createNote} style={{ fontSize: 10, padding: '4px 14px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}>Create first note</button>
        </div>
      )}

      {active && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Note header: title + tags */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, flexWrap: 'wrap' }}>
            {mode === 'edit' ? (
              <input value={active.title} onChange={(e) => update({ id: active.id, title: e.target.value })} style={{ flex: 1, minWidth: 120, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 11, padding: '2px 6px', fontFamily: 'var(--font)', outline: 'none' }} />
            ) : (
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12 }}>{active.title || 'Untitled'}</span>
            )}
            {active.associatedSymbols.map((s) => (
              <span key={s} onClick={() => { /* linked pane load */ }} style={{ fontSize: 8, border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0 5px', borderRadius: 8, cursor: 'pointer' }}>{s} ×</span>
            ))}
            {mode === 'edit' && (
              <input
                placeholder="+ticker"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) { addTickerTag(v); (e.target as HTMLInputElement).value = ''; }
                  }
                }}
                style={{ width: 64, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-dim)', fontSize: 9, padding: '1px 5px', fontFamily: 'var(--font)', outline: 'none', textTransform: 'uppercase' }}
              />
            )}
            <button onClick={() => setMode(mode === 'edit' ? 'read' : 'edit')} style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 8px', border: '1px solid var(--border-soft)', background: mode === 'edit' ? 'var(--accent-soft)' : 'transparent', color: mode === 'edit' ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>
              {mode === 'edit' ? 'PREVIEW' : 'EDIT MD'}
            </button>
          </div>

          {/* Content */}
          {mode === 'edit' ? (
            <textarea
              value={active.content}
              onChange={(e) => update({ id: active.id, content: e.target.value })}
              spellCheck={false}
              style={{ flex: 1, minHeight: 0, resize: 'none', background: 'var(--panel-bg)', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 11, padding: '8px 10px', lineHeight: 1.6 }}
            />
          ) : (
            <div
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px', color: 'var(--text)' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(active.content) }}
            />
          )}

          <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>MARKDOWN · {active.content.split(/\s+/).length} WORDS</span>
            <span>UPDATED {new Date(active.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
