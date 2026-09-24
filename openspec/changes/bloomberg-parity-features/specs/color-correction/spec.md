## ADDED Requirements

### Requirement: Use market-standard green/red color coding
The system SHALL display positive price changes in green and negative changes in red, following US market convention.

#### Scenario: Positive changes in green
- **WHEN** a security's price change is >= 0 (in quote monitor, security description, portfolio, FX, commodity panels)
- **THEN** the change value and percentage are displayed using CSS variable `--green` (#00b050) instead of `--amber`

#### Scenario: Negative changes in red
- **WHEN** a security's price change is < 0
- **THEN** the change value and percentage are displayed using CSS variable `--red` (#FF4400)

#### Scenario: Chart candlestick colors unchanged
- **WHEN** candlestick chart renders bullish (close >= open) vs bearish candles
- **THEN** bullish candles remain amber (#FFB000), bearish remain red (#FF4400) — this is a separate convention from the P&L color scheme

#### Scenario: Green defined in globals.css
- **WHEN** any component references the green color
- **THEN** it reads from CSS custom property `--green: #00b050` defined in `globals.css`

#### Scenario: Status bar market indicator uses green
- **WHEN** market is open
- **THEN** status bar "OPEN" text and indicator dot use `--green` color
