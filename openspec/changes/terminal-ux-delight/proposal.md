## Why

The terminal already achieves strong Bloomberg *feature* parity (28 panels, tiling WM, command bar, AI brain), but the *experience* of using it is rough: scrollbars are hidden everywhere, panels pop in/out with no transition, hover/focus/selection states are inconsistent, the amber-on-black look is hardcoded with no way to personalize it, and a first-time user has no tour, tooltips, or shortcut reference to discover the wealth of functionality. We want the terminal to feel not just like a Bloomberg terminal, but **more beautiful and genuinely fun to use** — refined, responsive, personalizable, and approachable — without sacrificing the authentic pro-terminal identity or its raw performance.

## What Changes

- Introduce a **design-token foundation**: a single source of truth of CSS custom properties (colors, spacing, typography, radii, elevation, motion timing) driven by a React theme context, replacing the scattered hardcoded color literals (e.g. `#0d0d0f`, `#151518`, `#ffb000`) used across shell/panel components.
- Ship a **multi-theme system** with curated skins — *Classic Amber* (today's default, preserved), *Cyberpunk*, *Blueprint*, *Midnight*, *Solarized* — each a coherent token set, selectable live and persisted to `localStorage`.
- Deliver **visual refinement** built on tokens: deeper color depth/gradients, consistent typographic scale, polished panel chrome (title bars, dividers, focus rings), tasteful glow, visible-but-elegant scrollbars, and optional CRT scanline/vignette effects (off by default for clarity, on for "fun").
- Build a **motion system**: a small, dependency-free set of animation primitives and transition tokens (pane open/close/resize, maximize/restore, hover/focus/active, selection, dropdown, toast) plus refined price-flash animations and momentum-feel scrolling — all honoring `prefers-reduced-motion`.
- Add an **onboarding & discovery layer**: a first-run welcome modal, an interactive guided tour of the core surface (command bar → function keys → tiling → command palette), persistent tooltips/hints on key controls, rich empty states, and a searchable **keyboard-shortcut & command overlay** (`?` to open).
- Add a **personalization & settings** surface: a Settings panel exposing theme picker, accent-color override, UI density (compact/comfortable), effects toggles (glow, scanlines, animations), and sound (optional price/alert blips), plus a **layout-presets gallery** with named, restorable workspaces — all preferences persisted.

## Capabilities

### New Capabilities
- `design-tokens`: Centralized design-token layer (CSS custom properties + TypeScript token objects) sourced through a React theme context; the single foundation consumed by all visual/motion work.
- `theming-system`: Multiple named theme "skins" loaded as token sets, with live switching, persistence, and a default that preserves the current amber-on-black look.
- `visual-aesthetics`: Refined visual treatment built on tokens — typographic scale, color depth, panel chrome, focus rings, scrollbars, and opt-in decorative effects (glow/scanlines/vignette).
- `motion-system`: Dependency-free animation primitives and transition/opacity tokens powering cohesive micro-interactions across panes, controls, selection, flashes, and scroll, with reduced-motion support.
- `onboarding-discovery`: First-run welcome, guided tour, persistent tooltips/hints, rich empty states, and a searchable keyboard-shortcut & command reference overlay.
- `personalization`: User-facing Settings (theme, accent, density, effects, sound), a layout-presets gallery, and persisted preferences.

### Modified Capabilities
_(none — no specs exist in `openspec/specs/` yet; all six are new)_

## Impact

- **New files**: `src/lib/design-tokens.ts` (token definitions + TypeScript types); `src/lib/themes.ts` (named skin definitions); `src/context/theme-context.tsx` and `src/context/preferences-context.tsx`; `src/components/shell/settings-panel.tsx`, `theme-picker.tsx`, `shortcut-overlay.tsx`, `welcome-modal.tsx`, `guided-tour.tsx`, `tooltip.tsx`; `src/lib/motion.ts` (transition tokens) and small `src/components/shell/motion` primitives (e.g. `pane-transition.tsx`); `src/lib/preset-gallery.ts` (curated named workspaces).
- **Modified files**: `src/app/globals.css` (token-driven, preserve Classic Amber as default), `src/app/layout.tsx` (wrap app in Theme/Preferences providers, set initial theme pre-flash), `src/components/terminal-shell.tsx` (provider wiring, `?` shortcut → overlay, tour orchestration), `src/components/shell/command-bar.tsx`, `status-bar.tsx`, `function-keys.tsx` (token-driven styling + micro-interactions + tooltips), `src/components/tiling/panel-title-bar.tsx`, `resize-handle.tsx`, `context-menu.tsx`, `panel-content.tsx`, `tiling-manager.tsx` (pane lifecycle animations, focus rings), `src/components/panels/quote-monitor.tsx` (refined price flash), `src/lib/preset-layouts.ts` (expose as gallery), and `src/context/terminal-context.tsx` (preferences/tour flags).
- **Dependencies**: Zero new npm packages by default — all visuals via CSS custom properties, all motion via CSS transitions/animations and React state, matching the zero-new-deps convention used by prior changes. (Framer Motion is explicitly *not* introduced to keep bundle/perf footprint minimal.)
- **No breaking changes**: Default theme reproduces today's amber-on-black CRT look; all additions are additive and feature-flagged behind preferences. Existing layouts, panels, and keyboard shortcuts continue to work.
- **Performance**: CSS-driven animations are GPU-accelerated and cheap; token indirection adds no runtime cost. All animated effects are behind toggles and respect `prefers-reduced-motion`, so the heavy-data grid/scroll performance of existing panels is unaffected.
- **Accessibility**: Visible focus rings, sufficient contrast per theme, reduced-motion compliance, and tooltips/shortcut overlay improve keyboard and screen-reader friendliness over the current state.
