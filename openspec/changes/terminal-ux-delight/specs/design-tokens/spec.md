## ADDED Requirements

### Requirement: Centralized design-token source of truth
The system SHALL define all design values (colors, typography, spacing, radii, elevation/shadows, z-index, and motion timing) as named design tokens in a single TypeScript module, and SHALL expose those tokens as CSS custom properties available to every component via `var(--<token>)`.

#### Scenario: Component consumes a token instead of a literal
- **WHEN** any shell or panel component renders a background color
- **THEN** it SHALL reference a CSS custom property (e.g. `var(--panel-bg)`) rather than a hardcoded hex literal

#### Scenario: Single definition location
- **WHEN** a token value needs to change
- **THEN** the change SHALL be made in the token module only, and every consumer SHALL reflect the new value without per-file edits

### Requirement: Typed token definitions
The design tokens SHALL be expressed as typed TypeScript objects so that themes and consumers receive compile-time safety on token names and value shapes.

#### Scenario: Invalid token name is caught at compile time
- **WHEN** a developer references a token that does not exist in the token type
- **THEN** the TypeScript compiler SHALL report an error

### Requirement: Semantic token layer
The system SHALL provide semantic tokens (e.g. `--text`, `--text-dim`, `--accent`, `--accent-dim`, `--positive`, `--negative`, `--panel-bg`, `--border`) mapped from raw palette tokens, and components SHALL reference semantic tokens rather than raw palette values.

#### Scenario: Positive market change uses semantic color
- **WHEN** a value rises
- **THEN** it SHALL be colored with the `--positive` semantic token, not a raw green hex

### Requirement: Default tokens reproduce the current look
The default base token values SHALL reproduce the terminal's existing amber-on-black CRT appearance, including the current `--bg`, `--amber`, `--font`, and font-size values defined in `globals.css`.

#### Scenario: Default theme is visually unchanged
- **WHEN** the app loads with no user-selected theme
- **THEN** the rendered appearance SHALL be visually equivalent to the pre-change amber-on-black design
