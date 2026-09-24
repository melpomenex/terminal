## ADDED Requirements

### Requirement: Stock screening with multiple filters
The system SHALL allow users to filter stocks by market cap, P/E ratio, dividend yield, sector, average volume, price range, and % change.

#### Scenario: Apply fundamental filters
- **WHEN** user sets filters (e.g., market cap > 10B, P/E < 25, dividend yield > 2%)
- **THEN** system returns matching stocks from Yahoo Finance screener API with current quotes

#### Scenario: Results display
- **WHEN** screener results are returned
- **THEN** system displays a sortable table with columns: symbol, name, price, change%, market cap, P/E, dividend yield, volume

### Requirement: Preset screens
The system SHALL provide preset screening queries: Large Cap Value, High Dividend, Top Gainers, Top Losers, Most Active, Undervalued.

#### Scenario: Select preset screen
- **WHEN** user selects "High Dividend" preset
- **THEN** system applies preconfigured filters (dividend yield > 3%, market cap > 5B) and shows results

### Requirement: Sort results
The system SHALL allow clicking column headers to sort results ascending or descending.

#### Scenario: Sort by market cap
- **WHEN** user clicks the "Market Cap" column header
- **THEN** results reorder by market cap descending; clicking again reverses to ascending

### Requirement: Add result to watchlist
The system SHALL allow adding screened stocks directly to the active watchlist.

#### Scenario: Add from screener
- **WHEN** user right-clicks a screener result and selects "Add to Watchlist"
- **THEN** the symbol is added to the current watchlist

### Requirement: Bloomberg command integration
The system SHALL support the `SCREEN` command to open the Stock Screener panel.

#### Scenario: Command opens panel
- **WHEN** user types `SCREEN` in the command bar
- **THEN** Stock Screener panel opens in the active tiling slot
