## ADDED Requirements

### Requirement: Display historical OHLCV data table
The system SHALL provide a sortable table view of historical price data alongside or instead of the visual chart.

#### Scenario: Show data table below chart
- **WHEN** user toggles "Table" mode on the chart panel (or opens a dedicated data panel)
- **THEN** a sortable HTML table displays with columns: Date, Open, High, Low, Close, Volume, showing all data points from the current chart range

#### Scenario: Sort table by column
- **WHEN** user clicks a column header (Date, Open, High, etc.)
- **THEN** table rows re-sort by that column ascending; clicking again sorts descending

#### Scenario: Table updates with chart range
- **WHEN** user changes chart time range (e.g., from 1M to 1Y)
- **THEN** data table refreshes to show the new range's OHLCV data points

#### Scenario: Table shows same symbol as chart
- **WHEN** data table is displayed alongside a chart panel
- **THEN** both show data for the same symbol and time range

#### Scenario: Cell formatting matches terminal style
- **WHEN** data table renders
- **THEN** cells use amber-on-black styling, monospace font, positive values in green, negative in red, right-aligned numbers
