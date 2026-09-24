'use client';

import { cloneElement, isValidElement, useId, useRef, useState } from 'react';

interface TooltipProps {
	label: string;
	shortcut?: string;
	children: React.ReactElement;
	side?: 'top' | 'bottom';
	delay?: number;
}

/**
 * Lightweight, dependency-free tooltip. Wraps a single element and shows a
 * themed label (with optional shortcut) on hover/focus after a short delay.
 */
export default function Tooltip({ label, shortcut, children, side = 'bottom', delay = 350 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  };

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        'aria-describedby': visible ? id : undefined,
        onMouseEnter: (e: any) => { show(); (children.props as any).onMouseEnter?.(e); },
        onMouseLeave: (e: any) => { hide(); (children.props as any).onMouseLeave?.(e); },
        onFocus: (e: any) => { show(); (children.props as any).onFocus?.(e); },
        onBlur: (e: any) => { hide(); (children.props as any).onBlur?.(e); },
      } as any)
    : children;

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {visible && (
        <span
          role="tooltip"
          id={id}
          className="fade-enter"
          style={{
            position: 'absolute',
            [side]: 'calc(100% + 6px)' as any,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-raised)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '4px 8px',
            fontSize: 'var(--font-size-xs)',
            whiteSpace: 'nowrap',
            zIndex: 'var(--z-overlay)',
            boxShadow: 'var(--shadow)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {label}
          {shortcut && (
            <kbd style={{
              background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-sm)', padding: '0 4px', fontSize: 'var(--font-size-xxs)',
              color: 'var(--text-dim)',
            }}>{shortcut}</kbd>
          )}
        </span>
      )}
    </span>
  );
}
