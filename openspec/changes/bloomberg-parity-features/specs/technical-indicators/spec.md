## ADDED Requirements

### Requirement: Render technical indicators on chart
The system SHALL compute and render technical indicators as overlay paths on the existing SVG chart.

#### Scenario: Display Simple Moving Average (SMA)
- **WHEN** user enables SMA indicator with period N (default 20) on the chart panel
- **THEN** a line path is overlaid on the candlestick chart showing the N-period simple moving average of close prices, rendered in cyan color (#00CCCC)

#### Scenario: Display Exponential Moving Average (EMA)
- **WHEN** user enables EMA indicator with period N (default 12 or 26)
- **THEN** an EMA line path is overlaid on the chart in magenta color (#CC00CC)

#### Scenario: Display RSI (Relative Strength Index)
- **WHEN** user enables RSI indicator with period N (default 14)
- **THEN** an RSI line (0-100 scale) is rendered in a sub-pane below the main chart or as an overlay with horizontal reference lines at 30 and 70 (overbought/oversold)

#### Scenario: Display MACD
- **WHEN** user enables MACD indicator
- **THEN** three elements are rendered: MACD line (12/26 EMA difference), signal line (9-period EMA of MACD), and histogram (MACD minus signal) shown as bars below the main chart area

#### Scenario: Display Bollinger Bands
- **WHEN** user enables Bollinger Bands with period N (default 20) and standard deviation K (default 2)
- **THEN** three elements are rendered: upper band (SMA + K*std), lower band (SMA - K*std), both in amber-dim; middle SMA line in amber; bands form an envelope around price action

#### Scenario: Toggle indicators via UI buttons
- **WHEN** user clicks indicator toggle buttons in chart panel header area
- **THEN** indicator is added/removed from the chart without full re-render of other data

#### Scenario: Multiple indicators simultaneously
- **WHEN** user enables SMA(20), EMA(50), and RSI(14) at the same time
- **THEN** all three indicators are rendered on the same chart without visual overlap (RSI in sub-pane if needed)

### Requirement: Indicator computation purity
All indicator computations SHALL be pure functions `(data: number[], params?: object) => number[]` with no side effects, memoized for performance.

#### Scenario: Memoized recomputation
- **WHEN** chart data changes (new symbol or range) but indicator parameters stay the same
- **THEN** indicator values are recomputed; when only hover changes (crosshair move), indicator values are NOT recomputed (useMemo dependency on data, not hover state)
