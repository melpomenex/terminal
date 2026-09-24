'use client';

interface EmptyStateProps {
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

/** Reusable rich empty state for data-less panels. */
export default function EmptyState({ title = 'NO DATA', message, action }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center' }}>
      <div className="glow" style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-dim)', letterSpacing: 1 }}>{title}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-mute)', maxWidth: 280 }}>{message}</div>
      {action && (
        <button onClick={action.onClick} className="row-hover" style={{
          marginTop: 4, background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)',
          borderRadius: 'var(--radius-sm)', padding: '4px 12px', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 700,
        }}>{action.label}</button>
      )}
    </div>
  );
}
