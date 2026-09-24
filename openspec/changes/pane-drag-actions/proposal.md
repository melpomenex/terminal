## Why

The terminal's tiling panels lack keyboard-driven pane management. A Bloomberg/power-user terminal requires Hyprland-style keyboard shortcuts: vim keys to move focus, shift panes, resize splits, maximize/restore, and close — all without touching the mouse. The existing shortcuts (Tab, ArrowUp/Down, Ctrl+W) are limited to linear cycling and closing.

## What Changes

- Add vim-style focus navigation: `Ctrl+H/J/K/L` moves focus between panes by spatial direction (not linear cycling)
- Add pane moving: `Ctrl+Shift+H/J/K/L` swaps the active pane with its neighbor in that direction
- Add pane resize: `Ctrl+Shift+Plus/Minus` or `Ctrl+Shift+Left/Right/Up/Down` resizes the active split
- Add maximize/restore: `Ctrl+M` or double-click title bar toggles maximize
- Add middle-click and title bar buttons for close/maximize
- Improve drag-to-drop: move panel instead of clone on edge drop, with visual drop zone feedback
- Replace existing Tab/Arrow cycling with spatial vim navigation

## Capabilities

### New Capabilities
- `pane-interaction`: Mouse and keyboard interactions on panes — drag-to-reorder, double-click maximize, title bar buttons, middle-click close, vim-style keyboard navigation and pane management

### Modified Capabilities

## Impact

- `src/components/terminal-shell.tsx` — keyboard shortcut handler (replace Tab/Arrow with vim keys)
- `src/components/tiling/tiling-manager.tsx` — drop zone overlay, pointer up move logic
- `src/components/tiling/panel-title-bar.tsx` — double-click, maximize button, middle-click
- `src/components/tiling/drag-overlay.tsx` — visual feedback
- `src/context/tiling-context.tsx` — maximize/restore state, spatial navigation helpers
- `src/lib/tiling-utils.ts` — find neighbor by direction, move panel utility
