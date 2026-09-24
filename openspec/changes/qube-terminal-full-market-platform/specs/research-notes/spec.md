# Specification: Rich Multi-Document Research Notes (`NOTE` / `MEMO`)

## ADDED Requirements

### Requirement: Multi-Document Research Notes System (`NOTE` / `MEMO`)
The system SHALL provide a dedicated, multi-document rich research notes system (`NOTE` / `MEMO`) coexisting alongside the existing single-line tagged trading journal in `notes-panel.tsx`.

#### Scenario: Multi-document tabbed research note authoring
- **GIVEN** `NOTE` panel
- **WHEN** the user creates or opens notes
- **THEN** the panel SHALL support:
  - Multiple named note documents organized with tabs or a sidebar document list
  - Rich text / Markdown formatting: Headings (`#`, `##`), Bold, Italic, Bulleted/Numbered Lists, Code Blocks, Tables, Hyperlinks
  - Associated Ticker Tags (e.g. tagging a note with `$NVDA`, `$TSMC`, `$AMD`)
  - Full-text search across note titles and bodies
  - Automatic debounced autosave to local storage and cloud database.

### Requirement: AI Brain Interaction with Research Notes
The system SHALL enable the AI Brain to query, summarize, and append to research notes via structured tools (`query_notes`, `create_research_note`, `extract_thesis`).

#### Scenario: AI thesis extraction and research summary
- **GIVEN** research notes written for an investment thesis
- **WHEN** the user asks: "Summarize my investment thesis for NVDA and list the key risks from my notes"
- **THEN** the AI Brain SHALL search through note documents tagged `$NVDA`, extract the core thesis arguments and documented risk factors, and present a structured summary.
