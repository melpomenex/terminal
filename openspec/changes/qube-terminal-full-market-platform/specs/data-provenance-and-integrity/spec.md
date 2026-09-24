# Specification: Market Data Provenance, Truthful Reporting & Synthetic Data Migration

## ADDED Requirements

### Requirement: Standardized Data Provenance Reporting
The system SHALL attach explicit `DataProvenance` metadata to every market data record and analytical output displayed in Qube Terminal, identifying the source provider, timestamp, currency, and data quality level (`LIVE`, `DELAYED`, `DERIVED`, `SIMULATED`, `STALE`, `UNAVAILABLE`).

#### Scenario: Inspecting provenance on a panel
- **GIVEN** any panel rendering financial data
- **WHEN** the user hovers over or inspects the panel's provenance pill
- **THEN** a tooltip SHALL reveal:
  - Exact source provider (e.g. "Polygon.io", "SEC EDGAR", "Treasury.gov")
  - Exchange timestamp and local receipt timestamp
  - Latency / delay indication (e.g. "15-minute delayed")
  - Entitlement tier

### Requirement: Elimination of Silent Synthetic Market Data
The system SHALL eliminate all un-flagged synthetic or PRNG-generated market data across the entire platform.

#### Scenario: Quote Monitor bid/ask integrity
- **GIVEN** Quote Monitor rendering real-time or delayed quotes
- **WHEN** the upstream provider provides real bid and ask prices
- **THEN** Quote Monitor SHALL render the actual provider bid and ask.
- **AND** if the provider does NOT supply bid/ask, Quote Monitor SHALL render `---` rather than computing a synthetic `price ± $0.01` spread.

#### Scenario: Time & Sales (TAPE) integrity
- **GIVEN** Time & Sales panel
- **WHEN** a real-time streaming trade feed is unavailable
- **THEN** the panel SHALL display `● UNAVAILABLE — Real-time Time & Sales stream requires market data entitlement`
- **AND** the system SHALL NOT reconstruct synthetic trades from 1-minute OHLCV candles using PRNG algorithms.

#### Scenario: Level 2 Order Book (DEPTH) integrity
- **GIVEN** Level 2 Market Depth panel
- **WHEN** Level 2 market data is not available from the provider
- **THEN** the panel SHALL display `● UNAVAILABLE — Level 2 Depth Feed Not Configured`
- **AND** the system SHALL NOT generate synthetic market maker orders (`JPM`, `GS`, `MS`) using random number generators.

#### Scenario: Options Chain Implied Volatility integrity
- **GIVEN** Options Chain panel
- **WHEN** calculating or displaying Implied Volatility
- **THEN** the system SHALL use provider-supplied IV or execute a numerical Black-Scholes IV solver against real market option prices.
- **AND** all computed Greeks and IVs SHALL be explicitly labeled with the `● DERIVED` provenance badge.
- **AND** the system SHALL NOT use the legacy mock formula (`18.4 + dist * 0.65`).

#### Scenario: Superinvestors & Social Sentiment remediation
- **GIVEN** Superinvestor panel or Social Sentiment panel
- **WHEN** data is displayed
- **THEN** Superinvestors SHALL parse genuine SEC Form 13F-HR filings rather than randomizing AUM and returns.
- **AND** Social Sentiment SHALL either consume authentic social APIs or explicitly display `● EXPERIMENTAL PROXY` with formula disclosure.
