## ADDED Requirements

### Requirement: Overlay multiple securities on chart
The system SHALL allow comparing 2-3 securities' price action on the same chart axes.

#### Scenario: Add comparison security via command
- **WHEN** user types `GP AAPL MSFT <GO>` in command bar while viewing a chart panel
- **THEN** the chart overlays MSFT's close price as a secondary line (green dashed) alongside the primary symbol's candlesticks

#### Scenario: Add single comparison security
- **WHEN** user types `GP MSFT <GO>` or uses a "Compare" button in chart header
- **THEN** one additional security's price line is overlaid on the chart

#### Scenario: Remove comparison security
- **WHEN** user types `GP <GO>` (no comparison symbols) or clicks remove button
- **THEN** chart returns to showing only the primary symbol

#### Scenario: Comparison uses shared Y-axis
- **WHEN** two or more securities are displayed on the same chart
- **THEN** all securities share the same Y-axis price scale (determined by the union of all price ranges), so relative performance is visible

#### Scenario: Comparison line legend
- **WHEN** comparison lines are rendered
- **THEN** each line has a distinct color and the symbol label is shown in the chart header or as a small legend near the line endpoint

#### Scenario: Fetch comparison data
- **WHEN** a comparison symbol is specified
- **THEN** system fetches chart data for that symbol using the same range/interval as the primary chart and caches it in state
