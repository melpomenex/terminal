## ADDED Requirements

### Requirement: Motion token set
The system SHALL define a discrete set of motion tokens (durations and easing curves, e.g. `--motion-fast`, `--motion-base`, `--motion-slow`, `--ease-out`, `--ease-spring`) consumed by all transitions and animations for consistency.

#### Scenario: Transitions share timing
- **WHEN** a pane opens and a dropdown fades in during the same interaction
- **THEN** both SHALL use durations and easings drawn from the shared motion token set

### Requirement: Pane lifecycle animations
Opening, closing, maximizing, and restoring panes SHALL be animated using GPU-accelerated `transform` and `opacity` transitions, with a smooth reflow that does not cause layout jank in adjacent panes.

#### Scenario: Pane open animates in
- **WHEN** a new pane is added to the tiling layout
- **THEN** it SHALL fade and scale in over the base motion duration rather than appearing instantly

#### Scenario: Maximize animates smoothly
- **WHEN** the user maximizes a pane
- **THEN** the pane SHALL smoothly expand to fill the workspace without disturbing other panes' data

### Requirement: Interactive state transitions
Hover, focus, active, and selection states on controls and rows SHALL transition smoothly using the motion tokens rather than snapping, covering command-bar badges, function keys, context menu items, and list rows.

#### Scenario: Hovering a command badge animates
- **WHEN** the user hovers a command-bar badge
- **THEN** its background SHALL transition smoothly to the hover state over the fast motion duration

### Requirement: Refined price-flash animation
Price updates SHALL trigger a refined flash animation on the changed cell/value that clearly distinguishes positive from negative direction and resolves cleanly, replacing the existing flash keyframes with the token-driven version.

#### Scenario: Price increase flashes positive
- **WHEN** a quoted price increases on refresh
- **THEN** the value SHALL briefly flash using the positive direction animation and return to the resting color

### Requirement: Reduced-motion support
The system SHALL detect `prefers-reduced-motion` and SHALL disable non-essential animations (pane transitions, flashes, decorative motion), degrading to instant color/state changes while preserving essential feedback.

#### Scenario: Reduced-motion user sees no pane animation
- **WHEN** the OS reports `prefers-reduced-motion: reduce` and a pane is added
- **THEN** the pane SHALL appear without a scale/fade transition while the active-pane focus ring still renders
