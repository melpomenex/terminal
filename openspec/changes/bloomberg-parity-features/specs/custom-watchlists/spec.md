## ADDED Requirements

### Requirement: Create custom watchlists
The system SHALL allow users to create, edit, rename, and delete custom watchlists beyond the 3 hardcoded presets.

#### Scenario: Create new watchlist
- **WHEN** user runs `WATCHLIST CREATE TECH` in command bar or uses a context menu option
- **THEN** system creates a new empty custom watchlist named "TECH" stored in localStorage

#### Scenario: Add symbol to custom watchlist
- **WHEN** user has a custom watchlist selected and runs `ADD NVDA` or uses add button
- **THEN** symbol is added to that custom watchlist's symbol list

#### Scenario: Remove symbol from custom watchlist
- **WHEN** user right-clicks a symbol in the quote monitor for a custom watchlist and selects "Remove"
- **THEN** symbol is removed from that watchlist

#### Scenario: Rename custom watchlist
- **WHEN** user runs `WATCHLIST RENAME TECH AI` in command bar
- **THEN** custom watchlist is renamed to "AI"

#### Scenario: Delete custom watchlist
- **WHEN** user runs `WATCHLIST DELETE TECH` in command bar with confirmation
- **THEN** custom watchlist and all its symbols are removed from storage

#### Scenario: Custom watchlist appears in function keys
- **WHEN** 1+ custom watchlists exist
- **THEN** they appear as additional buttons in the function key row after INDEXES, using fn-yellow styling

#### Scenario: Custom watchlist persists
- **WHEN** custom watchlists are created, modified, or deleted
- **THEN** changes persisted to localStorage under key `blm_custom_watchlists`

#### Scenario: Switch to custom watchlist
- **WHEN** user clicks a custom watchlist function key button or runs `TECH <GO>`
- **THEN** quote monitor displays that custom watchlist's symbols; other panels update accordingly
