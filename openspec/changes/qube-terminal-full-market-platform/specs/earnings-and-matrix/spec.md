# Specification: Forward Earnings Estimates & Earnings Matrix (`ERN` / `EM`)

## ADDED Requirements

### Requirement: Earnings Consensus & Surprise Panel (`ERN`)
The system SHALL provide an Earnings Estimates and Surprise panel (`ERN`) displaying historical reported earnings performance alongside forward consensus estimates.

#### Scenario: Historical EPS and Revenue surprise
- **GIVEN** `ERN` panel for a company
- **WHEN** displaying historical quarters
- **THEN** it SHALL render:
  - Report Date, Fiscal Quarter, EPS Actual vs. EPS Estimate, EPS Surprise % (colored green for beat, red for miss)
  - Revenue Actual vs. Revenue Estimate, Revenue Surprise %
  - Stock price reaction (% change on 1-day and 5-day post-earnings).

#### Scenario: Forward consensus estimates & analyst revisions
- **GIVEN** `ERN` panel
- **WHEN** viewing forward periods (Next Quarter `FQ+1`, Current Year `FY0`, Next Year `FY+1`)
- **THEN** it SHALL display:
  - Consensus EPS & Revenue Estimate (Mean, High, Low)
  - Number of covering analysts
  - Estimate Revisions: Upward vs. Downward revisions over the past 30 and 90 days
  - Implied Forward P/E and Forward EV/Sales multiples based on current stock price.

### Requirement: Comprehensive Earnings Matrix (`EM`)
The system SHALL provide an Earnings Matrix panel (`EM`) unifying historical reported results and forward consensus projections in an expandable multi-column grid.

#### Scenario: Multi-period financial matrix grid
- **GIVEN** `EM` panel
- **WHEN** the matrix renders
- **THEN** rows SHALL display core line items:
  - Sales / Revenue, Gross Profit, EBITDA, Operating Income, Net Income, Diluted EPS, Free Cash Flow, Capex
  - Operating Margin %, Net Margin %, ROIC %
- **AND** columns SHALL display 5 historical annual periods, 8 historical quarterly periods, and 4 forward forecast periods (`FY+1`, `FY+2`, `FQ+1`, `FQ+2`).
- **AND** forward columns SHALL be visually distinguished with a dashed header styling and consensus badge.
