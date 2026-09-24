## ADDED Requirements

### Requirement: Track portfolio positions with P&L
The system SHALL provide a portfolio panel (PanelType: `portfolio`) displaying per-position and aggregate P&L.

#### Scenario: View portfolio with positions
- **WHEN** user opens a portfolio panel
- **THEN** panel displays a table of positions with columns: Symbol, Quantity, Cost Basis, Market Value, Unrealized P&L, Unrealized P&L %, Day Change, Day Change %

#### Scenario: Add position to portfolio
- **WHEN** user runs command `ADD 100 AAPL 150` (quantity symbol cost) or uses an add UI
- **THEN** system adds position {symbol: "AAPL", quantity: 100, costBasis: 150} to portfolio

#### Scenario: Calculate unrealized P&L
- **WHEN** portfolio panel renders with current market prices available
- **THEN** each position's unrealized P&L = (currentPrice - costBasis) * quantity, displayed in green if positive, red if negative

#### Scenario: Calculate total portfolio P&L
- **WHEN** portfolio panel renders
- **THEN** total portfolio row shows sum of all market values, total cost basis, total unrealized P&L, and total daily change

#### Scenario: Remove position from portfolio
- **WHEN** user runs command `REMOVE AAPL` or clicks remove button on a position
- **THEN** position is removed from portfolio; other positions remain unchanged

#### Scenario: Persist portfolio to localStorage
- **WHEN** portfolio is modified (add/remove)
- **THEN** updated portfolio array is saved to localStorage under key `blm_portfolio_positions`

#### Scenario: Migrate legacy portfolio format
- **WHEN** system loads and finds legacy `blm_portfolio` (string[] format) but no `blm_portfolio_positions`
- **THEN** system converts string[] to Position[] with quantity=0, costBasis=0 as placeholder values, prompting user to edit
