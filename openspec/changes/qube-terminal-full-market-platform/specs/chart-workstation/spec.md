# Specification: Professional Chart Workstation & Drawing Suite

## ADDED Requirements

### Requirement: Professional Chart Workstation Architecture
The system SHALL establish a modular charting architecture preserving the lightweight custom SVG renderer while defining a formal upgrade path to a professional canvas/WebGL chart engine (e.g. TradingView Lightweight Charts or custom Canvas renderer).

#### Scenario: Chart rendering modes and scaling
- **GIVEN** a Chart panel (`GP`)
- **WHEN** the user configures the view
- **THEN** the chart SHALL support:
  - Chart Styles: `CANDLESTICK`, `OHLC BAR`, `LINE`, `AREA`, `HEIKIN-ASHI`
  - Scales: `LINEAR`, `LOGARITHMIC`, `PERCENTAGE COMPARISON`
  - Intervals: Intraday (`1m`, `5m`, `15m`, `30m`, `1h`), Daily (`1D`), Weekly (`1W`), Monthly (`1M`)
  - Session Toggles: `REGULAR_HOURS_ONLY` vs. `INCLUDE_EXTENDED_HOURS` (Pre/Post market shading).

#### Scenario: Multi-pane indicator system
- **GIVEN** Chart panel
- **WHEN** the user toggles technical indicators
- **THEN** overlay indicators (`SMA`, `EMA`, `Bollinger Bands`, `VWAP`, `Support/Resistance`) SHALL render on the primary price canvas.
- **AND** oscillator indicators (`RSI`, `MACD`, `Stochastic`, `ATR`, `OBV`) SHALL render in independent, vertically-stacked, resizable sub-panes beneath the price chart.

#### Scenario: Persistent drawing tools suite
- **GIVEN** Chart panel
- **WHEN** the user activates the drawing toolbar
- **THEN** the chart SHALL support placing and persisting:
  - Trendlines, Horizontal Support/Resistance Rays, Price Channels
  - Fibonacci Retracement Levels ($23.6\%, 38.2\%, 50.0\%, 61.8\%, 78.6\%$)
  - Text Annotations and Measurement Rulers (Price / Bar Delta).
- **AND** drawing coordinates SHALL be anchored to `{ timestamp, price }` coordinates and persisted across sessions.
