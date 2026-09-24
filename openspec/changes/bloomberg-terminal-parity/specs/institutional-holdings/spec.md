## ADDED Requirements

### Requirement: Display top institutional holders
The system SHALL display the top institutional holders of the active symbol from 13F filing data.

#### Scenario: Institutional holders load
- **WHEN** user opens the Institutional Holdings panel with an active symbol
- **THEN** system fetches 13F data from SEC EDGAR and displays a table: institution name, shares held, % of portfolio, % of shares outstanding, value, change in shares (quarter-over-quarter)

### Requirement: Ownership change indicators
The system SHALL highlight institutions that meaningfully increased or decreased their positions.

#### Scenario: Position change highlighting
- **WHEN** institutional holdings are displayed
- **THEN** institutions that increased positions by >10% are highlighted green; those decreasing by >10% are highlighted red

### Requirement: Ownership pie chart
The system SHALL display a breakdown of ownership: institutional %, insider %, and public float %.

#### Scenario: Ownership breakdown
- **WHEN** holdings data is loaded
- **THEN** panel shows a pie chart or bar showing institutional ownership percentage, insider ownership percentage, and remaining public float

### Requirement: Historical ownership trend
The system SHALL show how institutional ownership has changed over recent quarters.

#### Scenario: Ownership trend chart
- **WHEN** user views the Institutional Holdings panel
- **THEN** panel includes a small line chart showing total institutional ownership % over the last 4-8 quarters

### Requirement: Bloomberg command integration
The system SHALL support the `HOLD` command to open the Institutional Holdings panel.

#### Scenario: Command opens panel
- **WHEN** user types `HOLD` in the command bar
- **THEN** Institutional Holdings panel opens in the active tiling slot
