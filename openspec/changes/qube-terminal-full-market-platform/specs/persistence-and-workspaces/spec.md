# Specification: Cloud & Offline Persistence & Named Workspaces

## ADDED Requirements

### Requirement: Schema-Versioned Storage Engine
The system SHALL provide a unified, schema-versioned persistence engine managing user preferences, layouts, watchlists, positions, alerts, research notes, and AI configurations across both offline local caching (IndexedDB/localStorage) and cloud database synchronization.

#### Scenario: Schema migration and corruption recovery
- **GIVEN** legacy stored terminal state in localStorage (`blm_*` keys)
- **WHEN** the updated terminal initializes
- **THEN** the storage manager SHALL execute automated migration scripts, upgrading legacy structures to the versioned `v2` schema without data loss.
- **AND** if storage corruption is detected, it SHALL isolate the corrupted entry, load fallback defaults, and preserve a backup for recovery.

### Requirement: Named Saved Workspaces Subsystem
The system SHALL support creating, saving, renaming, duplicating, exporting, importing, and restoring named multi-pane workspaces.

#### Scenario: Saving and restoring a named workspace
- **GIVEN** a configured multi-pane layout with 6 linked panels and custom charts
- **WHEN** the user executes `WORKSPACE SAVE macro-analysis`
- **THEN** the full tiling tree, panel types, per-panel `InstrumentRef`, link groups, and chart indicator configurations SHALL be saved under the name `"macro-analysis"`.
- **AND** executing `WORKSPACE LOAD macro-analysis` (or selecting it from the Workspace modal) SHALL instantly reconstruct the exact layout.

#### Scenario: Workspace export and import
- **GIVEN** any saved workspace
- **WHEN** the user exports the workspace
- **THEN** the system SHALL produce a clean, portable `.qube.json` configuration file.
- **AND** importing a `.qube.json` file on another device SHALL validate the schema and register the workspace.
