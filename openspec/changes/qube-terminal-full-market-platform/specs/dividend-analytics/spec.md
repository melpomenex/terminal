# Specification: Security-Specific Dividend Analytics (`DIV` / `DVD`)

## ADDED Requirements

### Requirement: Dividend Analytics Panel (`DIV` / `DVD`)
The system SHALL provide a security-specific Dividend Analytics panel (`DIV`) delivering deep payout history, sustainability metrics, dividend growth compounding rates, and forward yield projections (coexisting with the market-wide `dividend-calendar` panel).

#### Scenario: Displaying corporate dividend history and key dates
- **GIVEN** `DIV` panel for a dividend-paying security (e.g. `JNJ` or `KO`)
- **WHEN** the panel loads
- **THEN** it SHALL render:
  - Summary KPI Header: Trailing 12-Month Yield %, Forward Yield %, Annualized Dividend ($), Payout Ratio %, 5-Year Dividend Growth Rate %, Consecutive Years of Dividend Increases.
  - Historical Payout Table: `EX_DATE`, `RECORD_DATE`, `PAY_DATE`, `DECLARATION_DATE`, `AMOUNT`, `FREQUENCY` (Quarterly, Annual, Special), `ADJUSTED_AMOUNT`.
  - Historical Dividend Growth Chart: Visual bar graph showing dividend per share growth over 10+ years.

#### Scenario: Dividend sustainability and safety analysis
- **GIVEN** `DIV` panel
- **WHEN** evaluating payout safety
- **THEN** it SHALL compute:
  - Earnings Payout Ratio ($\frac{\text{Dividends per Share}}{\text{EPS}}$)
  - Free Cash Flow Payout Ratio ($\frac{\text{Total Dividends Paid}}{\text{Free Cash Flow}}$)
  - Warning banner if FCF Payout Ratio exceeds $100\%$.
