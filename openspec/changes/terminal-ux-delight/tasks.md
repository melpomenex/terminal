## 1. Design-token foundation

- [x] 1.1 Create `src/lib/design-tokens.ts` defining typed token groups (color palette, semantic colors, typography scale, spacing, radii, elevation/shadows, z-index, motion durations/easings) with a `DesignTokens` TypeScript type
- [x] 1.2 Add a `tokensToCssVars()` helper that flattens a token object into `--<name>` CSS custom-property declarations
- [x] 1.3 Verify the base/default token values exactly reproduce the current `globals.css` values (`--bg`, `--panel-bg`, `--amber` family, `--font`, font-size) so the default look is unchanged
- [x] 1.4 Add stable semantic tokens (`--text`, `--text-dim`, `--accent`, `--accent-dim`, `--positive`, `--negative`, `--border`, `--border-light`, `--surface-raised`) mapped from raw palette tokens

## 2. Theme context & theming system

- [x] 2.1 Create `src/context/theme-context.tsx` exposing the active token set and a `setTheme(name)` action, applying resolved tokens as CSS vars on the app wrapper and mirroring to `document.documentElement` for portals
- [x] 2.2 Create `src/lib/themes.ts` with named skins (`classic-amber`, `cyberpunk`, `blueprint`, `midnight`, `solarized`) authored as `Partial<DesignTokens>` deltas, with `classic-amber` reproducing the current look
- [x] 2.3 Add a pre-hydration inline script in `src/app/layout.tsx` that reads the persisted theme from `localStorage` and sets base CSS vars on `documentElement` before React mounts (FOUC prevention)
- [x] 2.4 Wire `ThemeProvider` into the app provider tree in `src/app/layout.tsx` (inside/around existing providers) and verify live theme switching restyles the whole app without reloading
- [x] 2.5 Verify persisted theme is restored on reload with no flash to the default theme

## 3. Visual aesthetics migration

- [x] 3.1 Refactor `src/app/globals.css` to be token-driven (move values into tokens, keep `:root` fallbacks = classic amber) and replace global scrollbar hiding with themed, visible-by-default thin scrollbars using tokens
- [x] 3.2 Migrate `src/components/shell/command-bar.tsx` inline literals to semantic tokens (backgrounds, borders, text, badges, dropdown)
- [x] 3.3 Migrate `src/components/shell/status-bar.tsx` and `function-keys.tsx` to tokens
- [x] 3.4 Migrate tiling chrome (`panel-title-bar.tsx`, `resize-handle.tsx`, `context-menu.tsx`, `panel-content.tsx`, `tiling-manager.tsx`) to tokens and add a visible active-pane focus ring derived from `--accent`
- [x] 3.5 Add consistent keyboard focus indicators (focus-ring token) to all interactive controls (badges, function keys, inputs, handles)
- [x] 3.6 Implement opt-in decorative effects layers (glow text-shadow token, CRT scanline overlay, vignette) toggled by preference and off by default; confirm enabling them causes zero layout shift
- [x] 3.7 Spot-check representative panels (e.g. `quote-monitor.tsx`, `chart-panel.tsx`, `news-feed.tsx`) for positive/negative coloring via `--positive`/`--negative` semantic tokens

## 4. Motion system

- [x] 4.1 Create `src/lib/motion.ts` exporting transition/opacity tokens and helpers (no external deps)
- [x] 4.2 Add pane open/close/maximize/restore animations in `tiling-manager.tsx`/`panel-content.tsx` using GPU-accelerated `transform`/`opacity` transitions; confirm no jank in adjacent panes
- [x] 4.3 Implement smooth hover/focus/active/selection transitions (motion tokens) across command badges, function keys, context-menu items, and list rows
- [x] 4.4 Refine the price-flash animation in `quote-monitor.tsx` to the token-driven positive/negative keyframes with clean resolve
- [x] 4.5 Add a `prefers-reduced-motion` (and animations-preference) guard that disables non-essential motion while preserving focus-ring and essential feedback

## 5. Preferences context & personalization

- [x] 5.1 Create `src/context/preferences-context.tsx` with a versioned, try/catch-guarded `localStorage` persistence (key `blm_prefs_v1`) and safe default fallback; wire into provider tree
- [x] 5.2 Feed preference-driven tokens (density scale, effect/sound/animation booleans, accent override) back into the token/theme layer so preferences are felt app-wide
- [x] 5.3 Implement UI density modes (compact/comfortable) adjusting type scale + spacing app-wide
- [x] 5.4 Create `src/components/shell/settings-panel.tsx` exposing theme picker, accent override, density, effects/sound toggles, with live application
- [x] 5.5 Create `src/lib/preset-gallery.ts` and a presets-gallery UI surface that previews/applies named layouts via the existing `loadPreset` mechanism
- [x] 5.6 Register a Settings command/entry point in the command bar and command palette, and wire open via `lastAction`

## 6. Onboarding & discovery

- [x] 6.1 Add stable tour-anchor attributes (`data-tour="..."`) to key surfaces (command bar, function keys, a pane, command palette entry)
- [x] 6.2 Create `src/components/shell/welcome-modal.tsx` shown on first run (no completed flag), dismissable, with entry points to tour / palette
- [x] 6.3 Create `src/components/shell/guided-tour.tsx` as a resumable spotlight-overlay state machine with next/back/skip, reading anchors; mark onboarding complete in preferences
- [x] 6.4 Create `src/components/shell/shortcut-overlay.tsx` opened via `?` (and Help), sourcing shortcuts/commands from the existing registry, with search/filter
- [x] 6.5 Add a reusable `src/components/shell/tooltip.tsx` and apply tooltips (action + shortcut) to command badges, function keys, and pane controls
- [x] 6.6 Implement rich empty states for data-less panels with concise guidance + call to action
- [x] 6.7 Ensure onboarding never nags after completion and remains re-openable from Help/Settings

## 7. Integration, polish & verification

- [x] 7.1 Wire `?` shortcut (and existing Help flow) into `terminal-shell.tsx` keyboard handler; ensure it is suppressed inside text inputs
- [x] 7.2 Confirm default load (no prefs) is visually equivalent to pre-change amber-on-black, with scrollbars visible and no scanlines
- [x] 7.3 Verify cross-theme contrast/legibility for each skin and that focus rings render in all themes
- [x] 7.4 Verify `prefers-reduced-motion` disables non-essential motion and that disabling animations via Settings does the same
- [x] 7.5 Regression check: layouts persist/restore, panels open/close, tiling nav shortcuts, price streaming, and command bar all still work
- [x] 7.6 Run `pnpm build` and fix any type/build errors; confirm no new runtime dependencies were added to `package.json`
