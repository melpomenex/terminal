## ADDED Requirements

### Requirement: Panel manipulation tools
The system SHALL provide the following client-side tools that the LLM can invoke to control the tiling window manager: `open_panel`, `close_panel`, `set_symbol`, `load_preset`, `switch_watchlist`.

#### Scenario: open_panel tool
- **WHEN** the LLM calls `open_panel` with parameters `{ type: "chart", direction: "right" }`
- **THEN** a new chart panel SHALL be opened to the right of the currently active panel
- **AND** the tool result SHALL confirm the panel was opened with its panel ID

#### Scenario: close_panel tool
- **WHEN** the LLM calls `close_panel` with parameters `{ panel_id: "abc123" }`
- **THEN** the specified panel SHALL be removed from the layout
- **AND** adjacent panels SHALL expand to fill the space

#### Scenario: set_symbol tool
- **WHEN** the LLM calls `set_symbol` with parameters `{ symbol: "NVDA" }`
- **THEN** the active symbol SHALL be set to "NVDA"
- **AND** all symbol-dependent panels SHALL refresh with NVDA data

#### Scenario: load_preset tool
- **WHEN** the LLM calls `load_preset` with parameters `{ preset: "TRADER" }`
- **THEN** the layout SHALL be replaced with the TRADER preset layout

#### Scenario: switch_watchlist tool
- **WHEN** the LLM calls `switch_watchlist` with parameters `{ name: "SECTORS" }`
- **THEN** the active watchlist SHALL switch to SECTORS
- **AND** the quote monitor SHALL update to show sector ETFs

### Requirement: Chart and alert tools
The system SHALL provide tools for chart manipulation (`set_chart_range`, `toggle_indicator`) and alert creation (`add_alert`).

#### Scenario: set_chart_range tool
- **WHEN** the LLM calls `set_chart_range` with parameters `{ range: "6M" }`
- **THEN** the chart panel SHALL switch to a 6-month view

#### Scenario: toggle_indicator tool
- **WHEN** the LLM calls `toggle_indicator` with parameters `{ indicator: "SMA", enabled: true }`
- **THEN** the SMA overlay SHALL be enabled on the chart

#### Scenario: add_alert tool
- **WHEN** the LLM calls `add_alert` with parameters `{ symbol: "AAPL", condition: "ABOVE", threshold: 200 }`
- **THEN** a price alert SHALL be created for AAPL above $200

### Requirement: Data-fetching tools
The system SHALL provide server-side tools that the LLM can invoke to retrieve structured financial data: `fetch_fundamentals`, `fetch_news`, `fetch_chart_data`, `fetch_earnings`, `fetch_options`, `fetch_insider_activity`.

#### Scenario: fetch_fundamentals tool
- **WHEN** the LLM calls `fetch_fundamentals` with parameters `{ symbol: "NVDA" }`
- **THEN** the tool SHALL return key financial metrics (market cap, P/E, revenue, EPS, 52-week range, dividend yield, sector, employees)
- **AND** the result SHALL be rendered as a data card in the chat

#### Scenario: fetch_news tool
- **WHEN** the LLM calls `fetch_news` with optional parameters `{ symbol: "NVDA", limit: 5 }`
- **THEN** the tool SHALL return the latest news headlines related to the symbol

#### Scenario: fetch_chart_data tool
- **WHEN** the LLM calls `fetch_chart_data` with parameters `{ symbol: "NVDA", range: "1M" }`
- **THEN** the tool SHALL return OHLCV data with summary statistics (high, low, avg volume, trend direction)

#### Scenario: fetch_earnings tool
- **WHEN** the LLM calls `fetch_earnings` with parameters `{ symbol: "NVDA" }`
- **THEN** the tool SHALL return recent earnings history with EPS actual vs expected and beats/misses

#### Scenario: fetch_options tool
- **WHEN** the LLM calls `fetch_options` with parameters `{ symbol: "NVDA" }`
- **THEN** the tool SHALL return options chain summary (ATM strike, IV, open interest, volume)

#### Scenario: fetch_insider_activity tool
- **WHEN** the LLM calls `fetch_insider_activity` with parameters `{ symbol: "NVDA" }`
- **THEN** the tool SHALL return recent insider transactions with name, title, date, shares, and price

### Requirement: Tool parameter validation
All tools SHALL validate their parameters before execution. Invalid parameters SHALL return descriptive errors that the LLM can use to self-correct.

#### Scenario: Invalid panel type
- **WHEN** the LLM calls `open_panel` with `{ type: "nonexistent" }`
- **THEN** the tool SHALL return an error listing valid panel types

#### Scenario: Invalid symbol format
- **WHEN** the LLM calls `fetch_fundamentals` with `{ symbol: "" }` or missing symbol
- **THEN** the tool SHALL return an error indicating a valid symbol is required
