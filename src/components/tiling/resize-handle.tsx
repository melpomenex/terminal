'use client';

import { useRef } from 'react';
import type { SplitDirection } from '@/lib/tiling-types';
import { useTilingContext } from '@/context/tiling-context';

const HANDLE_SIZE = 4;

export default function ResizeHandle({ direction, splitId }: { direction: SplitDirection; splitId: string }) {
  const { resizeSplit } = useTilingContext();
  const handleRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = handleRef.current!;
    el.setPointerCapture(e.pointerId);
    const parentRect = el.parentElement!.getBoundingClientRect();
    const totalSize = direction === 'horizontal' ? parentRect.width : parentRect.height;
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;

    const onMove = (ev: PointerEvent) => {
      const currentPos = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = currentPos - startPos;
      const deltaRatio = delta / totalSize;
      resizeSplit(splitId, deltaRatio);
    };

    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  const isH = direction === 'horizontal';

  return (
    <div
      ref={handleRef}
      onPointerDown={handlePointerDown}
      style={{
        flexShrink: 0,
        background: 'var(--border)',
        width: isH ? HANDLE_SIZE : undefined,
        height: isH ? undefined : HANDLE_SIZE,
        cursor: isH ? 'col-resize' : 'row-resize',
        position: 'relative',
        touchAction: 'none',
        transition: 'background var(--motion-fast) var(--ease-out)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-dim)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--border)'; }}
    />
  );
}
