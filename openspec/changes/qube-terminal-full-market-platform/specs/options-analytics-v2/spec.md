# Specification: Professional Options Analytics Suite & Valuation Model Evaluator (`OMON` / `OVME`)

## ADDED Requirements

### Requirement: Professional Options Chain Suite (`OMON`)
The system SHALL provide a high-density Options Chain panel displaying real call and put contracts grouped by expiration date, with real Implied Volatility (IV), Open Interest (OI), Volume, and mathematical Greek sensitivities.

#### Scenario: Options chain display and ITM/OTM shading
- **GIVEN** an underlying equity or index with active options series
- **WHEN** Options Chain loads an expiration
- **THEN** it SHALL render:
  - Calls table on the left: `LAST`, `BID`, `ASK`, `VOL`, `OI`, `IV`, `DELTA`, `GAMMA`, `THETA`, `VEGA`
  - Center column: `STRIKE` (highlighting the ATM strike and a banner at the current underlying spot price)
  - Puts table on the right: `DELTA`, `GAMMA`, `THETA`, `VEGA`, `IV`, `OI`, `VOL`, `BID`, `ASK`, `LAST`
- **AND** In-The-Money (ITM) calls ($K < S$) and ITM puts ($K > S$) SHALL be visually shaded with subtle amber background styling.

#### Scenario: Real Implied Volatility and Greek calculations
- **GIVEN** option contract bids and asks
- **WHEN** displaying contract analytics
- **THEN** IV SHALL be ingested from the provider or computed via the Black-Scholes solver using the mid-market price $\frac{Bid + Ask}{2}$.
- **AND** Greeks ($\Delta, \Gamma, \Theta, \nu, \rho$) SHALL be calculated using the standardized Black-Scholes formula with annual risk-free rate ($r$) and dividend yield ($q$).
- **AND** all computed Greeks SHALL be labeled with the `● DERIVED` provenance pill.

#### Scenario: Expiration filtering and strike range controls
- **GIVEN** Options Chain
- **WHEN** the user interacts with the expiration pills or filters
- **THEN** the panel SHALL support filtering by Weekly vs. Monthly expirations, DTE (Days to Expiry) range, and Strike Range ($\pm 5, 10, 20$ strikes or $\pm 10\%, 20\%$ moneyness).

### Requirement: Options Valuation Model Evaluator (`OVME`)
The system SHALL provide a dedicated Options Valuation Model Evaluator panel (`OVME`) for deep pricing simulation, implied volatility root-finding, and sensitivity stress testing.

#### Scenario: Interactive Black-Scholes pricing and IV solver
- **GIVEN** `OVME` panel
- **WHEN** the user enters underlying price ($S$), strike ($K$), expiration ($T$), interest rate ($r$), and market option price ($P_{mkt}$)
- **THEN** the solver SHALL compute the exact Implied Volatility ($\sigma_{IV}$) using Newton-Raphson iteration.
- **AND** changing any slider (e.g. $+10\%$ spot price or $-5\%$ volatility) SHALL dynamically recalculate theoretical option price, intrinsic/extrinsic value, and Delta/Gamma/Theta/Vega/Rho.
- **AND** the panel SHALL render an interactive P&L at Expiration diagram displaying breakeven points, maximum profit, and maximum loss.
