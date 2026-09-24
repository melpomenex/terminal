## ADDED Requirements

### Requirement: Display company fundamentals
The system SHALL display a fundamentals panel (PanelType: `fundamentals`) showing key financial metrics for the active symbol.

#### Scenario: View fundamentals for active symbol
- **WHEN** user opens a fundamentals panel and a symbol is active
- **THEN** panel displays: P/E ratio (TTM), market cap, EPS (TTM), dividend yield, beta, 52-week high/low, shares outstanding, float, enterprise value, price-to-book, price-to-sales, profit margin, operating margin, return on equity, revenue, gross profit, free cash flow, debt-to-equity, current ratio

#### Scenario: Fundamentals update on symbol change
- **WHEN** user selects a different symbol from the quote monitor
- **THEN** fundamentals panel fetches and displays data for the new symbol within one refresh cycle

#### Scenario: Loading state
- **WHEN** fundamentals data is being fetched
- **THEN** panel shows "LOADING..." in amber-dim color

#### Scenario: No data available
- **WHEN** fundamentals API returns no data or fails
- **THEN** panel shows "NO DATA" in amber-dim color
