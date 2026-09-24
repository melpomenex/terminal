import type { DesignTokens } from './design-tokens';

export type { ThemeName } from '@/context/preferences-context';
import type { ThemeName } from '@/context/preferences-context';

export interface ThemeMeta {
  id: ThemeName;
  name: string;
  description: string;
  swatch: string[];
}

/**
 * Build a full re-theme delta from a small core palette. The accent is mirrored
 * into the legacy `--amber*` tokens so every component that references
 * `var(--amber)` automatically picks up the active theme.
 */
function theme(
  core: DesignTokens & {
    accent: string;
    accentDim: string;
    accentBright: string;
    accentSoft: string;
    accentRing: string;
  },
): DesignTokens {
  const {
    accent, accentDim, accentBright, accentSoft, accentRing,
    bg, panelBg, surfaceRaised, surfaceSunken, surfaceHover,
    text, textBright, textDim, textMute, border, borderLight, borderSoft, rowDivider, rowStripe,
    fnYellow,
  } = core as any;

  return {
    bg,
    'panel-bg': panelBg,
    amber: accent,
    'amber-dim': accentDim,
    'amber-bright': accentBright,
    accent,
    'accent-dim': accentDim,
    'accent-bright': accentBright,
    'accent-soft': accentSoft,
    'accent-ring': accentRing,
    text,
    'text-bright': textBright,
    'text-dim': textDim,
    'text-mute': textMute,
    'surface-raised': surfaceRaised,
    'surface-sunken': surfaceSunken,
    'surface-hover': surfaceHover,
    'row-stripe': rowStripe,
    'row-divider': rowDivider,
    border,
    'border-light': borderLight,
    'border-soft': borderSoft,
    // Tint the function-key palette into the theme.
    'fn-yellow': fnYellow,
  } as DesignTokens;
}

/** Classic amber-on-black — the original terminal look (identity preserved). */
const classicAmber: DesignTokens = {};

const cyberpunk = theme({
  bg: '#08020f',
  panelBg: '#0e0518',
  surfaceRaised: '#140726',
  surfaceSunken: '#1c0a33',
  surfaceHover: '#240c40',
  rowStripe: '#0b0414',
  rowDivider: '#1a0a2e',
  text: '#f3e6ff',
  textBright: '#ffffff',
  textDim: '#9a7ec4',
  textMute: '#7a5e9e',
  border: '#3a1a4d',
  borderLight: '#5a2a7d',
  borderSoft: '#241038',
  accent: '#ff2bd6',
  accentDim: '#7a156f',
  accentBright: '#ff7ae6',
  accentSoft: 'rgba(255, 43, 214, 0.14)',
  accentRing: 'rgba(255, 43, 214, 0.6)',
  fnYellow: '#3a1a4d',
});

const blueprint = theme({
  bg: '#0a1628',
  panelBg: '#0c1a2e',
  surfaceRaised: '#0e1f38',
  surfaceSunken: '#122a48',
  surfaceHover: '#163357',
  rowStripe: '#0a1424',
  rowDivider: '#13243f',
  text: '#cfe8ff',
  textBright: '#ffffff',
  textDim: '#6a8cb8',
  textMute: '#4a6a94',
  border: '#1e3a5f',
  borderLight: '#2a527d',
  borderSoft: '#15293f',
  accent: '#4fc3f7',
  accentDim: '#1f6f9e',
  accentBright: '#8ee0ff',
  accentSoft: 'rgba(79, 195, 247, 0.14)',
  accentRing: 'rgba(79, 195, 247, 0.6)',
  fnYellow: '#1e3a5f',
});

const midnight = theme({
  bg: '#06080f',
  panelBg: '#0a0e1a',
  surfaceRaised: '#0d1322',
  surfaceSunken: '#111a30',
  surfaceHover: '#162038',
  rowStripe: '#080b14',
  rowDivider: '#11182a',
  text: '#cdd6f4',
  textBright: '#ffffff',
  textDim: '#647099',
  textMute: '#46506e',
  border: '#1a2238',
  borderLight: '#2a3550',
  borderSoft: '#131a2c',
  accent: '#7aa2ff',
  accentDim: '#3a5299',
  accentBright: '#aec5ff',
  accentSoft: 'rgba(122, 162, 255, 0.14)',
  accentRing: 'rgba(122, 162, 255, 0.6)',
  fnYellow: '#1a2238',
});

const solarized = theme({
  bg: '#002b36',
  panelBg: '#073642',
  surfaceRaised: '#094050',
  surfaceSunken: '#0b4a5c',
  surfaceHover: '#0d556a',
  rowStripe: '#04303c',
  rowDivider: '#0a4051',
  text: '#93a1a1',
  textBright: '#eee8d5',
  textDim: '#586e75',
  textMute: '#3d5359',
  border: '#1d4a58',
  borderLight: '#2d6072',
  borderSoft: '#11485a',
  accent: '#2aa198',
  accentDim: '#157068',
  accentBright: '#5fd1c8',
  accentSoft: 'rgba(42, 161, 152, 0.16)',
  accentRing: 'rgba(42, 161, 152, 0.6)',
  fnYellow: '#1d4a58',
});

export const THEMES: Record<ThemeName, DesignTokens> = {
  'classic-amber': classicAmber,
  cyberpunk,
  blueprint,
  midnight,
  solarized,
};

export const THEME_META: ThemeMeta[] = [
  { id: 'classic-amber', name: 'Classic Amber', description: 'The original terminal look', swatch: ['#000000', '#FFB000', '#996600'] },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon magenta on deep violet', swatch: ['#08020f', '#ff2bd6', '#7a156f'] },
  { id: 'blueprint', name: 'Blueprint', description: 'Cyan on midnight blue', swatch: ['#0a1628', '#4fc3f7', '#1e3a5f'] },
  { id: 'midnight', name: 'Midnight', description: 'Soft periwinkle on ink', swatch: ['#06080f', '#7aa2ff', '#1a2238'] },
  { id: 'solarized', name: 'Solarized', description: 'Teal on solarized dark', swatch: ['#002b36', '#2aa198', '#586e75'] },
];

/** Resolve the delta tokens for a theme merged onto the base. */
export function getThemeTokens(name: ThemeName): DesignTokens {
  return THEMES[name] ?? classicAmber;
}
