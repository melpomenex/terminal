# Specification: Real Time & Sales Tick Stream (`T&S` / `TAPE`)

## ADDED Requirements

### Requirement: Authentic Millisecond Time & Sales Stream
The system SHALL provide a dedicated Time & Sales panel (`T&S` / `TAPE`) consuming authentic streaming trade prints with millisecond timestamps, trade sizes, execution prices, exchange venue codes, and trade condition flags.

#### Scenario: Displaying real trade prints
- **GIVEN** an active instrument with streaming trade entitlement
- **WHEN** trade prints execute on exchange venues
- **THEN** Time & Sales SHALL display the chronological stream:
  - `TIME` (HH:mm:ss.SSS)
  - `PRICE` (formatted to appropriate decimal precision, colored green if $\ge$ previous print or red if $<$ previous print)
  - `SIZE` (share volume of the print)
  - `SIDE` (`B` for at/above ask, `S` for at/below bid, `MID` if between spread)
  - `VENUE` (e.g. `XNAS`, `XNYS`, `EDGA`, `BATS`)
  - `COND` (condition codes: Regular `@`, Intermarket Sweep `F`, Average Price `W`, Form T, Block `B`)

#### Scenario: Filtering trade stream
- **GIVEN** the Time & Sales stream
- **WHEN** the user selects filters (`ALL`, `BUYS`, `SELLS`, `BLOCKS ONLY`, or `MIN SIZE >= 1000`)
- **THEN** only trades meeting the filter criteria SHALL be displayed in the viewport.
- **AND** block trades ($\ge 10,000$ shares or $\ge \$200,000$ notional) SHALL be highlighted with high-contrast amber borders.

#### Scenario: Graceful degradation when tick feed is unavailable
- **GIVEN** an instrument or user session without real-time tick streaming entitlement
- **WHEN** the Time & Sales panel is opened
- **THEN** the panel SHALL display `● UNAVAILABLE — Real-Time Trade Feed Not Entitled`
- **AND** the panel SHALL NOT synthesize fake trades or PRNG-sliced candles.
