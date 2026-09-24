'use client';

import type { TilingNode, LeafNode, PanelType } from '@/lib/tiling-types';
import { findLeaf, getAllLeaves } from '@/lib/tiling-utils';
import { useTilingContext } from '@/context/tiling-context';
import ResizeHandle from './resize-handle';
import PanelTitleBar from './panel-title-bar';
import PanelContent from './panel-content';

export default function TilingManager() {
  const { layout } = useTilingContext();
  return <RenderNode node={layout} />;
}

function RenderNode({ node }: { node: TilingNode }) {
  if (node.type === 'leaf') return <TilingLeaf leaf={node} />;
  return <TilingSplit split={node} />;
}

function TilingSplit({ split }: { split: Extract<TilingNode, { type: 'split' }> }) {
  const isH = split.direction === 'horizontal';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isH ? 'row' : 'column',
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: `${split.ratio} 1 0%`,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <RenderNode node={split.first} />
      </div>
      <ResizeHandle direction={split.direction} splitId={split.id} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: `${1 - split.ratio} 1 0%`,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <RenderNode node={split.second} />
      </div>
    </div>
  );
}

function DropZoneOverlay({ zone }: { zone: 'left' | 'right' | 'top' | 'bottom' | 'center' }) {
  const base: React.CSSProperties = {
    position: 'absolute', pointerEvents: 'none',
    background: 'var(--accent-soft)', border: '1px solid var(--accent-dim)',
  };
  const zones: Record<string, React.CSSProperties> = {
    left: { ...base, top: 0, bottom: 0, left: 0, width: '20%' },
    right: { ...base, top: 0, bottom: 0, right: 0, width: '20%' },
    top: { ...base, top: 0, left: 0, right: 0, height: '20%' },
    bottom: { ...base, bottom: 0, left: 0, right: 0, height: '20%' },
    center: { ...base, top: '20%', bottom: '20%', left: '20%', right: '20%' },
  };
  return <div style={{ ...zones[zone], zIndex: 10 }} />;
}

function TilingLeaf({ leaf }: { leaf: LeafNode }) {
  const {
    activePanelId, setActivePanelId,
    dragState, setDragState,
    dropTargetId, setDropTargetId,
    dropZone, setDropZone,
    swapPanels, addPanel, removePanel, layout,
  } = useTilingContext();
  const isActive = activePanelId === leaf.panel.id;
  const isDragTarget = dragState !== null && dragState.panelId !== leaf.panel.id;

  return (
    <div
      data-panel={leaf.panel.id}
      data-tour="pane"
      className="pane-enter"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        outline: isActive ? '2px solid var(--accent)' : '1px solid var(--border-soft)',
        outlineOffset: isActive ? '-2px' : '-1px',
        background: 'var(--panel-bg)',
        position: 'relative',
        transition: 'outline-color var(--motion-fast) var(--ease-out)',
      }}
      onClick={() => setActivePanelId(leaf.panel.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('tiling-contextmenu', { detail: { x: e.clientX, y: e.clientY, panelId: leaf.panel.id } });
        window.dispatchEvent(evt);
      }}
      onPointerEnter={() => {
        if (!dragState) return;
        setDropTargetId(leaf.panel.id);
        setDropZone('center');
      }}
      onPointerMove={(e) => {
        if (!dragState) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        if (px < 0.2) setDropZone('left');
        else if (px > 0.8) setDropZone('right');
        else if (py < 0.2) setDropZone('top');
        else if (py > 0.8) setDropZone('bottom');
        else setDropZone('center');
      }}
      onPointerLeave={() => {
        if (dragState) setDropTargetId(null);
      }}
      onPointerUp={() => {
        if (!dragState || dragState.panelId === leaf.panel.id) return;
        const targetId = leaf.panel.id;
        const currentDropZone = dropZone;
        if (currentDropZone === 'center') {
          swapPanels(dragState.panelId, targetId);
        } else {
          const draggedLeaf = findLeaf(layout, dragState.panelId);
          if (draggedLeaf) {
            const dir = (currentDropZone === 'left' || currentDropZone === 'right') ? 'horizontal' as const : 'vertical' as const;
            const leaves = getAllLeaves(layout);
            if (leaves.length > 1) {
              removePanel(dragState.panelId);
              addPanel(targetId, draggedLeaf.panel.type, dir);
            }
          }
        }
        setDropTargetId(null);
        setDropZone(null);
        setDragState(null);
      }}
    >
      {isDragTarget && dropTargetId === leaf.panel.id && dropZone && (
        <DropZoneOverlay zone={dropZone} />
      )}
      <PanelTitleBar panel={leaf.panel} />
      <div data-panel-scroll={leaf.panel.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', minHeight: 0 }}>
        <PanelContent panelType={leaf.panel.type} panelId={leaf.panel.id} />
      </div>
    </div>
  );
}
