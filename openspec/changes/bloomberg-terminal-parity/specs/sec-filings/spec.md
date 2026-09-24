## ADDED Requirements

### Requirement: Browse company SEC filings
The system SHALL display a chronological list of SEC filings for the active symbol (10-K, 10-Q, 8-K, DEF 14A, S-1, SC 13D/A).

#### Scenario: Filings list loads
- **WHEN** user opens the SEC Filings panel with an active symbol
- **THEN** system fetches recent filings from SEC EDGAR and displays: filing type, filing date, description, and a link to the full document

### Requirement: Filter by filing type
The system SHALL allow filtering filings by type category.

#### Scenario: Filter to annual reports
- **WHEN** user selects "Annual (10-K)" filter
- **THEN** only 10-K and 10-K/A filings are displayed

### Requirement: View filing details
The system SHALL allow expanding a filing row to show key extracted data (for 10-K/10-Q: revenue, net income, total assets, total liabilities).

#### Scenario: Expand 10-K filing
- **WHEN** user clicks on a 10-K filing entry
- **THEN** panel expands to show key financial metrics extracted from the filing's XBRL data

### Requirement: Open full filing externally
The system SHALL provide a link to open the full filing on SEC.gov.

#### Scenario: Open on SEC.gov
- **WHEN** user clicks the external link icon on a filing
- **THEN** the SEC.gov HTML version of the filing opens in a new browser tab

### Requirement: Bloomberg command integration
The system SHALL support the `FLNG` command to open the SEC Filings panel.

#### Scenario: Command opens panel
- **WHEN** user types `FLNG` in the command bar
- **THEN** SEC Filings panel opens in the active tiling slot
