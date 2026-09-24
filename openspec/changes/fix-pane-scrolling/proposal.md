## Why

Panels with content taller than the visible area cannot scroll. The news feed, quote monitor, options chain, stock screener, and every other panel with overflow content is clipped with no way to scroll. This makes most panels unusable for real data exploration.

The root cause is a broken CSS flex chain: `[data-panel-scroll]` in `tiling-manager.tsx` (the intended scroll container) does NOT set `display: flex`, so panel root elements using `height: 100%` can't resolve their height correctly. Each panel's internal `flex: 1; overflow: auto` div ends up growing to fit all content instead of being constrained, so no scroll ever triggers.

## What Changes

- Add `display: flex; flex-direction: column` to the `[data-panel-scroll]` wrapper in `tiling-manager.tsx` so panel children participate in flex layout
- Remove `height: '100%'` from all panel root elements — they should use flex to fill the scroll container naturally
- Remove redundant inner `overflow: auto` scroll containers from panels (the outer `[data-panel-scroll]` already handles scrolling)
- Ensure panels that need internal fixed headers + scrollable body use the correct flex pattern (`flexShrink: 0` for headers, `flex: 1; minHeight: 0` for body)

## Capabilities

### New Capabilities
- `scrollable-panels`: Correct flex chain and overflow handling so all panels can scroll their content when it exceeds the visible area

### Modified Capabilities
<!-- No existing spec changes required -->

## Impact

- `src/components/tiling/tiling-manager.tsx` — fix the `[data-panel-scroll]` wrapper styles
- All panel components under `src/components/panels/` — remove `height: 100%` and redundant inner scroll containers
- `src/app/globals.css` — scrollbars are already hidden globally (intentional for the CRT aesthetic); scrolling works via mouse wheel / trackpad / keyboard j/k
