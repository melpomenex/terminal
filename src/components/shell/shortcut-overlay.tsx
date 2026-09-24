'use client';

import { useEffect, useMemo, useState } from 'react';
import { SHORTCUTS, COMMANDS, type ShortcutEntry } from '@/lib/shortcuts';

export default function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filter = (list: ShortcutEntry[]) => {
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((e) => e.keys.toLowerCase().includes(query) || e.label.toLowerCase().includes(query) || e.category.toLowerCase().includes(query));
  };

  const groups = useMemo(() => {
    const all = [...SHORTCUTS, ...COMMANDS];
    const filtered = filter(all);
    const map = new Map<string, ShortcutEntry[]>();
    for (const e of filtered) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }
    return Array.from(map.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div onClick={onClose} className="fade-enter" style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="overlay-enter" style={{
        width: 'min(640px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="glow" style={{ fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>SHORTCUTS & COMMANDS</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            style={{ marginLeft: 'auto', width: 180, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--text-bright)', fontSize: 'var(--font-size-sm)', padding: '4px 8px', fontFamily: 'var(--font)' }}
          />
          <button onClick={onClose} className="row-hover" style={{ color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', cursor: 'pointer' }}>Esc</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 16px 16px' }}>
          {groups.length === 0 && <div style={{ padding: 16, color: 'var(--text-mute)', textAlign: 'center' }}>No matches.</div>}
          {groups.map(([category, items]) => (
            <div key={category} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 'var(--font-size-xxs)', fontWeight: 700, letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase' }}>{category}</div>
              {items.map((e, i) => (
                <div key={`${e.keys}-${i}`} className="row-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-bright)', fontSize: 'var(--font-size-sm)' }}>{e.label}</span>
                  <kbd style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', fontSize: 'var(--font-size-xxs)', color: 'var(--accent)' }}>{e.keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
