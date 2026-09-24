# Specification: Portfolio Management, Read-Only Brokerage & AUM (`PRTU` / `AUM`)

## ADDED Requirements

### Requirement: Advanced Portfolio Management (`PRTU`)
The system SHALL expand the Portfolio subsystem to support multi-account portfolios, position lots, cost basis tracking, realized and unrealized P&L, sector/asset-class allocations, and risk integration.

#### Scenario: Multi-lot position tracking
- **GIVEN** `PRTU` panel
- **WHEN** managing positions
- **THEN** it SHALL support:
  - Adding position lots (`Symbol`, `Quantity`, `Cost Basis`, `Acquisition Date`)
  - Computing Current Market Value, Unrealized P&L ($ and %), Realized P&L, Day P&L
  - Breakdown by Sector, Asset Class, and Currency Exposure
  - Integration with `risk-math.ts` (Portfolio Volatility, Portfolio Beta, Sharpe Ratio, Value-at-Risk, Maximum Drawdown).

### Requirement: Read-Only Brokerage Integration Provider
The system SHALL provide a provider abstraction for read-only brokerage aggregation (e.g. SnapTrade or Plaid), allowing users to link external brokerage accounts securely.

#### Scenario: Read-only account syncing
- **GIVEN** a linked external brokerage account
- **WHEN** the user syncs their brokerage
- **THEN** the system SHALL import account balances, positions, cost basis, and cash balances in read-only mode.
- **AND** the system SHALL NOT support or expose any order routing or execution capabilities.

### Requirement: Account & Portfolio AUM Analytics (`AUM`)
The system SHALL provide an AUM Analytics panel displaying individual account AUM, aggregate multi-account AUM, cash vs. invested equity ratios, and historical portfolio equity growth curves.

#### Scenario: Displaying aggregate AUM curve
- **GIVEN** `AUM` panel
- **WHEN** the panel renders
- **THEN** it SHALL display Total Net Asset Value ($), Total Cash Balance, Total Invested Equity, and a historical portfolio valuation chart spanning the lifetime of the account.
