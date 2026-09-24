## ADDED Requirements

### Requirement: Chat API route with streaming
The system SHALL provide a POST endpoint at `/api/brain/chat` that accepts messages and settings, calls the configured LLM provider with tool definitions, and returns a streaming response.

#### Scenario: Successful streaming response
- **WHEN** a POST request arrives with valid messages, provider, model, and API key
- **THEN** the endpoint SHALL call the configured LLM with the terminal's tool definitions and system prompt
- **AND** SHALL return the response as a streaming text/event-source response

#### Scenario: Invalid API key
- **WHEN** a POST request arrives with an invalid or expired API key
- **THEN** the endpoint SHALL return a structured error indicating authentication failure
- **AND** no retry SHALL be attempted automatically

#### Scenario: Missing configuration
- **WHEN** a POST request arrives without provider, model, or API key
- **THEN** the endpoint SHALL return a 400 error with a message listing missing fields

### Requirement: Tool execution on server
The system SHALL execute data-fetching tools server-side within the API route when the LLM invokes them, returning results inline in the stream.

#### Scenario: LLM calls fetch_fundamentals
- **WHEN** the LLM returns a tool call for `fetch_fundamentals` with a symbol parameter
- **THEN** the API route SHALL call the existing Godel/Yahoo data fetching functions
- **AND** SHALL return the result to the LLM for inclusion in its response

#### Scenario: LLM calls multiple tools in parallel
- **WHEN** the LLM returns multiple data-fetching tool calls simultaneously
- **THEN** the API route SHALL execute them concurrently
- **AND** SHALL return all results before the LLM generates its next response

#### Scenario: Tool call with invalid parameters
- **WHEN** the LLM calls a tool with missing or invalid parameters
- **THEN** the API route SHALL return a descriptive error to the LLM
- **AND** the LLM SHALL be allowed to retry with corrected parameters

### Requirement: Client-side tool passthrough
The system SHALL return client-side tool calls (panel manipulation) as part of the streaming response without executing them server-side, allowing the client to execute them.

#### Scenario: LLM calls open_panel
- **WHEN** the LLM returns a tool call for `open_panel`
- **THEN** the API route SHALL include the tool call in the streamed response
- **AND** SHALL NOT attempt to execute it server-side
- **AND** the client SHALL execute the tool call against TilingContext

#### Scenario: LLM calls set_symbol
- **WHEN** the LLM returns a tool call for `set_symbol`
- **THEN** the tool call SHALL be streamed to the client
- **AND** the client SHALL dispatch `setSymbol()` on TerminalContext

### Requirement: System prompt construction
The system SHALL construct a system prompt that informs the LLM about the terminal's current state (active symbol, open panels, available watchlists) and available tools.

#### Scenario: System prompt includes terminal state
- **WHEN** the API route processes a chat request
- **THEN** the system prompt SHALL include the current active symbol, list of open panels, and available watchlists
- **AND** SHALL include instructions for using each available tool

#### Scenario: System prompt adapts to available tools
- **WHEN** the user has not configured a Perplexity API key
- **THEN** the system prompt SHALL NOT reference the research tool
- **AND** SHALL note that web research is unavailable

### Requirement: Perplexity research proxy route
The system SHALL provide a POST endpoint at `/api/brain/research` that proxies requests to the Perplexity API with the user's API key.

#### Scenario: Successful research query
- **WHEN** a POST request arrives with a query and valid Perplexity API key
- **THEN** the endpoint SHALL call Perplexity's chat completions API with the `sonar` model
- **AND** SHALL return the response including citations

#### Scenario: Perplexity API failure
- **WHEN** the Perplexity API returns an error
- **THEN** the endpoint SHALL return a structured error to the caller
- **AND** the LLM SHALL be informed that research failed and may retry
