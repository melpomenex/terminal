## ADDED Requirements

### Requirement: Display market heatmap treemap
The system SHALL display a treemap visualization where each tile represents a stock, sized by market cap and colored by daily performance (green for gains, red for losses).

#### Scenario: Heatmap loads with S&P 500 data
- **WHEN** user opens the Market Heatmap panel
- **THEN** system fetches S&P 500 constituent data and renders a squarified treemap with tiles sized by market cap and colored by % change

#### Scenario: Sector grouping
- **WHEN** heatmap is displayed
- **THEN** stocks SHALL be grouped by sector with sector labels, and each sector region is visually bounded

### Requirement: Click to select symbol
The system SHALL allow clicking a tile to set it as the active symbol.

#### Scenario: Tile click sets active symbol
- **WHEN** user clicks a stock tile in the heatmap
- **THEN** that symbol becomes the active symbol and other panels update accordingly

### Requirement: Heatmap scope switching
The system SHALL allow switching between market views: S&P 500, sectors, and world indices.

#### Scenario: Switch to sector view
- **WHEN** user selects sector view from scope controls
- **THEN** heatmap aggregates to sector-level tiles showing average sector performance

### Requirement: Color scale
The system SHALL use a diverging color scale from red (decline) through gray (flat) to green (gain) with intensity proportional to magnitude.

#### Scenario: Large move shows intense color
- **WHEN** a stock moves +5%
- **THEN** its tile is bright green; a stock at -5% is bright red; a stock at 0% is neutral gray

### Requirement: Bloomberg command integration
The system SHALL support the `MAP` command to open the Market Heatmap panel.

#### Scenario: Command opens panel
- **WHEN** user types `MAP` in the command bar
- **THEN** Market Heatmap panel opens in the active tiling slot
