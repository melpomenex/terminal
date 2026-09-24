## ADDED Requirements

### Requirement: Display sentiment scores for active symbol
The system SHALL display recent social media sentiment data (Reddit, Twitter/X) for the active symbol as a sentiment score and trend chart.

#### Scenario: Sentiment loads for active symbol
- **WHEN** user opens the Social Sentiment panel with an active symbol
- **THEN** system fetches sentiment data and displays: current sentiment score (-1 to +1), sentiment label (Very Bearish / Bearish / Neutral / Bullish / Very Bullish), and a 7-day sentiment trend line chart

### Requirement: Trending tickers
The system SHALL display a list of currently trending tickers based on social media mention volume.

#### Scenario: Trending tickers list
- **WHEN** Social Sentiment panel is opened
- **THEN** panel shows a sidebar or section listing top 10 trending tickers with mention count and sentiment direction

### Requirement: Sentiment by source breakdown
The system SHALL show sentiment breakdown by data source (Reddit vs Twitter/X).

#### Scenario: Source breakdown
- **WHEN** sentiment data is loaded
- **THEN** panel displays sentiment scores separately for Reddit and Twitter/X, showing mention count and average sentiment per source

### Requirement: Mention volume chart
The system SHALL display a chart of daily mention volume over the past 30 days.

#### Scenario: Volume chart
- **WHEN** sentiment data is loaded
- **THEN** panel shows a bar chart of daily social media mention counts for the past 30 days

### Requirement: Click trending ticker to set active
The system SHALL allow clicking a trending ticker to set it as the active symbol.

#### Scenario: Click trending ticker
- **WHEN** user clicks on a trending ticker in the list
- **THEN** that symbol becomes the active symbol and all panels update

### Requirement: Bloomberg command integration
The system SHALL support the `SENT` command to open the Social Sentiment panel.

#### Scenario: Command opens panel
- **WHEN** user types `SENT` in the command bar
- **THEN** Social Sentiment panel opens in the active tiling slot
