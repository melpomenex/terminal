# Specification: Market Monitors — IPO & Market Halts (`IPO` / `HALT`)

## ADDED Requirements

### Requirement: IPO Monitor Panel (`IPO`)
The system SHALL provide a dedicated Initial Public Offering monitor panel (`IPO`) tracking offerings across stages: `FILED`, `EXPECTED`, `PRICED`, `TRADING`, and `WITHDRAWN`.

#### Scenario: Displaying upcoming and recent IPOs
- **GIVEN** `IPO` panel
- **WHEN** the panel loads
- **THEN** it SHALL render:
  - `TICKER`, `COMPANY NAME`, `EXCHANGE`, `STATUS`
  - `EXPECTED_DATE` / `PRICING_DATE`
  - `OFFER_RANGE` (e.g. "$18.00 - $21.00"), `FINAL_OFFER_PRICE`
  - `DEAL_SIZE` ($M), `SHARES_OFFERED`, `LEAD_UNDERWRITERS`
  - `DAY_1_RETURN %`, `CURRENT_PRICE`, `TOTAL_RETURN %`
  - Link to the issuer's preliminary prospectus (`S-1` / `F-1`).
- **AND** once an IPO begins trading, clicking the row SHALL load the instrument into any linked pane.

### Requirement: Market Halts Monitor Panel (`HALT`)
The system SHALL provide a real-time exchange halt monitor (`HALT`) displaying active trading pauses and resumptions across US exchanges (Nasdaq, NYSE, Cboe).

#### Scenario: Tracking active and historical halts
- **GIVEN** `HALT` panel
- **WHEN** an exchange issues a trading halt
- **THEN** the panel SHALL display:
  - `TICKER`, `NAME`, `EXCHANGE`, `HALT_TIME` (EST)
  - `HALT_CODE` (e.g. `LUDP` Volatility Trading Pause, `T1` News Pending, `T2` News Released, `T12` Additional Info Requested, `M` Volatility Auction)
  - `DECODED_REASON` (human-readable explanation of the regulatory code)
  - `RESUMPTION_TRADE_TIME` / `QUOTE_RESUMPTION_TIME`
  - `STATUS` (`ACTIVE_HALT` colored red, `RESUMED` colored green).
- **AND** the panel SHALL support filtering by Active Halts vs. Historical Halts and specific tickers.
