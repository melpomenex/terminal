# Specification: Centralized Data Export Service (`XL` / `EXPORT`)

## ADDED Requirements

### Requirement: Centralized Structured Data Export Service
The system SHALL provide a standardized export service across all tabular and research panels, allowing users to export structured data in `CSV`, `JSON`, and `XLSX` formats without each panel implementing ad-hoc download logic.

#### Scenario: Exporting panel dataset
- **GIVEN** any data panel (Quote Monitor, Options Chain, Financial Statements `FA`, Screener Results, Historical Data `HP`, Portfolio Positions)
- **WHEN** the user triggers export (via panel menu button or keyboard command `XL`)
- **THEN** the panel SHALL supply its structured column definitions and row dataset to the centralized `ExportService`.
- **AND** the service SHALL format numerical values cleanly, format ISO dates, generate standard headers, and trigger a browser file download with a standardized timestamped filename (e.g. `qube_aapl_financials_20260902.csv`).

#### Scenario: Supported export formats
- **GIVEN** a dataset export request
- **WHEN** the user selects format
- **THEN** the export service SHALL support:
  - `CSV`: Standard RFC 4180 comma-separated values.
  - `JSON`: Pretty-printed structured JSON array with metadata.
  - `XLSX`: Excel workbook with typed number formatting where supported.
