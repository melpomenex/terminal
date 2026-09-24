## ADDED Requirements

### Requirement: Display recent insider transactions
The system SHALL display a table of recent insider transactions for the active symbol sourced from SEC EDGAR Form 4 filings.

#### Scenario: Insider transactions load for active symbol
- **WHEN** user opens the Insider Activity panel with an active symbol
- **THEN** system fetches recent Form 4 filings from SEC EDGAR and displays: insider name, title/role, transaction date, transaction type (Purchase/Sale), shares, price, total value, shares held after

#### Scenario: Color-code buy vs sell
- **WHEN** insider transactions are displayed
- **THEN** purchases SHALL be highlighted green and sales highlighted red

### Requirement: Aggregate insider sentiment
The system SHALL compute and display an aggregate insider sentiment indicator (net buying vs selling over 30/90/180 day windows).

#### Scenario: Net insider activity summary
- **WHEN** insider data is loaded
- **THEN** panel shows summary stats: total buys, total sells, net value, and a sentiment score (Bullish/Bearish/Neutral) for each time window

### Requirement: All-company insider feed
The system SHALL support a mode showing recent insider activity across all major companies (not filtered to one symbol).

#### Scenario: Switch to market-wide view
- **WHEN** user clears the symbol filter
- **THEN** panel shows the most recent significant insider transactions across the market, sorted by value

### Requirement: Bloomberg command integration
The system SHALL support the `INSI` command to open the Insider Activity panel.

#### Scenario: Command opens panel
- **WHEN** user types `INSI` in the command bar
- **THEN** Insider Activity panel opens in the active tiling slot
