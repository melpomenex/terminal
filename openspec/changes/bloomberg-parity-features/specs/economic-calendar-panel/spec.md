## ADDED Requirements

### Requirement: Display economic calendar panel
The system SHALL provide an economic calendar panel (PanelType: `economic-calendar`) showing upcoming economic events.

#### Scenario: View upcoming economic events
- **WHEN** user opens an economic calendar panel
- **THEN** panel displays table of upcoming events with columns: Date, Time (ET), Currency, Event Name, Importance (High/Medium/Low), Forecast, Previous, Actual (when available)

#### Scenario: Fetch economic data
- **WHEN** economic calendar panel mounts or refreshes
- **THEN** system fetches from `/api/yfin/economic-calendar` which proxies a free economic calendar API (FiscalData, or similar)

#### Scenario: Importance color coding
- **WHEN** event importance is High
- **THEN** row or importance indicator rendered in amber-bright; Medium in amber; Low in amber-dim

#### Scenario: ECO command opens economic calendar
- **WHEN** user types `ECO <GO>` in command bar
- **THEN** system adds an economic calendar panel to layout

#### Scenario: Filter by currency/importance
- **WHEN** user clicks filter toggle for currency (USD, EUR, GBP, etc.) or importance level
- **THEN** calendar shows only matching events
