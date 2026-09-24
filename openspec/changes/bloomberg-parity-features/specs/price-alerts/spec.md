## ADDED Requirements

### Requirement: Create and manage price alerts
The system SHALL allow users to define price alert rules that trigger notifications when breached.

#### Scenario: Create price alert above current
- **WHEN** user runs `ALERT AAPL ABOVE 200` in command bar
- **THEN** system creates an alert rule {id, symbol: "AAPL", condition: "above", threshold: 200} and stores it in localStorage

#### Scenario: Create price alert below current
- **WHEN** user runs `ALERT TSLA BELOW 150` in command bar
- **THEN** system creates alert rule {id, symbol: "TSLA", condition: "below", threshold: 150}

#### Scenario: Alert triggers on price breach
- **WHEN** watchlist refresh cycle runs (every 30s) and a symbol's current price crosses its alert threshold
- **THEN** a toast notification appears showing: symbol name, current price, threshold, direction of breach ("BREACHED $200" / "FELL BELOW $150"), with green background for bullish breaches, red for bearish

#### Scenario: Auto-dismiss notification
- **WHEN** an alert toast notification appears
- **THEN** it auto-dismisses after 5 seconds unless user hovers over it

#### Scenario: List active alerts
- **WHEN** user runs `ALERTS <GO>` in command bar
- **THEN** system shows a list of all active alert rules with option to delete each

#### Scenario: Delete alert
- **WHEN** user deletes an alert from the alerts list
- **THEN** alert rule is removed from localStorage and will no longer trigger

#### Scenario: Alert persists across sessions
- **WHEN** alerts are created, modified, or deleted
- **THEN** changes are persisted to localStorage under key `blm_alerts`
