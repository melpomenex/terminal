## ADDED Requirements

### Requirement: Export data as CSV
The system SHALL allow users to export watchlist or chart data as downloadable CSV files.

#### Scenario: Export watchlist to CSV
- **WHEN** user runs `XL <GO>` in command bar or clicks export button
- **THEN** system generates a CSV file with columns: #, Symbol, Last Price, Change, Change %, Volume and triggers browser download as `watchlist_YYYYMMDD_HHMMSS.csv`

#### Scenario: Export chart OHLCV data to CSV
- **WHEN** user runs `XL CHART <GO>` in command bar while a chart panel is active
- **THEN** system generates CSV with columns: Date, Open, High, Low, Close, Volume and downloads as `chart_SYMBOL_RANGE_YYYYMMDD_HHMMSS.csv`

#### Scenario: CSV uses proper formatting
- **WHEN** CSV is generated
- **THEN** numbers use 2 decimal places for prices, 4 for percentages; dates are ISO format (YYYY-MM-DD); header row is included; values are properly escaped (commas/quotes within double-quotes)

#### Scenario: Export triggered via function key
- **WHEN** no export-specific command is used but user wants quick export
- **THEN** XL function key (if present) triggers download of the currently focused panel's data
