'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AlertRule } from '@/context/terminal-context';
import type { FiredAlert } from '@/lib/alerts/alert-evaluator';

export type NotificationKind = 'ALERT' | 'BREAKING' | 'FILING' | 'SYSTEM';

export interface TerminalNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail?: string;
  symbol?: string;
  url?: string;
  at: string; // ISO
  read: boolean;
}

const KIND_META: Record<NotificationKind, { color: string; icon: string; label: string }> = {
  ALERT: { color: '#ffb000', icon: '⏰', label: 'ALERT' },
  BREAKING: { color: '#ef4444', icon: '⚡', label: 'BREAKING' },
  FILING: { color: '#4d9fff', icon: '📄', label: 'FILING' },
  SYSTEM: { color: '#888899', icon: '⚙', label: 'SYSTEM' },
};

const MAX_NOTIFICATIONS = 200;
const POLL_MS = 60_000;

interface NotificationCenterProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Legacy client-side rules to evaluate server-side. */
  alerts: AlertRule[];
  onNotificationClick?: (n: TerminalNotification) => void;
}

/**
 * Centralized notification center — aggregates triggered price alerts
 * (evaluated server-side via /api/v2/alerts/evaluate), breaking news,
 * new SEC filings for the active symbol, and system announcements into a
 * slide-out tray with unread counts.
 */
export default function NotificationCenter({ open, onOpen, onClose, alerts, onNotificationClick }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<TerminalNotification[]>([]);
  const seenKeys = useRef(new Set<string>());
  const lastFilingsKey = useRef<string | null>(null);
  const bootRef = useRef<string | null>(null);

  const push = useCallback((n: Omit<TerminalNotification, 'read' | 'id'> & { id?: string }) => {
    const id = n.id ?? `${n.kind}-${n.at}-${n.title.slice(0, 60)}`;
    if (seenKeys.current.has(id)) return;
    seenKeys.current.add(id);
    if (seenKeys.current.size > 1000) seenKeys.current = new Set([...seenKeys.current].slice(-500));
    setNotifications((prev) => [{ ...n, id, read: false }, ...prev].slice(0, MAX_NOTIFICATIONS));
  }, []);

  // System announcement once per session
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = 'done';
    push({ kind: 'SYSTEM', title: 'Notification center active', detail: 'Alerts, breaking news and filings aggregate here.', at: new Date().toISOString() });
  }, [push]);

  // Server-side alert evaluation loop
  useEffect(() => {
    const evaluate = async () => {
      const rules = alerts.filter((a) => !a.triggered);
      if (rules.length === 0) return;
      try {
        const res = await fetch('/api/v2/alerts/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules: rules.map((a) => ({
              id: a.id,
              name: `${a.symbol} ${a.condition} ${a.threshold}`,
              symbol: a.symbol,
              conditions: [{ kind: a.condition === 'above' ? 'PRICE_ABOVE' : 'PRICE_BELOW', value: a.threshold }],
              enabled: true,
              createdAt: new Date().toISOString(),
            })),
          }),
        });
        const json = await res.json();
        for (const f of (json.fired ?? []) as FiredAlert[]) {
          push({ kind: 'ALERT', title: f.ruleName, detail: f.reasons.join(' · '), symbol: f.symbol, at: f.firedAt });
        }
      } catch { /* offline */ }
    };
    evaluate();
    const id = setInterval(evaluate, POLL_MS);
    return () => clearInterval(id);
  }, [alerts, push]);

  // Breaking news watch
  useEffect(() => {
    let primed = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/v2/news?limit=30');
        const json = await res.json();
        if (!primed) { primed = true; return; }
        for (const item of (json.items ?? []) as Array<{ id: string; title: string; urgency?: string; url: string; publishedAt: string; source: string }>) {
          if (item.urgency === 'high') {
            push({ kind: 'BREAKING', title: item.title, detail: item.source, url: item.url, at: item.publishedAt });
          }
        }
      } catch { /* offline */ }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [push]);

  // New filings for the active symbol
  useEffect(() => {
    const watch = () => {
      const sym = (window as unknown as { __qubeActiveSymbol?: string }).__qubeActiveSymbol;
      if (!sym) return;
      fetch(`/api/sec/filings?ticker=${encodeURIComponent(sym)}`)
        .then((r) => r.json())
        .then((j) => {
          const filings = (j.filings ?? []) as Array<{ accessionNumber: string; form: string; filingDate: string; primaryDocument: string; cik: string }>;
          if (filings.length === 0) return;
          const latestKey = filings[0].accessionNumber;
          if (lastFilingsKey.current && latestKey !== lastFilingsKey.current) {
            const f = filings[0];
            const acc = f.accessionNumber.replace(/-/g, '');
            push({
              kind: 'FILING',
              title: `${sym} · new ${f.form} filing`,
              detail: `Filed ${f.filingDate}`,
              symbol: sym,
              url: `https://www.sec.gov/Archives/edgar/data/${f.cik}/${acc}/${f.primaryDocument}`,
              at: new Date().toISOString(),
            });
          }
          lastFilingsKey.current = latestKey;
        })
        .catch(() => {});
    };
    watch();
    const id = setInterval(watch, 5 * 60_000); // filings cadence is slow
    return () => clearInterval(id);
  }, [push]);

  const unread = notifications.filter((n) => !n.read).length;
  const grouped = useMemo(() => {
    const groups = new Map<NotificationKind, TerminalNotification[]>();
    for (const n of notifications) {
      (groups.get(n.kind) ?? groups.set(n.kind, []).get(n.kind)!).push(n);
    }
    return groups;
  }, [notifications]);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const clearAll = () => { setNotifications([]); };

  return (
    <>
      {/* Bell trigger */}
      <button
        onClick={() => (open ? onClose() : onOpen())}
        title="Notification center"
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', color: unread > 0 ? 'var(--amber-bright)' : 'var(--text-dim)', fontSize: 13, padding: '0 4px', display: 'inline-flex' }}
      >
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, background: 'var(--negative)', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: 7, minWidth: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Slide-out tray */}
      {open && (
        <div
          className="fade-enter"
          role="dialog"
          aria-label="Notification center"
          style={{
            position: 'fixed', top: 36, right: 0, bottom: 0, width: 340, zIndex: 'var(--z-dropdown)',
            background: 'var(--panel-bg)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow)',
            display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raised)' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 11, letterSpacing: 0.6 }}>NOTIFICATIONS</span>
            <span style={{ fontSize: 9, color: unread > 0 ? 'var(--amber-bright)' : 'var(--text-faint)' }}>{unread} unread</span>
            <button onClick={markAllRead} style={{ marginLeft: 'auto', fontSize: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', borderRadius: 2, padding: '1px 5px', cursor: 'pointer' }}>MARK READ</button>
            <button onClick={clearAll} style={{ fontSize: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', borderRadius: 2, padding: '1px 5px', cursor: 'pointer' }}>CLEAR</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {notifications.length === 0 && (
              <div style={{ padding: 20, color: 'var(--text-mute)', fontSize: 10, textAlign: 'center' }}>No notifications yet.<br />Alerts, breaking news and new filings land here.</div>
            )}
            {[...grouped.entries()].map(([kind, items]) => (
              <div key={kind}>
                <div style={{ padding: '4px 12px 2px', fontSize: 8, fontWeight: 700, color: KIND_META[kind].color, letterSpacing: 0.6, background: 'var(--surface-sunken)' }}>
                  {KIND_META[kind].icon} {KIND_META[kind].label} ({items.length})
                </div>
                {items.slice(0, 40).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))); onNotificationClick?.(n); }}
                    className="row-hover"
                    style={{ padding: '6px 12px', borderBottom: '1px solid var(--row-divider)', cursor: 'pointer', opacity: n.read ? 0.55 : 1, background: n.kind === 'BREAKING' && !n.read ? 'rgba(239,68,68,0.05)' : 'transparent' }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 8, color: KIND_META[n.kind].color, fontWeight: 700 }}>{KIND_META[n.kind].label}</span>
                      {n.symbol && <span style={{ fontSize: 8, color: 'var(--accent)', fontWeight: 700 }}>{n.symbol}</span>}
                      <span style={{ fontSize: 8, color: 'var(--text-faint)', marginLeft: 'auto' }}>{new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ color: n.read ? 'var(--text-dim)' : 'var(--text-bright)', fontSize: 10, lineHeight: 1.35, marginTop: 1 }}>{n.title}</div>
                    {n.detail && <div style={{ color: 'var(--text-faint)', fontSize: 8, marginTop: 1 }}>{n.detail}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ padding: '4px 12px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)' }}>
            ALERTS EVALUATED SERVER-SIDE · NEWS + FILINGS POLLED EVERY 60s
          </div>
        </div>
      )}
    </>
  );
}
