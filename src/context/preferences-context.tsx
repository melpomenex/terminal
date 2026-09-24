'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeName = 'classic-amber' | 'cyberpunk' | 'blueprint' | 'midnight' | 'solarized';
export type Density = 'comfortable' | 'compact';

export interface EffectsConfig {
  glow: boolean;
  scanlines: boolean;
  vignette: boolean;
  animations: boolean;
  sound: boolean;
}

export interface Preferences {
  theme: ThemeName;
  accentOverride: string | null;
  density: Density;
  effects: EffectsConfig;
  onboardingCompleted: boolean;
  tourStep: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'classic-amber',
  accentOverride: null,
  density: 'comfortable',
  effects: { glow: false, scanlines: false, vignette: false, animations: true, sound: false },
  onboardingCompleted: false,
  tourStep: 0,
};

const STORAGE_KEY = 'blm_prefs_v1';

function loadPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      effects: { ...DEFAULT_PREFERENCES.effects, ...(parsed.effects ?? {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

interface PreferencesContextType {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  setTheme: (t: ThemeName) => void;
  setAccentOverride: (c: string | null) => void;
  setDensity: (d: Density) => void;
  setEffect: (key: keyof EffectsConfig, value: boolean) => void;
  completeOnboarding: () => void;
  setTourStep: (step: number) => void;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {}
  }, [preferences]);

  const setTheme = useCallback((t: ThemeName) => setPreferences((p) => ({ ...p, theme: t })), []);
  const setAccentOverride = useCallback((c: string | null) => setPreferences((p) => ({ ...p, accentOverride: c })), []);
  const setDensity = useCallback((d: Density) => setPreferences((p) => ({ ...p, density: d })), []);
  const setEffect = useCallback((key: keyof EffectsConfig, value: boolean) => setPreferences((p) => ({ ...p, effects: { ...p.effects, [key]: value } })), []);
  const completeOnboarding = useCallback(() => setPreferences((p) => ({ ...p, onboardingCompleted: true })), []);
  const setTourStep = useCallback((step: number) => setPreferences((p) => ({ ...p, tourStep: step })), []);

  const value = useMemo<PreferencesContextType>(
    () => ({ preferences, setPreferences, setTheme, setAccentOverride, setDensity, setEffect, completeOnboarding, setTourStep }),
    [preferences, setTheme, setAccentOverride, setDensity, setEffect, completeOnboarding, setTourStep],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

/** Mirror of the theme name used by the pre-hydration FOUC script. */
export const PREF_THEME_KEY = STORAGE_KEY;
