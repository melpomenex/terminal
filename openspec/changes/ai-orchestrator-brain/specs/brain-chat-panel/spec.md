## ADDED Requirements

### Requirement: Brain chat panel type
The system SHALL register `brain-chat` as a new PanelType in the tiling window manager, allowing it to be opened, closed, resized, maximized, and repositioned like any other panel.

#### Scenario: Opening brain-chat via context menu
- **WHEN** user right-clicks a panel and selects "Brain Chat" from the context menu
- **THEN** a new brain-chat panel SHALL be opened adjacent to the clicked panel

#### Scenario: Opening brain-chat via command bar
- **WHEN** user types `BRAIN` or `AI` in the command bar and presses Enter
- **THEN** a new brain-chat panel SHALL be opened

#### Scenario: Including brain-chat in preset layouts
- **WHEN** a preset layout includes `brain-chat` as a panel type
- **THEN** the brain-chat panel SHALL render correctly within the preset

### Requirement: Chat message input
The system SHALL display a text input at the bottom of the brain-chat panel where users type natural language messages to the LLM orchestrator.

#### Scenario: Sending a message
- **WHEN** user types a message and presses Enter
- **THEN** the message SHALL appear as a user bubble in the chat history
- **AND** a streaming response from the LLM SHALL begin

#### Scenario: Empty message rejection
- **WHEN** user presses Enter with empty input
- **THEN** no action SHALL be taken

### Requirement: Streaming response display
The system SHALL display LLM responses as streaming text, rendering tokens as they arrive from the server.

#### Scenario: Streaming in progress
- **WHEN** the LLM is generating a response
- **THEN** tokens SHALL appear incrementally in an assistant bubble
- **AND** a blinking cursor or indicator SHALL show at the end of the streaming text

#### Scenario: Stream completes
- **WHEN** the LLM finishes generating
- **THEN** the full response SHALL be displayed as a completed message bubble
- **AND** the input field SHALL be re-enabled for the next message

### Requirement: Tool call visualization
The system SHALL display visual indicators when the LLM invokes tools, showing which tool was called and its result status.

#### Scenario: Tool call in progress
- **WHEN** the LLM invokes a tool (e.g., `open_panel`, `fetch_fundamentals`)
- **THEN** the chat SHALL display a compact indicator showing the tool name (e.g., "Opening Chart Panel...")

#### Scenario: Tool call completed
- **WHEN** a tool call completes successfully
- **THEN** the indicator SHALL show a success state
- **AND** the LLM's subsequent response text SHALL continue streaming

#### Scenario: Tool call failure
- **WHEN** a tool call fails (e.g., invalid symbol)
- **THEN** the indicator SHALL show the error
- **AND** the LLM SHALL receive the error message and respond accordingly

### Requirement: Structured data cards
The system SHALL render data-fetching tool results as styled cards within the chat flow, including tables, metric blocks, and mini-visualizations.

#### Scenario: Fundamentals card
- **WHEN** the LLM calls `fetch_fundamentals` for a symbol
- **THEN** the result SHALL render as a card showing key metrics (market cap, P/E, 52-week range, etc.) in a grid layout matching the terminal's amber visual theme

#### Scenario: News card
- **WHEN** the LLM calls `fetch_news`
- **THEN** the result SHALL render as a card with headline, source, and timestamp for each article

#### Scenario: Research card with citations
- **WHEN** the LLM calls the `research` tool
- **THEN** the result SHALL render as a card with the answer text and numbered citation links

### Requirement: Conversation history
The system SHALL maintain per-panel conversation history in client state. Each brain-chat panel SHALL have its own independent conversation.

#### Scenario: Independent panel conversations
- **WHEN** user has two brain-chat panels open
- **THEN** each panel SHALL maintain its own message history
- **AND** messages in one panel SHALL NOT appear in the other

#### Scenario: Clearing conversation
- **WHEN** user triggers conversation clear (via command or UI button)
- **THEN** all messages in the active brain-chat panel SHALL be removed
- **AND** a fresh system prompt SHALL be established for the next message
