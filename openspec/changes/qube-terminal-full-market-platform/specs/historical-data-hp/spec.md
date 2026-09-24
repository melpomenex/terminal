# Specification: Full Historical Pricing & Corporate Actions Table (`HP`)

## ADDED Requirements

### Requirement: Historical Pricing Workstation (`HP`)
The system SHALL provide a dedicated Historical Pricing panel (`HP`) displaying tabular historical price and volume data across customizable date ranges, intervals, and corporate action adjustments.

#### Scenario: Date range and interval customization
- **GIVEN** `HP` panel for an instrument
- **WHEN** the user selects date presets (`1M`, `3M`, `6M`, `1Y`, `5Y`, `MAX`, or custom date picker `FROM` / `TO`) and interval (`1D`, `1W`, `1MO`, `1H`, `15M`, `5M`, `1M`)
- **THEN** the table SHALL fetch and display paginated rows with:
  - `DATE / TIME`, `OPEN`, `HIGH`, `LOW`, `CLOSE`, `ADJ_CLOSE`, `VOLUME`, `VWAP`, `NET_CHG`, `PCT_CHG`.

#### Scenario: Adjusted vs. unadjusted toggle and corporate actions
- **GIVEN** `HP` panel
- **WHEN** the user toggles the "Adjust for Splits / Dividends" switch
- **THEN** the prices SHALL dynamically recompute using cumulative adjustment factors.
- **AND** dates with stock splits, reverse splits, or dividend distributions SHALL be annotated with inline badge flags (`[SPLIT 4:1]`, `[DIV $0.25]`).

#### Scenario: Statistical summary header and export
- **GIVEN** historical rows displayed in `HP`
- **WHEN** viewing the summary banner
- **THEN** it SHALL display calculated Period High, Period Low, Average Daily Volume (ADV), Standard Deviation / Volatility %, Total Period Return %, and an instant "EXPORT TO CSV / EXCEL" button.
