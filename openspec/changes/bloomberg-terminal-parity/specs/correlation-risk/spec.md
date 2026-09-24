## ADDED Requirements

### Requirement: Correlation matrix
The system SHALL display a correlation matrix heatmap for all symbols in the active watchlist or portfolio, computed from historical daily returns.

#### Scenario: Correlation matrix loads
- **WHEN** user opens the Correlation & Risk panel
- **THEN** system fetches 1-year historical daily closes for all watchlist symbols, computes pairwise Pearson correlation, and displays a color-coded matrix (blue=positive, red=negative, white=uncorrelated)

### Requirement: Risk metrics per symbol
The system SHALL compute and display risk metrics for each symbol: annualized volatility, Sharpe ratio (vs risk-free rate), beta (vs S&P 500), max drawdown, and Value at Risk (95%).

#### Scenario: Risk metrics table
- **WHEN** correlation panel is loaded
- **THEN** a table below the matrix shows each symbol with: volatility %, Sharpe ratio, beta, max drawdown %, VaR 95%

### Requirement: Rolling volatility chart
The system SHALL allow viewing a rolling 30-day volatility chart for a selected symbol.

#### Scenario: Select symbol for volatility chart
- **WHEN** user clicks a symbol in the risk metrics table
- **THEN** panel displays a line chart of 30-day rolling annualized volatility over the past year

### Requirement: Portfolio-level analytics
The system SHALL compute portfolio-level risk metrics (weighted by position size if portfolio exists, else equal-weight).

#### Scenario: Portfolio risk summary
- **WHEN** portfolio has positions loaded
- **THEN** panel shows portfolio-level: expected return, volatility, Sharpe ratio, max drawdown, and a diversification score

### Requirement: Bloomberg command integration
The system SHALL support the `RISK` command to open the Correlation & Risk panel.

#### Scenario: Command opens panel
- **WHEN** user types `RISK` in the command bar
- **THEN** Correlation & Risk panel opens in the active tiling slot
