/**
 * Design tokens — single source of truth for all visual + motion values.
 *
 * Tokens are flat, kebab-case keys. Each key maps 1:1 to a CSS custom property
 * (e.g. `amber` -> `--amber`). The base set intentionally includes every CSS
 * variable already referenced by existing components (`--amber`, `--bg`,
 * `--panel-bg`, `--border`, `--fn-go`, …) so theming can re-skin the whole app
 * by overriding these vars without touching every component.
 */

export type TokenValue = string | number;

/** A flat map of kebab-case token name -> value. */
export type DesignTokens = Record<string, TokenValue>;

/**
 * Base tokens. Values reproduce the terminal's original amber-on-black look so
 * the default appearance is unchanged.
 */
export const baseTokens: DesignTokens = {
  // ---- Raw palette -------------------------------------------------------
  'palette-bg': '#000000',
  'palette-panel': '#050400',
  'palette-amber': '#FFB000',
  'palette-amber-dim': '#996600',
  'palette-amber-bright': '#FFD700',
  'palette-red': '#FF4400',
  'palette-green': '#00b050',
  'palette-negative': '#ef4444',
  'palette-mute': '#888899',

  // ---- Legacy / primary tokens (re-themed per skin) ----------------------
  // Components already reference these via var(--amber) etc.
  'bg': '#000000',
  'panel-bg': '#050400',
  'amber': '#FFB000',
  'amber-dim': '#996600',
  'amber-bright': '#FFD700',
  'red': '#FF4400',
  'green': '#00b050',

  // ---- Surfaces / structure ---------------------------------------------
  'surface-raised': '#0d0d0f',
  'surface-sunken': '#151518',
  'surface-hover': '#1a1a1f',
  'row-stripe': '#0a0a0c',
  'row-divider': '#0f0f12',
  'border': '#332200',
  'border-light': '#4a3300',
  'border-soft': '#1f1f22',

  // ---- Semantic colors ---------------------------------------------------
  'text': '#FFB000',
  'text-bright': '#FFD700',
  'text-dim': '#996600',
  'text-mute': '#888899',
  'text-faint': '#555566',
  'text-inverse': '#0a0a0c',
  'accent': '#FFB000',
  'accent-dim': '#996600',
  'accent-bright': '#FFD700',
  'accent-soft': 'rgba(255, 176, 0, 0.12)',
  'accent-ring': 'rgba(255, 176, 0, 0.55)',
  'positive': '#00b050',
  'positive-soft': 'rgba(0, 176, 80, 0.12)',
  'negative': '#ef4444',
  'negative-soft': 'rgba(239, 68, 68, 0.12)',
  'info': '#0ea5e9',

  // ---- Function-key palette (legacy) ------------------------------------
  'fn-cancel': '#662222',
  'fn-go': '#1a4d2e',
  'fn-yellow': '#4d3d00',
  'fn-purple': '#2d1a4d',

  // ---- Typography --------------------------------------------------------
  'font': "'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace",
  'font-size': '13px',
  'font-size-xl': '15px',
  'font-size-lg': '13px',
  'font-size-base': '12px',
  'font-size-sm': '11px',
  'font-size-xs': '10px',
  'font-size-xxs': '9px',
  'line-height': '1.3',
  'row-height': '24px',
  'row-height-sm': '20px',

  // ---- Spacing -----------------------------------------------------------
  'space-1': '2px',
  'space-2': '4px',
  'space-3': '6px',
  'space-4': '8px',
  'space-5': '12px',
  'space-6': '16px',

  // ---- Radii -------------------------------------------------------------
  'radius-sm': '2px',
  'radius': '3px',
  'radius-lg': '5px',

  // ---- Elevation ---------------------------------------------------------
  'shadow-sm': '0 2px 4px rgba(0, 0, 0, 0.4)',
  'shadow': '0 4px 14px rgba(0, 0, 0, 0.55)',
  'glow': '0 0 2px rgba(255, 176, 0, 0.3)',

  // ---- z-index -----------------------------------------------------------
  'z-pane': '1',
  'z-dropdown': '9999',
  'z-overlay': '10000',
  'z-toast': '10001',
  'z-modal': '10002',

  // ---- Motion ------------------------------------------------------------
  'motion-instant': '0ms',
  'motion-fast': '120ms',
  'motion-base': '180ms',
  'motion-slow': '280ms',
  'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

/** Keys that are considered "semantic" (mapped from the raw palette). */
export const SEMANTIC_TOKENS = [
  'text', 'text-bright', 'text-dim', 'text-mute', 'text-faint', 'text-inverse',
  'accent', 'accent-dim', 'accent-bright', 'accent-soft', 'accent-ring',
  'positive', 'positive-soft', 'negative', 'negative-soft',
  'bg', 'panel-bg', 'surface-raised', 'surface-sunken', 'surface-hover',
  'row-stripe', 'row-divider', 'border', 'border-light', 'border-soft',
  'amber', 'amber-dim', 'amber-bright',
] as const;

/**
 * Flatten a token object into a map of `--<name>` CSS custom-property
 * declarations, suitable for spreading into an inline `style` object or
 * writing to a stylesheet.
 */
export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(tokens)) {
    out[`--${key}`] = String(tokens[key]);
  }
  return out;
}

/** Merge a base set with one or more partial delta sets (later wins). */
export function resolveTokens(...deltas: (DesignTokens | undefined)[]): DesignTokens {
  return deltas.reduce<DesignTokens>((acc, d) => (d ? { ...acc, ...d } : acc), { ...baseTokens });
}

/** A runtime guard flagging any literal hex that should be a token (dev only). */
export const KNOWN_LITERALS = new Set(['#000', '#000000', '#FFB000', '#0d0d0f', '#151518']);
