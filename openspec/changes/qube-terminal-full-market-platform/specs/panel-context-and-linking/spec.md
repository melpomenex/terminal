# Specification: Per-Panel Context & Color-Linked Groups

## ADDED Requirements

### Requirement: Independent Per-Panel Instrument State
The system SHALL support per-panel instrument state ownership. Every leaf node in the tiling tree SHALL be capable of holding its own independent `instrument?: InstrumentRef | null`, eliminating the single global symbol bottleneck.

#### Scenario: Displaying different instruments in separate panes
- **GIVEN** a workspace with two chart panels (Panel A and Panel B)
- **WHEN** the user sets Panel A to `"AAPL"` and Panel B to `"MSFT"`
- **THEN** Panel A SHALL render Apple's chart data and Panel B SHALL render Microsoft's chart data.
- **AND** changing the time range or indicator in Panel A SHALL NOT affect Panel B.

### Requirement: Color-Linked Panel Coordination
The system SHALL provide 7 distinct link groups (`RED`, `YELLOW`, `GREEN`, `BLUE`, `MAGENTA`, `CYAN`, `UNLINKED`) that synchronize instrument changes across panels sharing the same link group.

#### Scenario: Synchronizing panels within a link group
- **GIVEN** a workspace containing:
  - Panel 1: Chart (`GREEN` link group, active: `AAPL`)
  - Panel 2: News (`GREEN` link group, active: `AAPL`)
  - Panel 3: Options Chain (`GREEN` link group, active: `AAPL`)
  - Panel 4: Chart (`BLUE` link group, active: `NVDA`)
  - Panel 5: Fundamentals (`UNLINKED`, active: `MSFT`)
- **WHEN** the user changes the instrument of Panel 1 to `"GOOGL"`
- **THEN** Panel 1 (Chart), Panel 2 (News), and Panel 3 (Options) SHALL immediately update to `"GOOGL"`.
- **AND** Panel 4 (`BLUE`) SHALL remain on `"NVDA"`.
- **AND** Panel 5 (`UNLINKED`) SHALL remain on `"MSFT"`.

#### Scenario: Visual indicator and link group selection
- **GIVEN** any panel title bar in the workspace
- **WHEN** the user views or clicks the link indicator pill
- **THEN** the title bar SHALL render a distinct colored square or badge matching its active link group.
- **AND** clicking the badge SHALL open a color picker dropdown allowing the user to switch the panel to any of the 7 link groups.

#### Scenario: Command-based link group assignment
- **WHEN** the user executes command `LINK GREEN` while Panel 4 is focused
- **THEN** Panel 4's link group SHALL change to `GREEN` and its instrument SHALL synchronize with the active instrument of the `GREEN` group.

### Requirement: Layout Serialization with Per-Panel State
The system SHALL serialize and deserialize the full tiling tree including `instrument` and `linkGroup` properties for each leaf node when saving or loading workspaces.

#### Scenario: Workspace save and restore
- **GIVEN** a customized multi-pane layout with multiple link groups and instruments
- **WHEN** the user saves the workspace (e.g. `WORKSPACE SAVE multi-tech`)
- **THEN** the serialized JSON layout tree SHALL preserve all panel IDs, split ratios, panel types, `instrument` references, and `linkGroup` assignments.
- **AND** loading the workspace SHALL restore the exact multi-pane state.
