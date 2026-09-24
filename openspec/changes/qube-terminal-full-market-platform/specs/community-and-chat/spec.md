# Specification: Community Channels & Multi-User Chat (`CHAT` / `MSG`)

## ADDED Requirements

### Requirement: Community Channels & Ticker Rooms Architecture
The system SHALL specify a decoupled multi-user community chat architecture (`CHAT`) isolated from the AI Brain, supporting global channels, ticker-specific discussion rooms, private messages, and user presence.

#### Scenario: Ticker discussion room
- **GIVEN** `CHAT` panel linked to an active instrument (e.g. `TSLA`)
- **WHEN** the user switches to the ticker room
- **THEN** the chat feed SHALL stream messages posted by other users discussing that specific instrument.
- **AND** the panel SHALL support basic moderation (block, mute, report message).

#### Scenario: Architectural separation from AI Brain
- **GIVEN** Qube Terminal runtime
- **WHEN** operating the terminal
- **THEN** human Community Chat (`CHAT`) and AI Brain Orchestrator (`BRAIN`) SHALL maintain completely independent panels, state trees, and backend routes.
- **AND** this capability SHALL be classified as Priority P3 (Future/Optional) for single-user deployments.
