## Context

The tiling manager uses a binary split tree. Current keyboard shortcuts are limited to Tab (linear cycle), ArrowUp/Down (linear cycle), and Ctrl+W (close). No spatial navigation, no resize, no maximize. Mouse drag exists but clones on edge-drop instead of moving.

## Goals / Non-Goals

**Goals:**
- Vim-style spatial focus navigation (Ctrl+HJKL) — move focus to the pane in that physical direction
- Vim-style pane moving (Ctrl+Shift+HJKL) — swap active pane with neighbor in that direction
- Resize active split (Ctrl+Shift+Arrow keys) — grow/shrink the split the active pane belongs to
- Maximize/restore (Ctrl+M, double-click, or title bar button)
- Move panel on edge-drop (not clone)
- Drop zone visual feedback during drag
- Middle-click title bar to close

**Non-Goals:**
- Tabbed/stacked pane layouts
- Floating/detached panes
- Touch/mobile support
- Persisting maximize state across reloads
- Configurable keybindings

## Decisions

1. **Spatial navigation via bounding boxes** — For Ctrl+HJKL, compute the bounding rect of every leaf panel via `getBoundingClientRect()`. From the active panel, find the nearest panel center in the target direction. This works regardless of tree structure.

2. **Pane swap via tree manipulation** — For Ctrl+Shift+HJKL, use the same spatial neighbor lookup, then swap the two leaves' `PanelConfig` objects (reuse existing `swapPanelConfigs` utility).

3. **Resize via parent split** — Find the parent split of the active leaf. Arrow Left/Right adjusts horizontal splits, Arrow Up/Down adjusts vertical splits. Adjust ratio by ±0.05 per press, clamped to 0.10–0.90.

4. **Maximize as layout snapshot** — Save current layout tree to a ref. Replace root with single-leaf. On restore, swap back.

5. **Move on edge drop** — On pointerUp during drag, if edge zone: remove dragged panel from old position, then insert at new position. Only move if source and target are different panels and layout has >1 leaf after removal.

6. **Keybinding scheme** (Hyprland-inspired for a browser context):

| Shortcut | Action |
|----------|--------|
| `Ctrl+H` | Focus pane left |
| `Ctrl+L` | Focus pane right |
| `Ctrl+K` | Focus pane up |
| `Ctrl+J` | Focus pane down |
| `Ctrl+Shift+H` | Move active pane left |
| `Ctrl+Shift+L` | Move active pane right |
| `Ctrl+Shift+K` | Move active pane up |
| `Ctrl+Shift+J` | Move active pane down |
| `Ctrl+Shift+Left` | Grow split left/wider |
| `Ctrl+Shift+Right` | Shrink split left/narrower |
| `Ctrl+Shift+Up` | Grow split up/taller |
| `Ctrl+Shift+Down` | Shrink split up/shorter |
| `Ctrl+M` | Toggle maximize/restore |
| `Ctrl+W` | Close pane (already exists) |
| `Tab` | Cycle focus forward (keep existing) |
| `Escape` | Restore if maximized, else blur input |

## Risks / Trade-offs

- **Ctrl+H conflicts with browser back** in some browsers. Mitigation: `e.preventDefault()` should override it in most cases. If not, document the conflict.
- **Ctrl+J conflicts with browser downloads** in Chrome. Same mitigation via preventDefault.
- **Spatial navigation requires DOM measurement** (getBoundingClientRect). This is fast but means navigation logic must run in the component, not in pure tree utilities. Cache rects at the start of each keyboard event.
- **Move-on-edge-drop changes existing behavior**. The new behavior is more intuitive but differs from the current clone behavior.
