# Specification: Earnings Call Transcripts Explorer (`TRAN`)

## ADDED Requirements

### Requirement: Structured Earnings Transcripts Explorer (`TRAN`)
The system SHALL provide a dedicated Earnings Call Transcripts panel (`TRAN`) providing structured access to historical conference call transcripts with speaker roles, section partitions, full-text search, and AI query anchors.

#### Scenario: Navigating transcripts by quarter
- **GIVEN** `TRAN` panel for a company (e.g. `NVDA`)
- **WHEN** the panel opens
- **THEN** it SHALL list all available past earnings calls by quarter (e.g. `Q4 2025`, `Q3 2025`, `Q2 2025`, `Q1 2025`) with call dates and audio timestamps.
- **AND** selecting a quarter SHALL load the full structured transcript.

#### Scenario: Section partitioning and speaker filtering
- **GIVEN** an active transcript
- **WHEN** the user views the content
- **THEN** the panel SHALL partition content into:
  - **Prepared Remarks / Presentation**: CEO, CFO, and executive commentary.
  - **Question & Answer (Q&A)**: Wall Street analyst questions paired with executive responses.
- **AND** the user SHALL be able to filter by individual speakers (e.g. "Show only Jensen Huang" or "Show only Morgan Stanley analyst").

#### Scenario: Full-text keyword search and jumping
- **GIVEN** a transcript loaded in `TRAN`
- **WHEN** the user types a search keyword (e.g. `"margins"`, `"guidance"`, `"capex"`, `"Blackwell"`)
- **THEN** all occurrences SHALL be highlighted throughout the transcript.
- **AND** the panel SHALL provide `Next` / `Prev` match navigation buttons with match counters.

### Requirement: AI Brain Transcript Operability
The transcript data model SHALL be structured so that the AI Brain can query, compare, and extract insights across transcript quarters through dedicated tools (`search_transcripts`, `compare_guidance`).

#### Scenario: AI-driven guidance comparison across quarters
- **GIVEN** the AI Brain analyzing an issuer
- **WHEN** the user asks: "Compare CFO guidance on gross margins across the last four earnings calls"
- **THEN** the AI Brain SHALL invoke transcript query tools, extract exact quotes from the CFO remarks across the 4 quarterly calls, and return a structured summary table citing each quarter and paragraph.
