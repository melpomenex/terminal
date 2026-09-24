## ADDED Requirements

### Requirement: Filter news feed by keyword and source
The system SHALL provide client-side filtering of news items.

#### Scenario: Filter news by keyword
- **WHEN** user types text into the news filter input field
- **THEN** news feed shows only items whose title contains the search text (case-insensitive); items not matching are hidden

#### Scenario: Clear filter shows all news
- **WHEN** user clears the filter input field
- **THEN** all news items are displayed again

#### Scenario: Filter by source
- **WHEN** user toggles source filter buttons (BBC, CNBC, All)
- **THEN** news feed shows only items from selected sources; "All" shows everything

#### Scenario: Combined filter (keyword + source)
- **WHEN** user enters keyword "inflation" AND selects source "BBC"
- **THEN** feed shows only BBC articles whose titles contain "inflation"

#### Scenario: Filter persists during session
- **WHEN** user has filtered news and switches between panels or refreshes data
- **THEN** filter settings (keyword + source selection) are preserved in component state (not cleared on data refresh)

#### Scenario: Filter input in news panel header
- **WHEN** news feed panel renders
- **THEN** a filter bar appears between the panel title bar and the news list containing: text input (placeholder "Filter...") and source toggle buttons
