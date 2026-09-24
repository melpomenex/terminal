## Context

Qube Terminal uses a recursive binary-tree tiling layout. Each pane is a `TilingLeaf` rendered by `tiling-manager.tsx`. The leaf wraps content in two nested divs:

1. `[data-panel]` — the outer flex column container (title bar + scroll area)
2. `[data-panel-scroll]` — the intended scroll container (`flex: 1; overflow: auto; minHeight: 0`)

Panel components (news-feed, quote-monitor, options-chain, etc.) are rendered inside `[data-panel-scroll]`. Every panel sets `height: '100%'` on its root and creates its own internal `flex: 1; overflow: auto` div for scrolling.

**The problem:** `[data-panel-scroll]` does NOT set `display: flex`. It's a block element with `overflow: auto`. Panel children using `height: 100%` resolve against the scroll container's content height (which grows with content), so the inner `flex: 1` divs never get a constrained height and never trigger scroll.

## Goals / Non-Goals

**Goals:**
- All panels scroll correctly when content overflows the visible area
- Scroll works via mouse wheel, trackpad, and keyboard (j/k)
- Fix applies uniformly to all current and future panels
- No visual regressions (layout, sizing, active outlines)

**Non-Goals:**
- Making scrollbars visible (they're hidden intentionally for the CRT aesthetic)
- Changing the tiling tree data structure
- Adding virtualized scrolling or infinite scroll
- Changing keyboard scroll behavior (j/k already target `[data-panel-scroll]`)

## Decisions

### Decision 1: Add `display: flex` to `[data-panel-scroll]`

**Choice:** Change `[data-panel-scroll]` from a plain block element to a flex column container.

**Why:** This is the minimal fix that makes panel roots participate in flex layout. Without this, `height: 100%` on panel roots resolves incorrectly. With `display: flex; flex-direction: column`, the panel root can use `flex: 1; minHeight: 0` instead of `height: 100%`, and the height chain resolves correctly all the way down.

**Alternative considered:** Remove the outer `[data-panel-scroll]` scroll container and rely solely on each panel's internal scroll. Rejected because: (a) it requires every panel to implement scrolling correctly, (b) the j/k keyboard handler already targets `[data-panel-scroll]`, (c) future panels might forget to add scroll.

### Decision 2: Remove redundant inner scroll containers from panels

**Choice:** Panels should NOT create their own `overflow: auto` scroll containers. The outer `[data-panel-scroll]` handles scrolling for all panels uniformly.

**Why:** Dual scroll containers create fighting behavior. The outer container is the single source of truth for scroll state. Panels with fixed headers + scrollable body should use the pattern: header divs with `flexShrink: 0`, body div with `flex: 1; minHeight: 0` (no `overflow: auto`), letting the parent handle overflow.

**Alternative considered:** Keep inner scroll containers but fix the height chain. Rejected because it's more complex, requires every panel to get the chain right, and duplicates scroll logic.

### Decision 3: Replace `height: '100%'` with flex on panel roots

**Choice:** Panel root elements should use `flex: 1; minHeight: 0` (no explicit height) to fill their parent flex container.

**Why:** `height: 100%` on a flex child is unreliable — it resolves against the parent's content size, which may be undefined when the parent itself is a flex child with `overflow: auto`. `flex: 1` correctly means "take remaining space."

## Risks / Trade-offs

- **Risk: Some panels may have internal layout that breaks without their own scroll container** → Mitigation: Audit every panel and ensure headers use `flexShrink: 0` and bodies use `flex: 1; minHeight: 0` without `overflow`
- **Risk: Panels that render very large lists (stock screener) may have performance issues without virtualized scroll** → Mitigation: Acceptable for now; the data sizes are small enough (50-200 rows) that native scroll is fine
- **Risk: Mouse wheel scroll may feel different with a single scroll container vs nested** → Mitigation: Actually improves UX — one scroll target per pane, no ambiguity about which container scrolls
