# Specification: Multi-Condition Alerts & Centralized Notification Center (`ALERTS` / `NOTIF`)

## ADDED Requirements

### Requirement: Server-Side Multi-Condition Alert System (`ALERTS`)
The system SHALL provide an upgraded alert engine supporting multi-condition triggers, server-side monitoring, persistent trigger history, and multi-channel notifications.

#### Scenario: Multi-condition alert creation
- **GIVEN** `ALERTS` panel or command bar
- **WHEN** the user creates an alert
- **THEN** the system SHALL support triggers on:
  - Price threshold (Crosses Above / Crosses Below)
  - Intraday Percent Change ($\ge \pm 5\%$)
  - Volume spike / Unusual Volume ($\ge 200\%$ of 20-day ADV)
  - Implied Volatility spike
  - New SEC Filing release (e.g. 8-K or 10-Q)
  - Scheduled Earnings report date approach
  - Exchange Trading Halt.
- **AND** alerts SHALL support `ONE_SHOT` (disable after firing) or `RECURRING` modes.

### Requirement: Centralized Notification Center (`NOTIF`)
The system SHALL provide a centralized slide-out Notification Center tracking all triggered alerts, breaking news events, filings, and system announcements with unread badges.

#### Scenario: Receiving and acknowledging notifications
- **GIVEN** triggered alerts and breaking events
- **WHEN** an event occurs
- **THEN** the status bar notification bell SHALL increment its unread count badge.
- **AND** opening the Notification Center SHALL display an actionable list of events with timestamps, symbol tags, trigger values, and quick links to open the relevant panel.
- **AND** clicking "Mark All Read" or dismissing individual items SHALL update the persistent unread counter.
