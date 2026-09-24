## Why

The terminal currently covers core equities functionality (quotes, charts, news, fundamentals, options, earnings, analyst ratings) but is missing several major Bloomberg Terminal feature areas that professional traders rely on: fixed income/bond markets, market visualization tools, ownership/insider intelligence, SEC filing access, global market overview, and risk analytics. Adding these closes significant feature gaps and moves the terminal closer to true Bloomberg parity.

## What Changes

- Add a **Treasury Yields & Yield Curve** panel displaying US Treasury rates (2Y, 5Y, 10Y, 30Y) with a visual yield curve and historical rate chart
- Add a **Market Heatmap** panel — a treemap visualization of sector/market performance using color-coded tiles sized by market cap
- Add a **Stock Screener** panel with filters for market cap, P/E, sector, dividend yield, volume, price range, and fundamental metrics
- Add an **Insider Activity** panel showing recent insider buys/sells from SEC Form 4 filings
- Add an **Institutional Holdings** panel displaying top institutional holders, 13F filing data, and ownership changes
- Add a **SEC Filings** panel for browsing and accessing company filings (10-K, 10-Q, 8-K, proxies)
- Add a **World Markets** panel showing major global indices (Asia, Europe, Americas) with performance data
- Add a **Correlation & Risk** panel with a correlation matrix, beta calculation, Sharpe ratio, and volatility analysis for portfolio/watchlist symbols
- Add a **Social Sentiment** panel aggregating recent social media sentiment scores and trending tickers

## Capabilities

### New Capabilities
- `bond-yields`: Treasury yield curve display, historical rate chart, and spread analysis
- `market-heatmap`: Treemap visualization of market/sector performance with color-coded tiles
- `stock-screener`: Multi-criteria stock filtering with fundamental and technical filters
- `insider-activity`: Insider trading data from SEC Form 4 filings with buy/sell signals
- `institutional-holdings`: Top institutional holders, 13F ownership data, and ownership trend charts
- `sec-filings`: Company filing browser and viewer for 10-K, 10-Q, 8-K, and proxy statements
- `world-markets`: Global index overview with regional groupings and performance tracking
- `correlation-risk`: Correlation matrix, beta, Sharpe ratio, volatility, and drawdown analysis
- `social-sentiment`: Ticker sentiment aggregation with trending stocks and sentiment scores

### Modified Capabilities
_(none — all new panels are additive)_

## Impact

- **New panels**: 9 new panel types added to the tiling system
- **New API routes**: Yahoo Finance routes for treasuries/global indices; SEC EDGAR routes for filings/insider/holdings; additional Godel routes where available
- **New components**: Each panel is a new component in `src/components/panels/`
- **Updated types**: New `PanelType` values, context state extensions in `terminal-context.tsx`
- **Updated command system**: New Bloomberg-style commands (e.g., `YCRV`, `MAP`, `SCREEN`, `INSI`, `HOLD`, `FLNG`, `WEER`, `PORT <risk>`, `SENT`)
- **External APIs**: SEC EDGAR (free, rate-limited), Yahoo Finance (existing), potentially Finnhub or similar for sentiment data
- **No breaking changes**: All changes are additive
