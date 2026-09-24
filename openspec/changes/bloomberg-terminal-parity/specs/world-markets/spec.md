## ADDED Requirements

### Requirement: Display global market indices
The system SHALL display major global stock indices grouped by region (Americas, Europe, Asia/Pacific, Middle East/Africa).

#### Scenario: Global indices load
- **WHEN** user opens the World Markets panel
- **THEN** system fetches quotes for major indices (S&P 500, Dow, Nasdaq, FTSE 100, DAX, Nikkei 225, Hang Seng, Shanghai, BSE Sensex, etc.) and displays: index name, current value, daily change, change%, with regional groupings

### Requirement: Regional color coding
The system SHALL color index performance: green for positive, red for negative, gray for unchanged.

#### Scenario: Performance colors
- **WHEN** world markets data is displayed
- **THEN** each index row is color-coded by its daily performance direction

### Requirement: Market status indicator
The system SHALL show whether each market is currently open or closed based on its local trading hours and timezone.

#### Scenario: Market open/closed status
- **WHEN** world markets data is loaded
- **THEN** each index shows an "OPEN" or "CLOSED" indicator based on its exchange's trading hours

### Requirement: Click to chart an index
The system SHALL allow clicking an index to open a chart for it.

#### Scenario: Click index to chart
- **WHEN** user clicks on "Nikkei 225" in the World Markets panel
- **THEN** the active symbol changes to ^N225 and the chart panel displays the Nikkei chart

### Requirement: Bloomberg command integration
The system SHALL support the `WEER` command to open the World Markets panel.

#### Scenario: Command opens panel
- **WHEN** user types `WEER` in the command bar
- **THEN** World Markets panel opens in the active tiling slot
