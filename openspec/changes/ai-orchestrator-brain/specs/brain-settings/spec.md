## ADDED Requirements

### Requirement: Provider and model selection
The system SHALL allow users to select an LLM provider (OpenAI, Anthropic) and a model within that provider (e.g., gpt-4o, claude-sonnet-4-6-20250514) from the brain settings panel.

#### Scenario: User selects a provider and model
- **WHEN** user opens brain settings and selects "Anthropic" as provider
- **THEN** the model dropdown SHALL populate with available Anthropic models (claude-sonnet-4-6-20250514, claude-haiku-4-5-20251001, claude-opus-4-7)
- **AND** selecting a model SHALL persist the choice to localStorage key `blm_brain_settings`

#### Scenario: Default settings on first use
- **WHEN** user opens brain settings for the first time with no saved settings
- **THEN** provider SHALL default to "OpenAI" and model SHALL default to "gpt-4o"
- **AND** API key field SHALL be empty

### Requirement: API key management
The system SHALL accept an LLM provider API key via a text input and persist it to localStorage. The key SHALL NOT be displayed in plain text after initial entry.

#### Scenario: User enters an API key
- **WHEN** user types an API key into the settings input and saves
- **THEN** the key SHALL be stored in localStorage under `blm_brain_settings`
- **AND** the input SHALL display masked characters (e.g., "sk-...****") after save

#### Scenario: Missing API key on chat attempt
- **WHEN** user sends a chat message without having configured an API key
- **THEN** the brain-chat panel SHALL display a message directing the user to configure their API key in settings
- **AND** no API call SHALL be made

### Requirement: Settings persistence
The system SHALL persist brain settings (provider, model, API key, Perplexity key) to localStorage and restore them on app load.

#### Scenario: Settings survive page reload
- **WHEN** user configures brain settings and reloads the page
- **THEN** all settings SHALL be restored from localStorage automatically

#### Scenario: Corrupted settings
- **WHEN** localStorage contains invalid JSON for `blm_brain_settings`
- **THEN** the system SHALL reset to default settings and clear the corrupted entry

### Requirement: Perplexity API key
The system SHALL accept an optional Perplexity API key for enabling the research tool. When no Perplexity key is configured, the research tool SHALL be unavailable and the LLM SHALL be informed via its system prompt.

#### Scenario: Research tool with Perplexity key configured
- **WHEN** user has configured a Perplexity API key
- **THEN** the `research` tool SHALL be included in the LLM's available tools

#### Scenario: Research tool without Perplexity key
- **WHEN** user has not configured a Perplexity API key
- **THEN** the `research` tool SHALL NOT be included in the LLM's available tools
- **AND** the system prompt SHALL note that web research is unavailable
