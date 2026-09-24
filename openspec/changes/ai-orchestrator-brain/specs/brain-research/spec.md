## ADDED Requirements

### Requirement: Perplexity research tool
The system SHALL provide a `research` tool that the LLM can invoke to get web-grounded answers with citations via the Perplexity API.

#### Scenario: Research query about a company
- **WHEN** the LLM calls `research` with parameters `{ query: "What is the latest news on NVIDIA's AI chip production?" }`
- **THEN** the tool SHALL call Perplexity's API with the query using the `sonar` model
- **AND** SHALL return the answer text with numbered citations

#### Scenario: Research query about market trends
- **WHEN** the LLM calls `research` with parameters `{ query: "What are analysts forecasting for S&P 500 in 2026?" }`
- **THEN** the tool SHALL return a synthesized answer with citations from financial news sources

### Requirement: Research tool availability gating
The research tool SHALL only be available when the user has configured a Perplexity API key in brain settings.

#### Scenario: Research tool available with key
- **WHEN** the user has configured a Perplexity API key
- **THEN** the `research` tool SHALL be included in the tool definitions sent to the LLM

#### Scenario: Research tool unavailable without key
- **WHEN** the user has not configured a Perplexity API key
- **THEN** the `research` tool SHALL be excluded from the tool definitions
- **AND** the system prompt SHALL note that web research capabilities are not available

### Requirement: Research result rendering
Research results SHALL render as a styled card within the chat flow, displaying the answer text and clickable citation links.

#### Scenario: Research card with citations
- **WHEN** the `research` tool returns a result with citations
- **THEN** the card SHALL display the answer text followed by a "Sources" section with numbered citation links
- **AND** each link SHALL open in a new browser tab

#### Scenario: Research card without citations
- **WHEN** the `research` tool returns a result without citations
- **THEN** the card SHALL display the answer text without a "Sources" section

### Requirement: Research error handling
The system SHALL handle Perplexity API errors gracefully and inform the LLM so it can respond appropriately.

#### Scenario: Perplexity API rate limit
- **WHEN** the Perplexity API returns a 429 rate limit error
- **THEN** the tool SHALL return an error message indicating rate limiting
- **AND** the LLM SHALL inform the user and suggest retrying later

#### Scenario: Perplexity API timeout
- **WHEN** the Perplexity API request exceeds 15 seconds
- **THEN** the tool SHALL return a timeout error
- **AND** the LLM SHALL inform the user that research is temporarily unavailable
