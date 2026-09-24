'use client';

import { useEffect, useState } from 'react';
import { usePreferences } from '@/context/preferences-context';

interface TourStep {
  selector: string;
  title: string;
  body: string;
  side: 'bottom' | 'top' | 'right' | 'left';
}

const STEPS: TourStep[] = [
  { selector: '[data-tour="command-bar"]', title: 'Command Bar', body: 'Type a ticker (AAPL) or a command (DES, GP, OVME). Use ⌘K to focus it anytime.', side: 'bottom' },
  { selector: '[data-tour="function-keys"]', title: 'Function Keys', body: 'Quick access to watchlists, asset classes, and layout views.', side: 'bottom' },
  { selector: '[data-tour="pane"]', title: 'Tiling Panes', body: 'Drag title bars to rearrange, double-click to maximize, right-click for more. Use ⌘H J K L to navigate.', side: 'right' },
  { selector: '[data-tour="settings"]', title: 'Settings & Themes', body: 'Personalize themes, accent color, density, effects, and layout presets here.', side: 'bottom' },
];

export default function GuidedTour({ onClose }: { onClose: () => void }) {
  const { preferences, setTourStep, completeOnboarding } = usePreferences();
  const [step, setStep] = useState<number>(preferences.tourStep ?? 0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const current = STEPS[step];

  useEffect(() => {
    if (!current) return;
    const el = document.querySelector(current.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const id = setTimeout(measure, 250); // re-measure after smooth scroll
    window.addEventListener('resize', measure);
    return () => { clearTimeout(id); window.removeEventListener('resize', measure); };
  }, [current]);

  useEffect(() => { setTourStep(step); }, [step, setTourStep]);

  if (!current) return null;

  const finish = () => { completeOnboarding(); onClose(); };
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());
  const back = () => setStep(Math.max(0, step - 1));

  const tooltipPos = (): React.CSSProperties => {
    if (!rect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    const pad = 12;
    switch (current.side) {
      case 'bottom': return { left: rect.left + rect.width / 2, top: rect.bottom + pad, transform: 'translateX(-50%)' };
      case 'top': return { left: rect.left + rect.width / 2, top: rect.top - pad, transform: 'translate(-50%, -100%)' };
      case 'right': return { left: rect.right + pad, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' };
      case 'left': return { left: rect.left - pad, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' };
    }
  };

  return (
    <div className="fade-enter" style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', pointerEvents: 'none' }}>
      {/* Dim overlay with spotlight cutout via box-shadow ring */}
      {rect && (
        <div style={{
          position: 'absolute', left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8,
          borderRadius: 'var(--radius)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', border: '2px solid var(--accent)',
          pointerEvents: 'none', transition: 'all var(--motion-base) var(--ease-out)',
        }} />
      )}
      <div className="overlay-enter" style={{
        position: 'absolute', ...tooltipPos(), pointerEvents: 'auto',
        width: 'min(320px, 80vw)', background: 'var(--panel-bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="glow" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 'var(--font-size-sm)' }}>{current.title}</span>
          <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-mute)' }}>{step + 1} / {STEPS.length}</span>
        </div>
        <p style={{ color: 'var(--text-bright)', fontSize: 'var(--font-size-sm)', lineHeight: 1.45, marginBottom: 12 }}>{current.body}</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          <button onClick={finish} className="row-hover" style={{ background: 'transparent', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>Skip tour</button>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 0 && (
              <button onClick={back} className="row-hover" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>Back</button>
            )}
            <button onClick={next} className="row-hover" style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
              {step < STEPS.length - 1 ? 'Next' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
