## ADDED Requirements

### Requirement: Settings panel
The system SHALL provide a Settings panel (openable from the command bar and command palette) exposing all personalization controls in one place: theme, accent color, density, effects, sound, and layout presets.

#### Scenario: Settings is reachable from command bar
- **WHEN** the user activates the Settings entry point in the command bar
- **THEN** the Settings panel SHALL open

### Requirement: Theme picker and accent override
The user SHALL be able to choose a theme from the available skins and, optionally, override the accent color, with the choice applied live across the app.

#### Scenario: Accent override applies live
- **WHEN** the user picks a custom accent color in Settings
- **THEN** all accent-derived UI SHALL update immediately to the chosen color

### Requirement: UI density control
The user SHALL be able to switch between at least two density modes (compact and comfortable) that adjust the global type scale and spacing, affecting tabular density across panels.

#### Scenario: Compact density tightens rows
- **WHEN** the user selects compact density
- **THEN** row heights, padding, and font sizing SHALL decrease app-wide relative to comfortable density

### Requirement: Effects and sound toggles
The user SHALL be able to independently toggle decorative effects (glow, scanlines, animations) and optional sound (price/alert blips), with sensible defaults (effects off, sound off).

#### Scenario: Disabling animations stops pane transitions
- **WHEN** the user disables the animations toggle
- **THEN** pane open/close and maximize transitions SHALL become instant

### Requirement: Layout presets gallery
The system SHALL present a gallery of named, restorable layout presets (curated workspaces) that the user can preview and apply, in addition to any saved custom layouts.

#### Scenario: Applying a preset restores a workspace
- **WHEN** the user selects a preset from the gallery
- **THEN** the tiling layout SHALL transform into that preset's arrangement of panels

### Requirement: Preference persistence
All personalization preferences (theme, accent, density, effect/sound toggles, onboarding flags) SHALL be persisted to `localStorage` under a versioned key and SHALL be restored on load, with safe fallback to defaults when storage is unavailable or corrupt.

#### Scenario: Corrupt storage falls back to defaults
- **WHEN** the persisted preferences cannot be parsed on load
- **THEN** the system SHALL fall back to default preferences without throwing and SHALL continue to render normally
