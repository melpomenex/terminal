'use client';

import { useEffect, useState } from 'react';
import { usePreferences, type ThemeName, type Density, type EffectsConfig } from '@/context/preferences-context';
import { useTilingContext } from '@/context/tiling-context';
import { THEME_META } from '@/lib/themes';
import { PRESET_GALLERY } from '@/lib/preset-gallery';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 'var(--font-size-xxs)', fontWeight: 700, letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-bright)', fontSize: 'var(--font-size-sm)' }}>
      <span>{label}</span>
      <span onClick={(e) => { e.preventDefault(); onChange(!checked); }} style={{
        width: 32, height: 16, borderRadius: 10, padding: 2, background: checked ? 'var(--accent)' : 'var(--surface-sunken)',
        border: '1px solid var(--border-soft)', display: 'inline-flex', alignItems: 'center', transition: 'background var(--motion-fast) var(--ease-out)',
      }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: checked ? 'var(--text-inverse)' : 'var(--text-mute)', transform: checked ? 'translateX(16px)' : 'translateX(0)', transition: 'transform var(--motion-fast) var(--ease-spring)' }} />
      </span>
    </label>
  );
}

export default function SettingsPanel({ onClose, onRestartTour }: { onClose: () => void; onRestartTour?: () => void }) {
  const { preferences, setTheme, setAccentOverride, setDensity, setEffect } = usePreferences();
  const { activePresetId, loadPreset } = useTilingContext();
  const [accentDraft, setAccentDraft] = useState(preferences.accentOverride ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const effectLabels: { key: keyof EffectsConfig; label: string; desc: string }[] = [
    { key: 'glow', label: 'Text glow', desc: 'Neon glow on headings' },
    { key: 'scanlines', label: 'CRT scanlines', desc: 'Retro CRT overlay' },
    { key: 'vignette', label: 'Vignette', desc: 'Darkened screen edges' },
    { key: 'animations', label: 'Animations', desc: 'Pane & hover motion' },
    { key: 'sound', label: 'Sound', desc: 'Price/alert blips' },
  ];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="overlay-enter" style={{
        width: 'min(680px, 92vw)', maxHeight: '86vh', overflowY: 'auto',
        background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)', color: 'var(--text)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', position: 'sticky', top: 0, background: 'var(--panel-bg)' }}>
          <span className="glow" style={{ fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>SETTINGS & THEMES</span>
          <button onClick={onClose} className="row-hover" style={{ color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', cursor: 'pointer' }}>Close ✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {onRestartTour && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={onRestartTour} className="row-hover" style={{
                background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)',
                borderRadius: 'var(--radius-sm)', padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-xs)',
              }}>Take the guided tour</button>
            </div>
          )}

          {/* Theme */}
          <Section title="Theme">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {THEME_META.map((t) => {
                const active = preferences.theme === t.id;
                return (
                  <button key={t.id} onClick={() => setTheme(t.id as ThemeName)} className="row-hover" style={{
                    textAlign: 'left', background: active ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-soft)'}`, borderRadius: 'var(--radius)',
                    padding: 8, cursor: 'pointer', color: 'var(--text)',
                  }}>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                      {t.swatch.map((c, i) => (<span key={i} style={{ flex: 1, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border-soft)' }} />))}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-bright)' }}>{t.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-mute)' }}>{t.description}</div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Accent override */}
          <Section title="Accent color (override)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={accentDraft || '#FFB000'} onChange={(e) => { setAccentDraft(e.target.value); setAccentOverride(e.target.value); }} style={{ width: 36, height: 28, background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: 2 }} />
              <input type="text" value={accentDraft} placeholder="auto (theme default)" onChange={(e) => setAccentDraft(e.target.value)} onBlur={() => setAccentOverride(accentDraft.trim() || null)} style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--text-bright)', fontSize: 'var(--font-size-sm)', padding: '4px 8px', fontFamily: 'var(--font)' }} />
              <button onClick={() => { setAccentDraft(''); setAccentOverride(null); }} className="row-hover" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--text-mute)', fontSize: 'var(--font-size-xs)', padding: '4px 8px', cursor: 'pointer' }}>Reset</button>
            </div>
          </Section>

          {/* Density */}
          <Section title="Density">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['comfortable', 'compact'] as Density[]).map((d) => {
                const active = preferences.density === d;
                return (
                  <button key={d} onClick={() => setDensity(d)} className="row-hover" style={{
                    flex: 1, background: active ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-soft)'}`, borderRadius: 'var(--radius)',
                    color: active ? 'var(--accent)' : 'var(--text)', padding: '6px 8px', cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)', textTransform: 'capitalize',
                  }}>{d}</button>
                );
              })}
            </div>
          </Section>

          {/* Effects */}
          <Section title="Effects & sound">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {effectLabels.map((e) => (
                <div key={e.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-bright)' }}>{e.label} <span style={{ color: 'var(--text-mute)', fontSize: 'var(--font-size-xxs)' }}>— {e.desc}</span></span>
                  <Toggle label="" checked={preferences.effects[e.key]} onChange={(v) => setEffect(e.key, v)} />
                </div>
              ))}
            </div>
          </Section>

          {/* Layout presets gallery */}
          <Section title="Layout presets">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {PRESET_GALLERY.map((p) => {
                const active = activePresetId === p.id;
                return (
                  <button key={p.id} onClick={() => loadPreset(p.id)} className="row-hover" style={{
                    textAlign: 'left', background: active ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-soft)'}`, borderRadius: 'var(--radius)',
                    padding: 8, cursor: 'pointer', color: 'var(--text)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-bright)', fontSize: 'var(--font-size-sm)' }}>{p.name}</span>
                      <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-mute)' }}>{p.panelCount} panes</span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-mute)', marginTop: 2 }}>{p.description}</div>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
