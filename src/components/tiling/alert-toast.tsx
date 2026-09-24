'use client';

import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import type { AlertRule } from '@/context/terminal-context';

function Toast({ alert, onDismiss }: { alert: AlertRule; onDismiss: () => void }) {
  const isAbove = alert.condition === 'above';
  const bg = isAbove ? '#0a2a0a' : '#2a0a0a';
  const dir = isAbove ? 'ABOVE' : 'BELOW';

  useEffect(() => {
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      style={{
        background: bg,
        border: '1px solid var(--border)',
        color: 'var(--amber)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        padding: '6px 10px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        lineHeight: 1.4,
      }}
      onClick={onDismiss}
    >
      <span style={{ fontWeight: 700, marginRight: 6 }}>{alert.symbol}</span>
      <span style={{ opacity: 0.7 }}>NOW</span>{' '}
      <span style={{ fontWeight: 700 }}>${alert.threshold.toFixed(2)}</span>{' '}
      <span style={{ opacity: 0.6 }}>{dir}</span>
    </div>
  );
}

export default function AlertToast() {
  const { triggeredAlerts } = useTerminalContext();
  const [visible, setVisible] = useState<AlertRule[]>([]);

  // Add newly triggered alerts to visible queue (max 5)
  useEffect(() => {
    setVisible((prev) => {
      const existing = new Set(prev.map((a) => a.id));
      const fresh = triggeredAlerts.filter((a) => !existing.has(a.id));
      const combined = [...prev, ...fresh].slice(-5);
      return combined;
    });
  }, [triggeredAlerts]);

  const dismiss = (id: string) => {
    setVisible((prev) => prev.filter((t) => t.id !== id));
  };

  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        pointerEvents: 'auto',
      }}
    >
      {visible.map((alert) => (
        <Toast key={alert.id} alert={alert} onDismiss={() => dismiss(alert.id)} />
      ))}
    </div>
  );
}
