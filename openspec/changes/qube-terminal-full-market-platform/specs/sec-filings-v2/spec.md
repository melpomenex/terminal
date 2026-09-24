# Specification: SEC EDGAR Filings Browser & In-Terminal Reader (`FLNG`)

## ADDED Requirements

### Requirement: Enhanced SEC Filings Browser (`FLNG`)
The system SHALL provide an enhanced SEC Filings browser supporting company-specific and market-wide filings, form-type filtering, date filtering, and direct in-terminal reading.

#### Scenario: Form filtering for active security
- **GIVEN** `FLNG` panel for an active security (e.g. `AAPL`)
- **WHEN** the user selects form filter pills (`10-K`, `10-Q`, `8-K`, `DEF 14A`, `FORM 4`, `13D/G`, `S-1`, `S-3`, `ALL`)
- **THEN** the filing list SHALL instantly filter to matching SEC submissions.
- **AND** each filing entry SHALL display Form Type, Filing Date, Report Period Date, Description, and Accession Number.

### Requirement: In-Terminal SEC Document Reader
The system SHALL provide an integrated SEC document reader capable of rendering primary SEC HTML and XBRL documents within the terminal interface.

#### Scenario: Reading a 10-K or 10-Q filing inside the terminal
- **GIVEN** a filing in the `FLNG` list (e.g. Apple 10-K)
- **WHEN** the user selects the filing
- **THEN** the in-terminal reader SHALL open the document.
- **AND** it SHALL provide a left-hand Table of Contents sidebar with deep links to standard sections:
  - Part I: Item 1 (Business), Item 1A (Risk Factors)
  - Part II: Item 7 (MD&A), Item 8 (Financial Statements)
- **AND** it SHALL provide in-document text search and exhibit attachment links.

### Requirement: AI Brain Filing Citations and Analysis
The system SHALL equip the AI Brain with structured tools to parse and cite specific filing sections.

#### Scenario: Summarizing Risk Factor changes between 10-Ks
- **WHEN** the user asks: "What changed in Tesla's Item 1A Risk Factors between 2024 and 2025 10-K?"
- **THEN** the AI Brain SHALL query both 10-K filings, compute the delta between Risk Factor sections, synthesize new or modified risks, and provide clickable citations to the exact paragraph anchors.
