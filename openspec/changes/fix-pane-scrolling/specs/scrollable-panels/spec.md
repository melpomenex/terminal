## ADDED Requirements

### Requirement: Panel content scrolls when it overflows
All panel content must be scrollable when it exceeds the visible pane area. Scrolling works via mouse wheel, trackpad, and keyboard (j/k).

#### Scenario: News feed has more articles than visible space
- **GIVEN** the news panel is open and contains 30+ articles
- **WHEN** the user scrolls with mouse wheel or presses j/k inside the panel
- **THEN** the content scrolls to reveal hidden articles below

#### Scenario: Stock screener has many results
- **GIVEN** the stock screener panel is open with 50+ results
- **WHEN** the user scrolls within the panel
- **THEN** all rows are accessible by scrolling down

#### Scenario: Options chain with many strikes
- **GIVEN** the options chain panel shows an expiration with 50+ strikes
- **WHEN** the user scrolls within the panel
- **THEN** all strike rows are accessible

#### Scenario: Small pane with any content
- **GIVEN** a pane is resized to a very small height
- **WHEN** the panel content exceeds the visible area
- **THEN** the content scrolls

### Requirement: Panel headers stay fixed during scroll
When a panel has a fixed header (title, filters, column headers), the header must remain visible while the body scrolls.

#### Scenario: Scrolling news feed keeps toolbar visible
- **GIVEN** the news panel with its toolbar (FEED/TOP/BREAKING tabs)
- **WHEN** the user scrolls the article list
- **THEN** the toolbar remains fixed at the top

#### Scenario: Scrolling options chain keeps column headers visible
- **GIVEN** the options chain with expiry buttons and column headers
- **WHEN** the user scrolls through strikes
- **THEN** column headers remain fixed at the top

### Requirement: No scroll container nesting
Each pane has exactly one scroll container (`[data-panel-scroll]`). Panels must not create their own nested `overflow: auto` containers.

#### Scenario: Panel renders correctly in the scroll chain
- **GIVEN** any panel component
- **WHEN** rendered inside a TilingLeaf
- **THEN** the panel root participates in flex layout without `height: 100%` and without an inner scroll container
