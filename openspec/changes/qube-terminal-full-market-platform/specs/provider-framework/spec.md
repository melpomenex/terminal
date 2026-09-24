# Specification: Modular Market Data Provider Abstraction Framework

## ADDED Requirements

### Requirement: Capability-Based Provider Interfaces
The system SHALL decouple all UI panels and analytical engines from direct third-party API dependencies by introducing strongly-typed capability provider interfaces:
- `IQuoteProvider`: Real-time and delayed quotes, NBBO bid/ask, volume, VWAP, day highs/lows.
- `IHistoricalBarsProvider`: Multi-timeframe OHLCV bars (1m, 5m, 15m, 1h, 1d, 1w, 1mo) with split/dividend adjustment flags.
- `IOptionsProvider`: Expirations, option chains, strikes, volume, open interest, and provider Greeks.
- `IFinancialStatementsProvider`: Standardized multi-period Income Statements, Balance Sheets, and Cash Flow statements.
- `IEarningsEstimatesProvider`: Historical earnings surprises, consensus EPS/revenue forecasts, analyst revision counts.
- `ITranscriptsProvider`: Structured earnings call transcripts with prepared remarks, Q&A sections, and speaker metadata.
- `INewsProvider`: Real-time and historical multi-source news articles with category, symbol, and urgency tagging.
- `IFilingsProvider`: SEC EDGAR filings metadata, raw HTML/XBRL retrieval, and exhibit access.
- `IBrokerageProvider`: Read-only aggregated brokerage connectivity (accounts, positions, balances).

#### Scenario: Provider abstraction decoupling
- **GIVEN** any panel in Qube Terminal requesting financial data
- **WHEN** the panel triggers a data fetch
- **THEN** it SHALL call a capability provider interface method via the unified API gateway without knowing whether the underlying vendor is Polygon, Finnhub, Twelve Data, SEC EDGAR, or user-supplied keys.

### Requirement: Multi-Tier Provider Fallback and Quality Tagging
The system SHALL implement a prioritized provider fallback chain with automatic degradation and explicit data quality tagging on every payload.

#### Scenario: Primary provider failure with secondary fallback
- **GIVEN** a primary quote provider experiencing rate limits (HTTP 429) or network failure
- **WHEN** a quote is requested for an instrument
- **THEN** the provider manager SHALL seamlessly query the secondary fallback provider.
- **AND** the returned `QuoteResult` SHALL carry `DataProvenance` marking `quality: 'DELAYED'` or `sourceProvider: '<secondary-name>'`.
- **AND** the panel UI SHALL render the corresponding provenance badge without crashing or showing blank fields.

### Requirement: Entitlement Engine and Licensing Enforcement
The system SHALL model and respect user data entitlements (e.g., non-professional delayed data vs. licensed exchange real-time feeds).

#### Scenario: Requesting unentitled Level 2 depth
- **GIVEN** a user session without Level 2 market data entitlements
- **WHEN** the user opens the `DEPTH` panel
- **THEN** the panel SHALL display a clear entitlement banner (`● UNAVAILABLE — Level 2 Market Depth Entitlement Required`) with an option to configure provider credentials.
- **AND** the system SHALL NOT synthesize fake order book levels.

### Requirement: Provider Settings & Secure Secret Management
The system SHALL provide a dedicated Provider Settings UI (`SETTING DATA` or `BRAINCFG`) allowing users to configure API keys, test connections, view rate limit utilization, and set provider priority orders.

#### Scenario: Testing provider credentials
- **GIVEN** the Provider Settings interface
- **WHEN** the user inputs an API key for a supported provider (e.g. Polygon, Finnhub, or SnapTrade) and clicks "TEST CONNECTION"
- **THEN** the system SHALL execute a test query, report latency and active entitlements, and securely store the credential.
