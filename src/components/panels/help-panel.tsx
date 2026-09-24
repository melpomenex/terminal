'use client';

import { useMemo, useState } from 'react';
import { commandRegistry, type CommandCategory, type CommandDefinition } from '@/lib/commands/command-registry';

const CATEGORY_ORDER: CommandCategory[] = ['MARKET_DATA', 'COMPANY_RESEARCH', 'ANALYTICS', 'WORKSPACE', 'AI', 'ACTIONS'];

const CATEGORY_TITLES: Record<CommandCategory, string> = {
  MARKET_DATA: 'MARKET DATA',
  COMPANY_RESEARCH: 'COMPANY RESEARCH',
  ANALYTICS: 'ANALYTICS & FLOW',
  WORKSPACE: 'WORKSPACE & PORTFOLIO',
  AI: 'AI BRAIN',
  ACTIONS: 'ACTIONS & SYSTEM',
};

const SHORTCUTS: Array<[string, string]> = [
  ['Ctrl+K', 'Focus command bar (fuzzy search)'],
  ['↑/↓ + Enter', 'Navigate command palette'],
  ['Tab', 'Cycle panel focus'],
  ['Ctrl+W', 'Close active panel'],
  ['Ctrl+M', 'Maximize / restore panel'],
  ['Ctrl+H/J/K/L', 'Vim-style focus move'],
  ['Ctrl+Shift+H/J/K/L', 'Swap panel'],
  ['Ctrl+Shift+Arrows', 'Resize split'],
  ['1-9', 'Jump to watchlist row'],
  ['Escape', 'Close overlay'],
  ['Click ⛓ in title bar', 'Set panel color-link group'],
];

/**
 * HELP — auto-generated from the command registry. Command metadata,
 * aliases, usage and examples reflect the registry in real time; new
 * commands appear here without manual edits.
 */
export default function HelpPanel({ panelId }: { panelId?: string }) {
  const [query, setQuery] = useState('');
  void panelId;

  const grouped = useMemo(() => {
    const q = query.trim().toUpperCase();
    const byCat = commandRegistry.byCategory();
    const out: Array<{ category: CommandCategory; commands: CommandDefinition[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      const commands = (byCat[cat] ?? []).filter((c) =>
        !q ||
        c.mnemonic.includes(q) ||
        c.name.toUpperCase().includes(q) ||
        c.description.toUpperCase().includes(q) ||
        c.aliases.some((a) => a.includes(q)),
      );
      if (commands.length > 0) out.push({ category: cat, commands });
    }
    return out;
  }, [query]);

  const total = commandRegistry.all().length;
  const shortcuts = useMemo(
    () => (query.trim() ? SHORTCUTS.filter(([k, d]) => k.toUpperCase().includes(query.toUpperCase()) || d.toUpperCase().includes(query.toUpperCase())) : SHORTCUTS),
    [query],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font)' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface-raised)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.5 }}>HELP</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter commands…"
          style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 11, padding: '2px 8px', outline: 'none', width: 180, fontFamily: 'var(--font)' }}
        />
        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {total} REGISTRY COMMANDS · AUTO-GENERATED
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 14px' }}>
        {grouped.length === 0 && (
          <div style={{ color: 'var(--text-mute)', fontSize: 11, padding: '10px 0' }}>No command matches “{query.toUpperCase()}”.</div>
        )}
        {grouped.map(({ category, commands }) => (
          <div key={category} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.1, borderBottom: '1px solid var(--border)', paddingBottom: 3, marginBottom: 6 }}>
              {CATEGORY_TITLES[category]}
            </div>
            {commands.map((cmd) => (
              <div key={cmd.mnemonic} style={{ padding: '4px 0', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-bright)', fontWeight: 700, minWidth: 90 }}>{cmd.mnemonic}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 9, border: '1px solid var(--border-soft)', borderRadius: 2, padding: '0 4px' }}>{CATEGORY_TITLES[cmd.category]}</span>
                  {cmd.takesInstrument && <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>accepts &lt;TICKER&gt; target</span>}
                  <span style={{ color: 'var(--text-mute)', flex: 1 }}>{cmd.description}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-dim)', marginTop: 2, paddingLeft: 98 }}>
                  <span>usage: <code style={{ color: 'var(--text-bright)' }}>{cmd.usage}</code></span>
                  {cmd.aliases.length > 0 && <span>aliases: <code style={{ color: 'var(--text-bright)' }}>{cmd.aliases.join(', ')}</code></span>}
                </div>
                {cmd.examples.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1, paddingLeft: 98 }}>
                    e.g. {cmd.examples.slice(0, 3).map((ex) => <code key={ex} style={{ color: 'var(--text-dim)', marginRight: 8 }}>{ex}</code>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {shortcuts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.1, borderBottom: '1px solid var(--border)', paddingBottom: 3, marginBottom: 6 }}>KEYBOARD SHORTCUTS</div>
            {shortcuts.map(([key, desc]) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '260px 1fr', padding: '2px 0', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{key}</span>
                <span style={{ color: 'var(--text-dim)' }}>{desc}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.1, borderBottom: '1px solid var(--border)', paddingBottom: 3, marginBottom: 6 }}>COLOR LINK GROUPS</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Panels sharing a color-link group (RED / YELLOW / GREEN / BLUE / MAGENTA / CYAN) update their instrument
            together — change the ticker in one pane and every pane in that group follows. UNLINKED panes stay
            independent. Set a group via the ⛓ button in any panel title bar.
          </div>
        </div>
      </div>
    </div>
  );
}
