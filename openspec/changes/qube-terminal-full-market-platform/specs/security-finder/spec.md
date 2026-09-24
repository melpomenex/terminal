# Specification: Global Security Finder & Entity Search (`SECF`)

## ADDED Requirements

### Requirement: Multi-Asset Global Security Finder (`SECF`)
The system SHALL provide a centralized, modal or panel-based Security Finder (`SECF`) allowing users to discover financial instruments across all asset classes with fuzzy matching, real-time filtering, keyboard navigation, and metadata previews.

#### Scenario: Fuzzy search across symbols and company names
- **GIVEN** the Security Finder is open
- **WHEN** the user types a search query (e.g. `"Micro"`)
- **THEN** the finder SHALL return matching results including Microsoft Corp (`MSFT`), Micron Technology (`MU`), MicroStrategy (`MSTR`), and relevant funds/indices.
- **AND** match ranking SHALL prioritize exact symbol matches, primary listings, and high-market-cap entities.

#### Scenario: Asset-class and venue filtering
- **GIVEN** search results are displayed
- **WHEN** the user selects an asset-class filter pill (`ALL`, `EQUITIES`, `OPTIONS`, `FUTURES`, `FX`, `CRYPTO`, `BONDS`, `INDICES`)
- **THEN** the result list SHALL instantly filter to only instruments belonging to the selected asset class.

#### Scenario: Keyboard navigation and quick actions
- **GIVEN** search results are displayed in the finder
- **WHEN** the user uses `ArrowUp` / `ArrowDown` keys and presses `Enter`
- **THEN** the active result SHALL be selected and loaded into the active panel (or its linked group).
- **AND** pressing quick-action keys (e.g. `G` for Chart, `D` for Description, `O` for Options, `F` for Financials, `N` for News) SHALL open that specific panel with the selected instrument.

### Requirement: Entity & Corporate Hierarchy Search
The system SHALL support searching for corporate entities, executives, fund managers, and institutional filers, linking discovered entities to their respective securities or SEC filings.

#### Scenario: Searching for an executive or superinvestor
- **WHEN** the user queries a person's name (e.g. `"Warren Buffett"` or `"Elon Musk"`)
- **THEN** the search results SHALL display associated corporate entities (e.g. Berkshire Hathaway, Tesla) and recent Form 4 / 13F filing summaries.
