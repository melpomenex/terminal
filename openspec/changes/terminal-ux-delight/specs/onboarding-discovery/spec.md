## ADDED Requirements

### Requirement: First-run welcome modal
On first visit (no completed-onboarding flag), the system SHALL present a welcoming modal that introduces the terminal and offers entry points to start the guided tour, open the command palette, or dismiss.

#### Scenario: New user sees welcome
- **WHEN** a first-time user loads the app
- **THEN** the welcome modal SHALL appear and SHALL not reappear on subsequent loads once dismissed

#### Scenario: Welcome is dismissable without forcing the tour
- **WHEN** the user closes the welcome modal
- **THEN** the app SHALL proceed to the workspace without requiring the tour

### Requirement: Guided tour
The system SHALL provide an interactive guided tour that highlights the command bar, function keys, a sample pane, tiling navigation, and the command palette/shortcut overlay in sequence using a spotlight overlay anchored to existing UI elements.

#### Scenario: Tour advances through steps
- **WHEN** the user steps through the tour
- **THEN** each step SHALL spotlight the corresponding UI anchor and show explanatory text, with next/back/skip controls

#### Scenario: Tour targets are stable
- **WHEN** a tour step targets a UI element
- **THEN** the target SHALL be located via a stable anchor attribute that persists across renders

### Requirement: Searchable shortcut and command overlay
Pressing `?` (and a Help entry point) SHALL open a searchable overlay listing available keyboard shortcuts and commands, sourced from the existing command/shortcut registry so it never diverges from actual behavior.

#### Scenario: Overlay opens with question-mark key
- **WHEN** the user presses `?` outside of a text input
- **THEN** the shortcut/command overlay SHALL open

#### Scenario: Overlay is searchable
- **WHEN** the user types a query in the overlay
- **THEN** the list SHALL filter to shortcuts/commands matching the query by name or description

### Requirement: Tooltips on key controls
Core controls (command badges, function keys, pane controls) SHALL provide tooltips that describe their action and any shortcut, appearing on hover/focus with a short delay.

#### Scenario: Function key shows tooltip
- **WHEN** the user hovers a function key
- **THEN** a tooltip SHALL show the key's function name and associated shortcut after a short delay

### Requirement: Rich empty states
Panels and surfaces with no data SHALL render a helpful empty state with concise guidance and a relevant call to action, rather than a blank panel.

#### Scenario: Empty watchlist shows guidance
- **WHEN** a panel has no data to display
- **THEN** it SHALL show an empty-state message with guidance on how to populate it

### Requirement: Non-intrusive onboarding
Onboarding SHALL be skippable and SHALL never nag the user after completion; it SHALL remain re-openable from Help and Settings on demand.

#### Scenario: Completed onboarding does not nag
- **WHEN** a user who completed onboarding reloads the app
- **THEN** neither the welcome modal nor the tour SHALL appear automatically
