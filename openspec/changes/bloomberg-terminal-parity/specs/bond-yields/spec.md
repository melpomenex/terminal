## ADDED Requirements

### Requirement: Display US Treasury yield curve
The system SHALL display current yields for US Treasury benchmarks (1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y) in a visual yield curve chart.

#### Scenario: Yield curve loads on panel open
- **WHEN** user opens the Bond Yields panel
- **THEN** system fetches current Treasury yields from Yahoo Finance (^IRX, ^FVX, ^TNX, ^TYX, etc.) and displays them as a curve plot with maturity on X-axis and yield % on Y-axis

#### Scenario: Yield data refreshes periodically
- **WHEN** the Bond Yields panel is open
- **THEN** yields SHALL refresh every 60 seconds

### Requirement: Display historical rate chart
The system SHALL allow toggling between yield curve view and historical rate chart for a selected maturity.

#### Scenario: User clicks on a maturity point
- **WHEN** user clicks on a specific maturity point on the yield curve
- **THEN** system displays a historical line chart of that maturity's yield over the past year

### Requirement: Show yield spreads
The system SHALL display key yield spreads (2Y-10Y, 2Y-30Y, 10Y-30Y) with color indication for inversion.

#### Scenario: Spread display
- **WHEN** yield data is loaded
- **THEN** panel shows spread values in basis points, with inversions highlighted in red

### Requirement: Bloomberg command integration
The system SHALL support the `YCRV` command to open the Bond Yields panel.

#### Scenario: Command opens panel
- **WHEN** user types `YCRV` in the command bar
- **THEN** Bond Yields panel opens in the active tiling slot
