## ADDED Requirements

### Requirement: Consistent typographic scale
The system SHALL define a typed typographic scale (font families, weights, and a discrete set of sizes/line-heights) and SHALL apply it consistently across shell bars, panel titles, tabular data, and body text.

#### Scenario: Uniform font sizing across surfaces
- **WHEN** a panel title and a shell-bar label are both rendered as "caption" text
- **THEN** both SHALL use the same caption token from the typographic scale

### Requirement: Color depth and contrast
Each theme SHALL define layered surface tokens (background, panel background, raised/elevated surface, border, border-light) to convey depth, and SHALL meet WCAG AA contrast between text and its background for all semantic text tokens.

#### Scenario: Elevated surfaces are distinguishable
- **WHEN** a dropdown or modal overlays the workspace
- **THEN** it SHALL render on an elevated surface token that is visually distinct from the panel background

### Requirement: Refined panel chrome
Panel title bars, dividers, and selection/focus affordances SHALL be styled consistently from tokens, including an always-visible focus ring on the active/focused pane.

#### Scenario: Focused pane is clearly indicated
- **WHEN** a pane becomes the active pane
- **THEN** it SHALL display a visible focus ring derived from the `--accent` token

### Requirement: Elegant visible scrollbars
Scrollable content areas SHALL render thin, themed scrollbars that are visible by default (replacing the current global scrollbar hiding) while remaining unobtrusive, colored from the theme tokens.

#### Scenario: Long list is scrollable with visible affordance
- **WHEN** a panel's content overflows its viewport
- **THEN** a themed scrollbar SHALL be visible and operable

### Requirement: Opt-in decorative effects
Decorative effects (text glow, CRT scanlines, vignette) SHALL be available but SHALL be disabled by default, controlled by user preferences, and applied purely as overlay layers or text-shadow tokens that do not alter layout.

#### Scenario: Default load has no scanlines
- **WHEN** the app loads with default preferences
- **THEN** scanlines and vignette overlays SHALL be off

#### Scenario: Enabling effects does not shift layout
- **WHEN** the user enables the glow effect
- **THEN** only text-shadow/overlay appearance SHALL change and no element's layout SHALL shift

### Requirement: Visible accessible focus for controls
All interactive controls (buttons, inputs, pane handles) SHALL show a visible focus indicator when navigated to via keyboard, derived from a focus-ring token.

#### Scenario: Keyboard focus is visible on command input
- **WHEN** a user tabs to the command bar input
- **THEN** a visible focus ring SHALL appear around it
