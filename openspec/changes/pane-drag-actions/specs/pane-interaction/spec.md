## ADDED Requirements

### Requirement: Vim-style focus navigation (Ctrl+HJKL)
Move keyboard focus between panes by spatial direction using Ctrl+H (left), Ctrl+J (down), Ctrl+K (up), Ctrl+L (right).

#### Scenario: Focus pane to the left
- **WHEN** user presses Ctrl+H and there is a pane to the left of the active pane
- **THEN** focus moves to the nearest pane whose center is to the left of the active pane's center

#### Scenario: No pane in direction
- **WHEN** user presses Ctrl+H and there is no pane to the left
- **THEN** focus stays on the current active pane

#### Scenario: Input field is focused
- **WHEN** user presses Ctrl+H while an INPUT element is focused
- **THEN** the shortcut is ignored (let input handle it)

### Requirement: Vim-style pane moving (Ctrl+Shift+HJKL)
Swap the active pane with its neighbor in the given direction.

#### Scenario: Move pane left
- **WHEN** user presses Ctrl+Shift+H and there is a pane to the left of the active pane
- **THEN** the active pane and the left neighbor swap positions in the layout

#### Scenario: No neighbor in direction
- **WHEN** user presses Ctrl+Shift+H and there is no pane to the left
- **THEN** nothing happens

### Requirement: Keyboard pane resize (Ctrl+Shift+Arrows)
Resize the split that the active pane belongs to.

#### Scenario: Grow pane wider
- **WHEN** user presses Ctrl+Shift+Left and the active pane is in a horizontal split
- **THEN** the split ratio shifts 5% toward giving the active pane more space

#### Scenario: Shrink pane narrower
- **WHEN** user presses Ctrl+Shift+Right and the active pane is in a horizontal split
- **THEN** the split ratio shifts 5% toward giving the active pane less space

#### Scenario: Grow pane taller
- **WHEN** user presses Ctrl+Shift+Up and the active pane is in a vertical split
- **THEN** the split ratio shifts 5% toward giving the active pane more space

#### Scenario: No resizeable split
- **WHEN** the active pane is the only pane (no splits exist)
- **THEN** the resize shortcut does nothing

### Requirement: Maximize/restore via keyboard (Ctrl+M)
Toggle maximize state of the active pane via keyboard shortcut.

#### Scenario: Maximize active pane
- **WHEN** user presses Ctrl+M and no pane is maximized
- **THEN** the active pane fills the entire tiling area, all other panes are hidden

#### Scenario: Restore from maximize
- **WHEN** user presses Ctrl+M and a pane is maximized
- **THEN** the previous multi-pane layout is restored

#### Scenario: Escape restores from maximize
- **WHEN** user presses Escape and a pane is maximized
- **THEN** the layout is restored (before the normal Escape behavior)

### Requirement: Double-click maximize/restore
Double-clicking a pane's title bar toggles maximize state.

#### Scenario: Maximize on double-click
- **WHEN** user double-clicks a pane title bar
- **THEN** the pane expands to fill the tiling root

#### Scenario: Restore on second double-click
- **WHEN** user double-clicks the title bar of a maximized pane
- **THEN** the previous layout is restored

### Requirement: Title bar maximize button
A button on the title bar toggles maximize/restore.

#### Scenario: Click maximize button
- **WHEN** user clicks the maximize button on a title bar
- **THEN** the pane toggles maximize/restore state

### Requirement: Move panel on drag-to-edge drop
Dropping a dragged panel on an edge zone moves the panel (removes from old position, inserts at new) instead of cloning.

#### Scenario: Drag to left edge
- **WHEN** user drags a panel and drops on the left 20% of another panel
- **THEN** the dragged panel is removed from its original position and inserted to the left of the target

#### Scenario: Drag to center (swap)
- **WHEN** user drops on the center 60% of another panel
- **THEN** the two panels swap positions

### Requirement: Drop zone visual feedback
During drag, show highlighted zone on the target panel.

#### Scenario: Highlight active zone
- **WHEN** user is dragging and hovering over a panel
- **THEN** a colored overlay appears on the active zone (edge or center) indicating where the panel will land

### Requirement: Middle-click to close
Middle-clicking a title bar closes the pane.

#### Scenario: Close with middle-click
- **WHEN** user middle-clicks (button 1) on a pane title bar
- **THEN** the pane is removed from the layout
