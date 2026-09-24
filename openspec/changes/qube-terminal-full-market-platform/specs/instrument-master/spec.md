# Specification: Canonical Cross-Asset Instrument Master & Multi-Listing (ALLQ)

## ADDED Requirements

### Requirement: Canonical Instrument Master Data Model
The system SHALL represent all tradeable and observable financial assets through a provider-agnostic `Instrument` and lightweight `InstrumentRef` model supporting equities, ETFs, mutual funds, equity/index options, futures, futures options, FX pairs, cryptocurrencies, sovereign/corporate bonds, commodities, and economic indicators.

#### Scenario: Instrument identity representation
- **GIVEN** a financial security in the terminal
- **WHEN** the system creates or accesses an `Instrument` record
- **THEN** it SHALL populate canonical identifiers (`id`, `symbol`, `displaySymbol`, `assetClass`, `mic`, `currency`, `country`) and provider mapping metadata.
- **AND** for options contracts, it SHALL populate `optionDetails` (`strikePrice`, `expirationDate`, `optionType`, `contractMultiplier`, `exerciseStyle`, `osiSymbol`).
- **AND** for futures contracts, it SHALL populate `futureDetails` (`contractMonth`, `contractYear`, `expirationDate`, `contractSize`, `tickSize`).

#### Scenario: Provider-agnostic instrument referencing
- **GIVEN** any panel, watchlist, alert, portfolio position, or AI tool in Qube Terminal
- **WHEN** referencing a financial instrument
- **THEN** it SHALL use an `InstrumentRef` (`{ id, symbol, displaySymbol, assetClass, name?, exchange? }`) rather than a raw, unvalidated string.

### Requirement: Cross-Asset Symbology Resolver
The system SHALL provide a multi-asset resolver (`SecurityMasterResolver`) capable of parsing human-entered ticker strings, Bloomberg-style mnemonics, OSI options strings, and composite symbols into canonical `InstrumentRef` instances.

#### Scenario: Resolving standard equity tickers
- **WHEN** the user or AI inputs `"AAPL"` or `"AAPL US Equity"`
- **THEN** the resolver SHALL return the canonical `InstrumentRef` for Apple Inc. with `assetClass: 'EQUITY'`, `mic: 'XNAS'`, and `currency: 'USD'`.

#### Scenario: Resolving dual share classes
- **WHEN** the user inputs `"BRK.B"`, `"BRK-B"`, or `"BRK/B"`
- **THEN** the resolver SHALL normalize the ticker to the canonical representation `"BRK-B"` with alternate symbol mappings.

#### Scenario: Resolving standard options contracts
- **WHEN** the user inputs `"AAPL 260515 C 200"` or OSI string `"AAPL  260515C00200000"`
- **THEN** the resolver SHALL parse the underlying symbol, expiration date (May 15, 2026), option type (`CALL`), and strike price ($200.00), returning an `InstrumentRef` with `assetClass: 'OPTION'`.

#### Scenario: Resolving FX currency pairs
- **WHEN** the user inputs `"EURUSD"` or `"EUR/USD"` or `"EURUSD Curncy"`
- **THEN** the resolver SHALL return an `InstrumentRef` with `assetClass: 'FX'` and base/quote currency details.

### Requirement: All Quotes & Related Listings Workflow (`ALLQ`)
The system SHALL provide an `ALLQ` workflow displaying primary listings, regional listings, ADRs, dual share classes, and associated trading venues for any selected issuer.

#### Scenario: Opening ALLQ for an international or multi-venue issuer
- **GIVEN** a company with multiple global listings (e.g. Shell `SHEL` / `SHEL.L` or Sony `SONY` / `6758.T`)
- **WHEN** the user invokes `ALLQ` or executes `ALLQ <symbol>`
- **THEN** the ALLQ panel SHALL display a structured table of all known listings with venue MIC, currency, last price, local trading session state, and data provider.
- **AND** clicking any listing row SHALL allow the user to load that specific regional instrument into any linked pane.
