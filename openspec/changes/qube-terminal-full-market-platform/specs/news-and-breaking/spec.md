# Specification: Multi-Source News & Real-Time Breaking Alerts (`NEWS` / `BREAKING`)

## ADDED Requirements

### Requirement: Multi-Source Filtered News Panel v2 (`NEWS`)
The system SHALL provide an upgraded News Feed panel supporting multi-ticker filtering, watchlist linking, keyword inclusion/exclusion, source filtering, category tagging, and an in-terminal clean article reader.

#### Scenario: Multi-ticker and watchlist news filtering
- **GIVEN** `NEWS` panel
- **WHEN** the user sets the filter mode to:
  - `ACTIVE_INSTRUMENT`: Shows news exclusively for the panel's active symbol.
  - `LINKED_WATCHLIST`: Shows news aggregated across all tickers in the selected watchlist.
  - `GLOBAL_MARKET`: Shows macro, market-wide, and sector headlines.
- **THEN** the feed SHALL dynamically stream only headlines matching the active scope.

#### Scenario: Keyword inclusion and exclusion filters
- **GIVEN** `NEWS` panel
- **WHEN** the user inputs include keywords (e.g. `+acquisition +AI`) or exclude keywords (e.g. `-lawsuit -class-action`)
- **THEN** the feed SHALL filter headlines and article summaries in real-time according to the boolean logic.

#### Scenario: In-terminal article reader modal
- **GIVEN** a headline in the news feed
- **WHEN** the user clicks the article row or presses `Enter`
- **THEN** for public/syndicated sources permitting terminal rendering, the system SHALL open a clean reader modal showing article body, publish timestamp, author, and associated tickers.
- **AND** for paywalled/copyrighted sources, it SHALL display the article metadata summary and provide a clean "Open External Source" button.

### Requirement: Real-Time Breaking News Alert System (`BREAKING`)
The system SHALL provide a first-class Breaking News subsystem delivering high-urgency notifications across the terminal.

#### Scenario: Triggering breaking news banner and audio
- **GIVEN** a market-wide or watchlist-relevant breaking news event (e.g., Fed rate decision, emergency halt, major M&A)
- **WHEN** the breaking news alert arrives via the real-time stream
- **THEN** the terminal SHALL render a high-visibility animated top banner displaying the urgency badge, affected tickers, and headline.
- **AND** if audio alerts are enabled in settings, the terminal SHALL play a subtle Bloomberg-style audible notification chime.
- **AND** the breaking item SHALL be logged to the Centralized Notification Center.
