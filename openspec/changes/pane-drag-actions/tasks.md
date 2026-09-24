## 1. Keyboard Focus Navigation (Ctrl+HJKL)

- [x] 1.1 Add `findNeighborByDirection(layout, activePanelId, direction)` utility to `tiling-utils.ts` — queries DOM for all `[data-panel]` elements, computes bounding rects, finds nearest panel center in the given direction ('left'|'right'|'up'|'down')
- [x] 1.2 In `terminal-shell.tsx` keyboard handler, replace ArrowUp/ArrowDown with Ctrl+H/J/K/L shortcuts: call `findNeighborByDirection`, set `activePanelId` to the neighbor's panel ID
- [x] 1.3 Keep Tab cycling as-is (forward-only cycle is still useful)

## 2. Keyboard Pane Moving (Ctrl+Shift+HJKL)

- [x] 2.1 In `terminal-shell.tsx` keyboard handler, add Ctrl+Shift+H/J/K/L handlers: find neighbor by direction, then call `swapPanels(activePanelId, neighborPanelId)` from tiling context

## 3. Keyboard Pane Resize (Ctrl+Shift+Arrows)

- [x] 3.1 Add `findParentSplit(layout, panelId)` utility to `tiling-utils.ts` — walks the tree to find the split node that is the direct parent of the active leaf, returns the split ID and which side ('first'|'second') the leaf is on
- [x] 3.2 In `terminal-shell.tsx`, add Ctrl+Shift+Left/Right/Up/Down handlers: find parent split, call `resizeSplit(splitId, delta)` with ±0.05 ratio delta based on direction and which side the active pane is on

## 4. Maximize/Restore

- [x] 4.1 Add `maximizedPanelId: string | null` to `TilingContextType` interface in `tiling-context.tsx`
- [x] 4.2 Add `maximizePanel(panelId)` and `restoreLayout()` to `TilingProvider` — maximize saves layout to a ref, sets root to single-leaf; restore swaps back
- [x] 4.3 Add `Ctrl+M` handler in `terminal-shell.tsx` — calls `maximizePanel(activePanelId)` or `restoreLayout()` based on current state
- [x] 4.4 Update Escape handler — if maximized, restore layout first before normal Escape behavior
- [x] 4.5 Add double-click handler on `panel-title-bar.tsx` — toggles maximize/restore
- [x] 4.6 Add maximize/restore button (▣/▪ icon) to title bar, next to close button

## 5. Move Panel on Edge Drop

- [x] 5.1 In `tiling-manager.tsx` `TilingLeaf.onPointerUp`, change edge-drop logic: get the dragged panel's type from the tree, call `removePanel(dragState.panelId)` first, then call `addPanel(targetId, draggedType, direction)` on the updated layout
- [x] 5.2 Guard: only move if source !== target and layout has >1 leaf after removal

## 6. Drop Zone Visual Feedback

- [x] 6.1 In `tiling-manager.tsx` `TilingLeaf`, render overlay when dragging and this panel is the `dropTargetId`
- [x] 6.2 Overlay: 4 edge rectangles (20% each) + center rectangle, active zone gets amber fill + border, all with `pointerEvents: 'none'`

## 7. Middle-Click to Close

- [x] 7.1 In `panel-title-bar.tsx`, add `onMouseDown` on title div — if `e.button === 1`, call `removePanel(panel.id)` and `e.preventDefault()`

## 8. Polish

- [ ] 8.1 Test all shortcuts in Firefox and Chromium-based browsers
- [ ] 8.2 Verify Ctrl+H and Ctrl+J don't trigger browser back/downloads (preventDefault works)
- [ ] 8.3 Test maximize preserves layout correctly with asymmetric splits
- [ ] 8.4 Test drag-move across various layouts
