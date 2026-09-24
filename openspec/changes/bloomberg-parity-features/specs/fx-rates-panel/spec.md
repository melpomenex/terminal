## ADDED Requirements

### Requirement: Display FX rates panel
The system SHALL provide an FX rates panel (PanelType: `fx-rates`) showing forex pair spot prices.

#### Scenario: View default FX pairs
- **WHEN** user opens an FX rates panel
- **THEN** panel displays watchlist of major FX pairs: EURUSD, GBPUSD, USDJPY, USDCAD, AUDUSD, USDCNH, EURGBP, EURJPY, GBPJPY, USDCHF with columns: Pair, Rate, Bid, Ask, Spread, Change, Change %

#### Scenario: FX pair uses Yahoo Finance format
- **WHEN** system fetches data for an FX pair
- **THEN** it uses Yahoo Finance symbol format `EURUSD=X` via existing chart/watchlist API routes

#### Scenario: Color-coded FX changes
- **WHEN** an FX rate increases
- **THEN** change displayed in green; decreases displayed in red

#### Scenario: Custom FX watchlist
- **WHEN** user adds a custom FX pair via command `FX ADD EURCHF`
- **THEN** pair is added to the FX panel's watchlist; persisted to localStorage
