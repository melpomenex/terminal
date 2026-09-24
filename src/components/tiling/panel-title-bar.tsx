'use client';

import { useRef, useState } from 'react';
import type { PanelConfig } from '@/lib/tiling-types';
import { LINK_GROUP_COLORS, LINK_GROUP_HEX } from '@/lib/tiling-types';
import { useTilingContext } from '@/context/tiling-context';

export default function PanelTitleBar({ panel }: { panel: PanelConfig }) {
  const { removePanel, setDragState, activePanelId, setActivePanelId, maximizedPanelId, maximizePanel, restoreLayout, setPanelLinkGroup } = useTilingContext();
  const barRef = useRef<HTMLDivElement>(null);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-close-btn]')) return;
    if ((e.target as HTMLElement).closest('[data-max-btn]')) return;
    if ((e.target as HTMLElement).closest('[data-link-btn]')) return;
    e.preventDefault();
    setActivePanelId(panel.id);
    const bar = barRef.current;
    if (!bar) return;
    bar.setPointerCapture(e.pointerId);
    const rect = bar.getBoundingClientRect();

    const ds = {
      panelId: panel.id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    setDragState(ds);

    const onMove = (ev: PointerEvent) => {
      setDragState({
        ...ds,
        offsetX: ev.clientX - rect.left,
        offsetY: ev.clientY - rect.top,
      });
    };

    const onUp = (ev: PointerEvent) => {
      bar.releasePointerCapture(ev.pointerId);
      bar.removeEventListener('pointermove', onMove);
      bar.removeEventListener('pointerup', onUp);
    };

    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', onUp);
  };

  const handleDoubleClick = () => {
    if (maximizedPanelId === panel.id) restoreLayout();
    else maximizePanel(panel.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      removePanel(panel.id);
    }
  };

  const isMaximized = maximizedPanelId === panel.id;
  const isActive = activePanelId === panel.id;
  const linkGroup = panel.linkGroup ?? 'UNLINKED';
  const linkHex = LINK_GROUP_HEX[linkGroup];

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      style={{
        display: 'flex', alignItems: 'center', height: 20, minHeight: 20,
        padding: '0 6px', background: isActive ? 'var(--surface-sunken)' : 'var(--panel-bg)',
        borderBottom: '1px solid var(--border)', cursor: 'grab', userSelect: 'none',
        gap: 6, flexShrink: 0,
        transition: 'background var(--motion-fast) var(--ease-out)',
      }}
    >
      {linkHex && (
        <span
          aria-label={`Link group ${linkGroup}`}
          title={`Color link: ${linkGroup} — click to change`}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: linkHex, boxShadow: `0 0 5px ${linkHex}`,
            flexShrink: 0, cursor: 'pointer',
          }}
        />
      )}
      <span className={isActive ? 'glow' : undefined} style={{ fontSize: 'var(--font-size-xs)', color: isActive ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 700, letterSpacing: 1, flex: 1, transition: 'color var(--motion-fast) var(--ease-out)' }}>
        {panel.label}
      </span>
      {panel.instrument && (
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-mute)', fontWeight: 600 }}>{panel.instrument.symbol}</span>
      )}

      <div style={{ position: 'relative' }}>
        <button
          data-link-btn="true"
          onClick={(e) => { e.stopPropagation(); setLinkMenuOpen((v) => !v); setActivePanelId(panel.id); }}
          className="row-hover"
          style={{
            width: 16, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: linkHex ?? 'var(--text-faint)', fontSize: 9, background: 'transparent', cursor: 'pointer',
            padding: 0, lineHeight: 1, border: `1px solid ${linkMenuOpen ? 'var(--border-light)' : 'transparent'}`, borderRadius: 2,
          }}
          title="Color link group — panels sharing a color update together"
        >
          ⛓
        </button>
        {linkMenuOpen && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 16, right: 0, background: 'var(--surface-raised)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
              zIndex: 'var(--z-dropdown)', display: 'flex', gap: 4, padding: 5,
            }}
          >
            {LINK_GROUP_COLORS.map((g) => {
              const hex = LINK_GROUP_HEX[g];
              const active = g === linkGroup;
              return (
                <button
                  key={g}
                  title={g === 'UNLINKED' ? 'Unlinked (independent)' : g}
                  onClick={(e) => { e.stopPropagation(); setPanelLinkGroup(panel.id, g); setLinkMenuOpen(false); }}
                  style={{
                    width: 14, height: 14, borderRadius: '50%', cursor: 'pointer',
                    background: hex ?? 'transparent',
                    border: hex ? `2px solid ${active ? 'var(--text-bright)' : 'transparent'}` : '1px dashed var(--text-faint)',
                    boxShadow: active && hex ? `0 0 6px ${hex}` : undefined,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <button
        data-max-btn="true"
        onClick={(e) => { e.stopPropagation(); handleDoubleClick(); }}
        className="row-hover"
        style={{
          width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-dim)', fontSize: 10, background: 'transparent', cursor: 'pointer',
          padding: 0, lineHeight: 1, border: 'none',
        }}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? '▪' : '▣'}
      </button>
      <button
        data-close-btn="true"
        onClick={(e) => { e.stopPropagation(); removePanel(panel.id); }}
        className="row-hover"
        style={{
          width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-dim)', fontSize: 10, background: 'transparent', cursor: 'pointer',
          padding: 0, lineHeight: 1, border: 'none',
        }}
        title="Close panel"
      >
        ✕
      </button>
    </div>
  );
}
