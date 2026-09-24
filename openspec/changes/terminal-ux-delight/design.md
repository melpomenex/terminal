## Context

The terminal is a Next.js 15 / React 19 app rendered as a single full-viewport Bloomberg-style workspace: a `CommandBar` + `FunctionKeys` + tiling root + `StatusBar`. Visual styling today is **inline-style literal-heavy** (e.g. `background: '#0d0d0f'`, `#151518`, `#ffb000` scattered across `command-bar.tsx`, `status-bar.tsx`, `function-keys.tsx`, panel chrome) with a small set of CSS custom properties defined in `globals.css` (`--bg`, `--amber`, `--font`, etc.). State lives in two React contexts (`terminal-context.tsx`, `tiling-context.tsx`). There are **no existing specs** in `openspec/specs/`, and the two prior changes (`bloomberg-parity-features`, `bloomberg-terminal-parity`) both shipped with **zero new npm dependencies**. Constraints to respect: no layout/data regressions, no new runtime deps, preserve the authentic amber-on-black default, and keep heavy grid/scroll performance intact.

## Goals / Non-Goals

**Goals:**
- Establish a **token-first design system** as the single source of truth for color, type, spacing, elevation, radii, and motion — consumed everywhere instead of literals.
- Enable **live, persisted theming** (multiple skins) with no flash-of-unstyled-content (FOUC) and a default that is pixel-close to today's look.
- Deliver **cohesive, dependency-free motion** and **visual refinement** that make the product feel beautiful and responsive.
- Make the terminal **approachable and fun to learn** (onboarding, tour, shortcut overlay, tooltips, empty states).
- Give users **personalization** (theme, accent, density, effects, sound, presets) that persists.

**Non-Goals:**
- Adding new financial panels or data features (covered by prior changes).
- Introducing a CSS framework (Tailwind, CSS-in-JS) or an animation library (Framer Motion). Staying dependency-free and inline-style/CSS-variable native.
- Redesigning the tiling window-manager algorithm or data-fetching layer.
- Multi-user accounts / server-side preference sync (preferences are local-only via `localStorage`).
- Replacing the existing keyboard-shortcut scheme.

## Decisions

### 1. Tokens as CSS custom properties, authored in TS, applied at runtime
Define tokens once in `src/lib/design-tokens.ts` as typed TS objects, and emit them as CSS custom properties on a root container. Components read tokens via `var(--token)` in inline styles (matching the existing inline-style convention) rather than via a JS function call at render.
- **Why over styled-components / Tailwind:** the codebase already uses inline styles + a few CSS vars; CSS vars are zero-runtime, theme-switchable by reparenting vars (no re-render), and require no build pipeline. TS source gives type safety and feeds the theme system.
- **Alternatives considered:** Tailwind (rejected: large migration, conflicts with inline-style convention), CSS-in-JS (rejected: runtime cost, new dep).

### 2. Themes = named token sets applied by writing CSS vars to `:root` / app wrapper
Each theme in `src/lib/themes.ts` is a `Partial<DesignTokens>` (only deltas from the base). A `ThemeContext` applies the resolved set by setting inline CSS vars on the outermost app `<div>` (and mirroring onto `document.documentElement` for portals like the dropdown/toast). 
- **Why:** reparenting vars on a single element lets live switching happen without touching any component; deltas keep skins compact and maintainable.
- **Default theme** `classic-amber` is authored to reproduce the current `globals.css` values exactly so the shipped default is visually unchanged.

### 3. FOUC prevention via a tiny inline pre-hydration script
A minimal synchronous `<script>` in `layout.tsx` reads the persisted theme name from `localStorage` and sets the base CSS vars on `documentElement` **before** React hydrates. This avoids a flash to the wrong theme on reload.
- **Why over server-rendered theme:** preferences are local-only (no server/account), so there is no server-side signal; the inline script is the standard SSR-stable pattern and is ~15 lines.

### 4. Motion via CSS transitions/animations + a small FLIP helper — no animation library
Pane open/close uses opacity + `transform: scale()` transitions; maximize/restore and resize use a FLIP (First-Last-Invert-Play) technique on the tiling layout container for smooth reflow. Interactive states (hover/focus/active/selection) use CSS transitions on color/background/transform. Price-flash refines the existing keyframes.
- **Why over Framer Motion:** zero bundle cost, no new dep (matches convention), GPU-accelerated transforms are cheap, and the motion surface is bounded enough that a library would be overkill.
- **Reduced motion:** a single `prefers-reduced-motion` check (surfaced as a token) disables non-essential animation; transitions degrade to instant color changes.

### 5. Preferences as a dedicated context, persisted to `localStorage`
`PreferencesContext` holds `{ theme, accent, density, effects: {glow,scanlines,animations,sound}, tourCompleted, ... }`, persisted under a versioned key (e.g. `blm_prefs_v1`) with try/catch guards mirroring the existing `blm_tiling_layout` persistence pattern. Token values (density scale, effect booleans) flow into the token layer so preferences are felt app-wide without prop drilling.
- **Why:** separates concerns from `terminal-context` (market/trading state) vs. cosmetic/UI state; survives reloads; easy to extend.

### 6. Onboarding as a lightweight, resumable state machine
The welcome modal + guided tour are driven by a small tour state (`step`, `dismissed`) in `PreferencesContext`. Tour targets existing anchors (command bar, function keys, a pane, command palette) via stable `data-tour="..."` attributes and renders a spotlight overlay. It is dismissible, skippable, and re-openable from Help/Settings — never nags after completion.

### 7. Shortcut & command overlay reuses the existing command registry
The `?` overlay is a read-only, searchable view built from the existing command/shortcut definitions (already enumerated in `terminal-shell.tsx` and the command parser). No second source of truth; adding a command later updates the overlay automatically.

## Risks / Trade-offs

- **[Inline-style + CSS-var friction]** Some existing inline styles use literal hex values; migrating them is broad but mechanical. → Mitigation: phase migration capability-by-capability; default `classic-amber` tokens map 1:1 to today's literals so partial migration still renders correctly.
- **[FOUC edge cases]** Users with JS disabled won't get pre-hydration theming. → Mitigation: graceful default — `globals.css` ships `classic-amber` as the static fallback, so no-JS just shows the default theme.
- **[FLIP/resize complexity]** Tiling resize animation can feel janky if poorly timed. → Mitigation: animate only maximize/restore and open/close by default; keep resize live (no animation) for responsiveness; gate behind an `animations` preference.
- **[Theme contrast/a11y]** Curated skins could ship with poor contrast. → Mitigation: each theme defines its own semantic tokens (`--text`, `--text-dim`, `--accent`) and is reviewed against WCAG AA; visible focus ring token enforced globally.
- **[Scope creep]** "Beautiful + fun" is open-ended. → Mitigation: Non-Goals above bound the work; effects are opt-in; no new panels.
- **[localStorage quota/parse errors]** → Mitigation: versioned key + try/catch + fallback to defaults (existing pattern).
