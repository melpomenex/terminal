# Specification: AI Brain as a First-Class Terminal Orchestrator & Comparative Research Engine

## ADDED Requirements

### Requirement: Full-Terminal AI Tool Calling Framework
The system SHALL expand the AI Brain (`BRAIN`) tool-calling framework so that AI models (OpenAI, Anthropic, OpenRouter) can inspect, navigate, and manipulate the full terminal workspace, market data, and research datasets via structured tools.

#### Scenario: Workspace manipulation tools
- **GIVEN** an active AI Brain session
- **WHEN** the user instructs: "Open Nvidia's chart on the left and its options chain on the right in green link group"
- **THEN** the AI Brain SHALL execute structured client-side tools:
  1. `open_panel({ type: 'chart', direction: 'left', instrument: 'NVDA', linkGroup: 'GREEN' })`
  2. `open_panel({ type: 'options-chain', direction: 'right', instrument: 'NVDA', linkGroup: 'GREEN' })`
- **AND** the terminal window manager SHALL render the requested split layout with the specified link groups.

#### Scenario: Deep financial data query tools
- **GIVEN** an inquiry about financial fundamentals
- **WHEN** the user asks: "How much did Apple spend on R&D over the past 3 fiscal years, and what was their free cash flow?"
- **THEN** the AI Brain SHALL call `get_financial_statements({ symbol: 'AAPL', statementType: 'INCOME_STATEMENT', period: 'ANNUAL', limit: 3 })` and `get_financial_statements({ symbol: 'AAPL', statementType: 'CASH_FLOW', period: 'ANNUAL', limit: 3 })`.
- **AND** it SHALL synthesize the exact figures into a clear markdown table with source statement timestamps.

### Requirement: Evidence Citations and Provenance Verification
The system SHALL require that all AI research answers based on external filings, transcripts, news, or statements include verifiable, clickable source citations.

#### Scenario: AI answer with interactive filing and transcript citations
- **GIVEN** an AI response summarizing a company's regulatory risk factors or earnings guidance
- **WHEN** the AI outputs a factual claim (e.g. "Management anticipates Q1 revenue of $28.0B ± 2%")
- **THEN** the response SHALL attach an interactive citation marker `[1]`.
- **AND** clicking `[1]` SHALL open the source SEC filing or transcript segment directly in an adjacent panel at the exact paragraph.

### Requirement: Multi-Symbol Comparative Research Workflows (`COMPARE`)
The system SHALL support autonomous multi-step comparative research workflows (e.g. `COMPARE NVDA AMD INTC`).

#### Scenario: Autonomous peer comparison workflow
- **GIVEN** a comparative query: `"Compare NVDA, AMD, and INTC"`
- **WHEN** the AI orchestrator executes
- **THEN** it SHALL orchestrate a parallel multi-step research pipeline:
  1. Fetch valuation multiples (P/E, EV/EBITDA, P/S) for all 3 tickers
  2. Fetch margin profiles (Gross Margin, Operating Margin, Net Margin) across the last 4 quarters
  3. Fetch forward EPS and revenue growth consensus estimates
  4. Search recent earnings call transcripts for data center segment commentary
  5. Assemble a structured comparative research dossier with side-by-side matrices and synthesized competitive advantages.
