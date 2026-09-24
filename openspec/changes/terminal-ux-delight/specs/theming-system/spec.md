## ADDED Requirements

### Requirement: Multiple named themes
The system SHALL provide at least five named theme skins — Classic Amber (default), Cyberpunk, Blueprint, Midnight, and Solarized — where each skin is a coherent set of token overrides applied across all semantic tokens.

#### Scenario: Selecting a theme restyles the whole app
- **WHEN** the user selects the "Cyberpunk" theme
- **THEN** every panel, shell bar, border, accent, and text color SHALL update to the Cyberpunk token set without a page reload

### Requirement: Default theme preserves the current design
The default theme SHALL be Classic Amber and SHALL reproduce the terminal's existing amber-on-black appearance.

#### Scenario: First load shows Classic Amber
- **WHEN** a user with no saved preference loads the app
- **THEN** the Classic Amber theme SHALL be active

### Requirement: Live theme switching
The system SHALL switch themes instantly at runtime by applying the resolved token set as CSS custom properties, with no network request and no full re-render of market data.

#### Scenario: Live switch preserves in-flight data
- **WHEN** the user switches themes while price data is streaming
- **THEN** the active data, open panels, and layout SHALL be unchanged and only colors/styling SHALL update

### Requirement: Theme persistence
The selected theme SHALL be persisted to `localStorage` and restored on subsequent loads.

#### Scenario: Theme survives reload
- **WHEN** a user selects Midnight and reloads the page
- **THEN** the app SHALL load with the Midnight theme active

### Requirement: No flash of unstyled content on load
The system SHALL apply the persisted theme before React hydration so that the initially painted frame already uses the correct theme.

#### Scenario: Reload does not flash the wrong theme
- **WHEN** a user with a saved non-default theme reloads the page
- **THEN** the first painted frame SHALL already reflect the saved theme with no visible flash to the default theme
