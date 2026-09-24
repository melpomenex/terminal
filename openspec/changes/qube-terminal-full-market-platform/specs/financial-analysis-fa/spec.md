# Specification: Financial Statements Suite & Ratio Analysis (`FA` / `RATIO`)

## ADDED Requirements

### Requirement: Full Standardized Financial Statements Panel (`FA`)
The system SHALL provide a dedicated Financial Analysis / Financial Statements panel (`FA`) with standardized Income Statement, Balance Sheet, and Cash Flow statements across multiple historical periods.

#### Scenario: Multi-period Income Statement view
- **GIVEN** a corporate issuer (e.g. `AAPL` or `NVDA`)
- **WHEN** the user opens the `FA` panel and selects the "Income Statement" tab
- **THEN** the panel SHALL render multi-year or multi-quarter columns for:
  - Total Revenue, Cost of Revenue, Gross Profit, Gross Margin %
  - R&D Expenses, SG&A Expenses, Total Operating Expenses
  - Operating Income (EBIT), Operating Margin %
  - Interest Expense / Income, Other Non-Operating Income
  - Pre-Tax Income, Income Tax Expense, Effective Tax Rate %
  - Net Income, Net Margin %
  - Basic EPS, Diluted EPS, Diluted Share Count.
- **AND** the panel SHALL support toggling between `ANNUAL` (5-10 years), `QUARTERLY` (8-12 quarters), and `TTM`.

#### Scenario: Balance Sheet and Cash Flow hierarchy
- **GIVEN** `FA` panel
- **WHEN** switching to "Balance Sheet" or "Cash Flow" tabs
- **THEN** it SHALL render hierarchical line items with expandable sub-categories:
  - Balance Sheet: Current Assets, Non-Current Assets, Total Assets, Current Liabilities, Long-Term Debt, Total Liabilities, Shareholder Equity.
  - Cash Flow: Operating Cash Flow, Capex, Free Cash Flow, Investing Cash Flow, Financing Cash Flow, Share Repurchases, Dividends Paid.
- **AND** each line item SHALL display YoY growth % and Common-Size (% of Revenue or % of Assets) calculations.

### Requirement: Comprehensive Ratio Analysis Panel (`RATIO`)
The system SHALL provide a dedicated Financial Ratio Analysis panel displaying historical trends across all core fundamental dimensions:
1. **Valuation**: Trailing P/E, Forward P/E, PEG, EV/Revenue, EV/EBITDA, P/S, P/B, FCF Yield.
2. **Profitability**: Gross Margin, Operating Margin, Net Margin, ROE, ROA, ROIC.
3. **Growth**: 1Y / 3Y / 5Y Revenue YoY, EBITDA Growth, EPS Growth, FCF Growth.
4. **Leverage & Coverage**: Debt/Equity, Debt/EBITDA, Net Debt/EBITDA, Interest Coverage.
5. **Liquidity**: Current Ratio, Quick Ratio, Cash Ratio.

#### Scenario: Historical ratio trend inspection
- **GIVEN** `RATIO` panel for a company
- **WHEN** the user selects a ratio row (e.g. `ROIC` or `EV/EBITDA`)
- **THEN** the panel SHALL expand an inline sparkline and mini-chart showing the 5-year historical trajectory of that ratio.
