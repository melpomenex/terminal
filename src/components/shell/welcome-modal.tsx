'use client';

import { usePreferences } from '@/context/preferences-context';

export default function WelcomeModal({ onTour, onPalette, onClose }: { onTour: () => void; onPalette: () => void; onClose: () => void }) {
  const { completeOnboarding } = usePreferences();

  const dismiss = () => { completeOnboarding(); onClose(); };

  return (
    <div className="fade-enter" style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)',
    }}>
      <div className="overlay-enter" style={{
        width: 'min(480px, 92vw)', background: 'var(--panel-bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: 24, textAlign: 'center',
      }}>
        <div className="glow" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--accent)', letterSpacing: 2, marginBottom: 4 }}>
          QUBE TERMINAL
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 18 }}>
          PROFESSIONAL MARKETS WORKSPACE
        </div>
        <p style={{ color: 'var(--text-bright)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5, marginBottom: 18 }}>
          A beautiful, fast, tiling markets terminal. Type a command, tile panels, track portfolios, and personalize your workspace.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onTour} className="row-hover" style={{
            background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius)',
            padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font)',
          }}>Take the tour</button>
          <button onClick={onPalette} className="row-hover" style={{
            background: 'var(--surface-sunken)', color: 'var(--text-bright)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius)',
            padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font)',
          }}>Browse shortcuts & commands</button>
          <button onClick={dismiss} className="row-hover" style={{
            background: 'transparent', color: 'var(--text-mute)', border: 'none', borderRadius: 'var(--radius)',
            padding: '6px 12px', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font)',
          }}>Skip — just start trading</button>
        </div>
      </div>
    </div>
  );
}
