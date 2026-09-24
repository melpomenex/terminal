# Specification: Professional Quote Monitor (`QM` / `MONITOR`)

## ADDED Requirements

### Requirement: Professional Quote Monitor v2
The system SHALL provide an upgraded, high-density Quote Monitor capable of tracking hundreds of instruments simultaneously with configurable columns, real market fields, real-time flash updates, sorting, filtering, and watchlist synchronization.

#### Scenario: Configurable columns
- **GIVEN** Quote Monitor panel
- **WHEN** the user customizes their column layout
- **THEN** Quote Monitor SHALL support enabling/disabling and reordering the following standard fields:
  - `TICKER`, `NAME`, `LAST`, `CHG`, `CHG%`, `BID`, `BID_SIZE`, `ASK`, `ASK_SIZE`, `VOLUME`, `VWAP`, `OPEN`, `HIGH`, `LOW`, `PREV_CLOSE`, `52W_HIGH`, `52W_LOW`, `MARKET_CAP`, `EXCHANGE`, `SESSION_STATUS`, `SPARK_1D`.

#### Scenario: Real-time price flashes and session state
- **GIVEN** active market quotes streaming into Quote Monitor
- **WHEN** a ticker's last price ticks up or down
- **THEN** the cell SHALL trigger a momentary high-contrast green (`flash-positive`) or red (`flash-negative`) background pulse (620ms transition).
- **AND** the monitor header SHALL accurately reflect the current US market phase (`PRE-MARKET`, `REGULAR`, `POST-MARKET`, `CLOSED`) with appropriate color coding.

#### Scenario: High-performance sorting and inline filtering
- **GIVEN** a Quote Monitor containing 100+ tickers
- **WHEN** the user clicks any column header (e.g. `CHG%` or `VOLUME`) or types in the filter box (e.g. `"NV"`)
- **THEN** the table SHALL instantly sort or filter in-place without triggering network re-fetches.
- **AND** keyboard navigation (`ArrowUp` / `ArrowDown` / `Enter`) SHALL allow selecting any ticker as the active panel or link group context.

#### Scenario: Multi-watchlist backing
- **GIVEN** Quote Monitor
- **WHEN** the user switches between watchlists (`DEFAULT`, `SECTORS`, `INDEXES`, or Custom Watchlists)
- **THEN** Quote Monitor SHALL seamlessly load the associated symbols and subscribe to their real-time feeds.
