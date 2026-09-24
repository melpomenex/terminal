'use client';

import { useTilingContext } from '@/context/tiling-context';

export default function DragOverlay() {
  const { dragState, layout } = useTilingContext();

  if (!dragState) return null;

  const ds = dragState;
  const leaf = (() => {
    function find(n: any): any { if (n?.type === 'leaf' && n.panel.id === ds.panelId) return n; if (n?.type === 'split') return find(n.first) ?? find(n.second); return null; }
    return find(layout);
  })();

  return (
    <div
      style={{
        position: 'fixed',
        left: ds.offsetX - 20,
        top: ds.offsetY - 10,
        pointerEvents: 'none',
        zIndex: 10000,
        background: 'var(--panel-bg)',
        border: '1px solid var(--amber-dim)',
        padding: '4px 12px',
        fontSize: 10,
        color: 'var(--amber-bright)',
        fontWeight: 700,
        letterSpacing: 1,
        whiteSpace: 'nowrap',
        opacity: 0.9,
      }}
    >
      {leaf?.panel?.label ?? 'PANEL'}
    </div>
  );
}
