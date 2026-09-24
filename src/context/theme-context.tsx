'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { baseTokens, resolveTokens, tokensToCssVars, type DesignTokens } from '@/lib/design-tokens';
import { getThemeTokens } from '@/lib/themes';
import type { ThemeName } from '@/lib/themes';
import { usePreferences } from '@/context/preferences-context';

interface ThemeContextType {
  themeName: ThemeName;
  tokens: DesignTokens;
  cssVars: Record<string, string>;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function densityDelta(density: 'comfortable' | 'compact'): DesignTokens {
  if (density === 'compact') {
    return { 'font-size': '12px', 'row-height': '20px', 'line-height': '1.2', 'space-3': '5px', 'space-4': '6px' };
  }
  return { 'font-size': '13px', 'row-height': '24px', 'line-height': '1.3' };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { preferences, setTheme } = usePreferences();
  const { theme, accentOverride, density, effects } = preferences;

  const tokens = useMemo(() => {
    const resolved = resolveTokens(baseTokens, getThemeTokens(theme), densityDelta(density));
    if (accentOverride) {
      resolved['accent'] = accentOverride;
      resolved['accent-bright'] = accentOverride;
      resolved['amber'] = accentOverride;
      resolved['amber-bright'] = accentOverride;
    }
    return resolved;
  }, [theme, accentOverride, density]);

  const cssVars = useMemo(() => tokensToCssVars(tokens), [tokens]);

  // Apply CSS vars + effect attributes to documentElement so portals (dropdowns,
  // toasts, modals) and the FOUC pre-paint all share the same root variables.
  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(cssVars)) root.style.setProperty(k, v);
    root.dataset.theme = theme;
    root.dataset.density = density;
    root.dataset.glow = effects.glow ? 'on' : 'off';
    root.dataset.scanlines = effects.scanlines ? 'on' : 'off';
    root.dataset.vignette = effects.vignette ? 'on' : 'off';
    root.dataset.animations = effects.animations ? 'on' : 'off';
  }, [cssVars, theme, density, effects]);

  const value = useMemo<ThemeContextType>(() => ({ themeName: theme, tokens, cssVars, setTheme }), [theme, tokens, cssVars, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <div style={{ display: 'contents', ...cssVars }}>{children}</div>
    </ThemeContext.Provider>
  );
}
