'use client';

import { useEffect } from 'react';
import type { PanelType } from '@/lib/tiling-types';
import { useTilingContext } from '@/context/tiling-context';

const ITEMS: { label: string; type: PanelType; dir: 'vertical' | 'horizontal' }[] = [
  { label: 'New Brain Chat', type: 'brain-chat', dir: 'vertical' },
  { label: 'New Brain Settings', type: 'brain-settings', dir: 'vertical' },
  { label: 'New Finance Research', type: 'finance-research', dir: 'vertical' },
  { label: 'New Monitor', type: 'quote-monitor', dir: 'vertical' },
  { label: 'New Chart', type: 'chart', dir: 'vertical' },
  { label: 'New Description', type: 'security-description', dir: 'vertical' },
  { label: 'New News', type: 'news', dir: 'vertical' },
  { label: 'New Fundamentals', type: 'fundamentals', dir: 'vertical' },
  { label: 'New Portfolio', type: 'portfolio', dir: 'vertical' },
  { label: 'New FX Rates', type: 'fx-rates', dir: 'vertical' },
  { label: 'New Commodity', type: 'commodity', dir: 'vertical' },
  { label: 'New Options Chain', type: 'options-chain', dir: 'vertical' },
  { label: 'New Econ Calendar', type: 'economic-calendar', dir: 'vertical' },
  { label: 'New Earnings', type: 'earnings', dir: 'vertical' },
  { label: 'New Analyst Ratings', type: 'analyst-ratings', dir: 'vertical' },
];

export default function ContextMenu() {
  const { contextMenu, setContextMenu, addPanel, layout } = useTilingContext();

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('click', handler); window.removeEventListener('keydown', handler); };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  // Keep menu in viewport
  const x = Math.min(contextMenu.x, window.innerWidth - 160);
  const y = Math.min(contextMenu.y, window.innerHeight - (ITEMS.length * 24 + 8));

  const targetId = contextMenu.targetPanelId || (
    // Find first leaf as fallback
    (() => {
      function firstLeaf(n: any): string | null {
        if (n?.type === 'leaf') return n.panel.id;
        if (n?.type === 'split') return firstLeaf(n.first) ?? firstLeaf(n.second);
        return null;
      }
      return firstLeaf(layout);
    })()
  );

  return (
    <div
      className="overlay-enter"
      style={{
        position: 'fixed', left: x, top: y, zIndex: 'var(--z-dropdown)',
        background: 'var(--panel-bg)', border: '1px solid var(--border)',
        minWidth: 150, padding: '4px 0',
        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {ITEMS.map((item) => (
        <button
          key={item.type}
          onClick={() => { if (targetId) addPanel(targetId, item.type, item.dir); setContextMenu(null); }}
          className="row-hover"
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '4px 12px',
            background: 'transparent', color: 'var(--text)', fontSize: 'var(--font-size-sm)',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
