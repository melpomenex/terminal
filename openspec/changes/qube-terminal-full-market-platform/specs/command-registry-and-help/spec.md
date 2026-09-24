# Specification: Registry-Driven Command System & Self-Documenting Help (`HELP`)

## ADDED Requirements

### Requirement: Registry-Driven Command Parser Architecture
The system SHALL replace the legacy `if-else` string matching ladder with a formal, registry-driven Command Lexer, AST Parser, and Execution Engine.

#### Scenario: Multi-token Bloomberg mnemonic command parsing
- **WHEN** the user inputs `"NVDA US Equity GP <GO>"` or `"AAPL OMON"`
- **THEN** the tokenizer SHALL extract `{ symbol: 'NVDA', venue: 'US', assetClass: 'EQUITY', mnemonic: 'GP' }`.
- **AND** the command router SHALL dispatch the command to the registered `GP` handler with the resolved `InstrumentRef`.

#### Scenario: Parameterized command validation
- **WHEN** the user inputs `"ALERT AAPL ABOVE 250"` or `"WORKSPACE SAVE my-tech"`
- **THEN** the parser SHALL validate argument schemas (e.g. valid threshold number, non-empty workspace name) using Zod schemas before execution.
- **AND** invalid commands SHALL return human-readable syntax hints and example usage.

### Requirement: Self-Documenting Interactive Help System (`HELP`)
The system SHALL generate comprehensive terminal help dynamically from the Command Registry, guaranteeing documentation parity with code.

#### Scenario: Command help reflection
- **WHEN** the user types `HELP` or `HELP OMON`
- **THEN** the Help panel SHALL render:
  - Command Mnemonic & Name (e.g. `OMON — Options Monitor & Chain`)
  - Category (`ANALYTICS`)
  - Description and argument syntax
  - Known Aliases (`OPTIONS`, `CHAIN`, `OVME`)
  - Practical Examples (`AAPL OMON`, `TSLA OMON`)
  - Associated Keyboard Shortcuts.
- **AND** clicking any example SHALL automatically execute the command in the active panel.
