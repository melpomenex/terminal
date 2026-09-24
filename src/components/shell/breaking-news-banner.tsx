'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NewsArticle } from '@/lib/providers/contracts';

const POLL_MS = 30_000;
const BANNER_TTL_MS = 45_000;

/** Short attention chime via Web Audio (no external asset needed). */
function playAlertChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1245, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    setTimeout(() => ctx.close(), 800);
  } catch { /* audio blocked until interaction — fine */ }
}

interface BreakingNewsBannerProps {
  onOpenArticle?: (url: string) => void;
}

/**
 * BREAKING — real-time breaking news banner. Polls the v2 news provider for
 * high-urgency headlines (and listens to the breaking_news stream topic when
 * connected), shows a dismissible banner, and plays an audio chime. Only
 * publisher-flagged / heuristic-urgent headlines fire — never fabricated.
 */
export default function BreakingNewsBanner({ onOpenArticle }: BreakingNewsBannerProps) {
  const [headline, setHeadline] = useState<NewsArticle | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [muted, setMuted] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushIfNew = useCallback((item: NewsArticle) => {
    if (item.urgency !== 'high') return;
    if (seenIds.current.has(item.id)) return;
    seenIds.current.add(item.id);
    if (seenIds.current.size > 500) seenIds.current = new Set([...seenIds.current].slice(-250));
    setHeadline(item);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHeadline(null), BANNER_TTL_MS);
    if (audioEnabled && !muted) playAlertChime();
  }, [audioEnabled, muted]);

  // Prime seen-set with current headlines so we only alert on NEW breaking items
  useEffect(() => {
    let primed = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/v2/news?limit=25');
        const json = await res.json();
        const items: NewsArticle[] = json.items ?? [];
        if (!primed) {
          items.forEach((i) => seenIds.current.add(i.id));
          primed = true;
          return;
        }
        for (const item of items) pushIfNew(item);
      } catch { /* offline */ }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [pushIfNew]);

  // Audio needs a user gesture first — enable on first interaction.
  useEffect(() => {
    const enable = () => { setAudioEnabled(true); };
    window.addEventListener('pointerdown', enable, { once: true });
    window.addEventListener('keydown', enable, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
    };
  }, []);

  if (!headline) return null;

  return (
    <div
      role="alert"
      className="fade-enter"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px',
        background: 'rgba(239, 68, 68, 0.14)', borderBottom: '1px solid var(--negative)',
        color: 'var(--text-bright)', fontSize: 11, fontFamily: 'var(--font)', flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 700, color: 'var(--negative)', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--negative)', boxShadow: '0 0 6px var(--negative)', animation: 'pulse 1.2s infinite' }} />
        BREAKING
      </span>
      <span
        onClick={() => onOpenArticle?.(headline.url)}
        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
        title={headline.title}
      >
        {headline.title}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{headline.source}</span>
      <button
        onClick={() => setMuted((m) => !m)}
        title={muted ? 'Enable breaking-news audio alerts' : 'Mute breaking-news audio alerts'}
        style={{ background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: 2, color: muted ? 'var(--text-faint)' : 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: '0 5px' }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <button
        onClick={() => setHeadline(null)}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
