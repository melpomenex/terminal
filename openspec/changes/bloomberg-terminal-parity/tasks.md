## 1. Foundation: Types, Context, and Panel Registration

- [x] 1.1 Add new PanelType enum values (`bond-yields`, `market-heatmap`, `stock-screener`, `insider-activity`, `institutional-holdings`, `sec-filings`, `world-markets`, `correlation-risk`, `social-sentiment`) to `src/lib/types.ts`
- [x] 1.2 Register all 9 new panel types in `src/components/tiling/panel-content.tsx` with labels and component mappings
- [x] 1.3 Add command bar handlers for new commands (`YCRV`, `MAP`, `SCREEN`, `INSI`, `HOLD`, `FLNG`, `WEER`, `RISK`, `SENT`) in `src/context/terminal-context.tsx`
- [x] 1.4 Add function key button for World Markets (`WEER`) and Bond Yields (`YCRV`) to function keys row in `src/components/shell/function-keys.tsx`

## 2. Bond Yields Panel (YCRV)

- [x] 2.1 Create API route `src/app/api/yfin/treasury/route.ts` — fetch Treasury yield data for ^IRX, ^FVX, ^TNX, ^TYX and interpolate additional maturities
- [x] 2.2 Create API route `src/app/api/yfin/treasury-history/[maturity]/route.ts` — fetch historical yield data for a specific maturity
- [x] 2.3 Create `src/components/panels/bond-yields-panel.tsx` — yield curve SVG chart, spread display, maturity selector, historical toggle

## 3. Market Heatmap Panel (MAP)

- [x] 3.1 Create API route `src/app/api/yfin/screener/route.ts` — fetch S&P 500 constituent data from Yahoo Finance screener API with market cap and % change
- [x] 3.2 Create `src/lib/treemap.ts` — squarified treemap layout algorithm (pure JS, no dependencies)
- [x] 3.3 Create `src/components/panels/market-heatmap-panel.tsx` — treemap SVG with sector grouping, color scale, scope switching (S&P 500 / sectors / world), click-to-select

## 4. Stock Screener Panel (SCREEN)

- [x] 4.1 Extend `src/app/api/yfin/screener/route.ts` to support custom filter parameters (market cap range, P/E range, dividend yield range, sector, volume range, price range)
- [x] 4.2 Add preset screen definitions (Large Cap Value, High Dividend, Top Gainers, Top Losers, Most Active, Undervalued) as query presets in the API route
- [x] 4.3 Create `src/components/panels/stock-screener-panel.tsx` — filter controls, sortable results table, preset selector, right-click add to watchlist

## 5. SEC EDGAR API Infrastructure

- [x] 5.1 Create `src/lib/sec-edgar.ts` — shared SEC EDGAR API client with User-Agent header, rate limiting (100ms spacing), and response caching
- [x] 5.2 Create API route `src/app/api/sec/company-search/route.ts` — map ticker to CIK using SEC ticker lookup
- [x] 5.3 Create API route `src/app/api/sec/filings/route.ts` — fetch recent filings for a company by CIK with type filtering

## 6. Insider Activity Panel (INSI)

- [x] 6.1 Create API route `src/app/api/sec/insider/route.ts` — fetch Form 4 filings from SEC EDGAR, parse transaction details (insider, type, shares, price)
- [x] 6.2 Create `src/components/panels/insider-activity-panel.tsx` — transaction table with buy/sell color coding, aggregate sentiment summary, market-wide mode toggle

## 7. Institutional Holdings Panel (HOLD)

- [x] 7.1 Create API route `src/app/api/sec/institutional/route.ts` — fetch 13F filing data, extract top holders with share counts and quarterly changes
- [x] 7.2 Create `src/components/panels/institutional-holdings-panel.tsx` — holders table with change highlighting, ownership pie chart (SVG), trend line chart

## 8. SEC Filings Panel (FLNG)

- [x] 8.1 Extend `src/app/api/sec/filings/route.ts` to support filing type filtering and XBRL data extraction for key financials
- [x] 8.2 Create `src/components/panels/sec-filings-panel.tsx` — chronological filing list, type filter tabs, expandable detail rows with extracted metrics, external SEC.gov link

## 9. World Markets Panel (WEER)

- [x] 9.1 Create API route `src/app/api/yfin/world-indices/route.ts` — fetch quotes for 20+ global indices from Yahoo Finance
- [x] 9.2 Create `src/lib/market-hours.ts` — market status calculator (open/closed) based on exchange trading hours and timezones
- [x] 9.3 Create `src/components/panels/world-markets-panel.tsx` — regional index groups with performance colors, market status indicators, click-to-chart

## 10. Correlation & Risk Panel (RISK)

- [x] 10.1 Create `src/lib/risk-math.ts` — pure functions for: Pearson correlation matrix, annualized volatility, Sharpe ratio, beta, max drawdown, VaR (historical 95%), rolling volatility
- [x] 10.2 Create `src/components/panels/correlation-risk-panel.tsx` — correlation heatmap matrix (SVG), risk metrics table, rolling volatility chart, portfolio analytics summary

## 11. Social Sentiment Panel (SENT)

- [x] 11.1 Create API route `src/app/api/sentiment/route.ts` — fetch sentiment data from Finnhub free API (or Yahoo Finance trending as fallback), with 15-minute caching
- [x] 11.2 Create API route `src/app/api/sentiment/trending/route.ts` — fetch trending tickers with mention volume
- [x] 11.3 Create `src/components/panels/social-sentiment-panel.tsx` — sentiment score display, 7-day trend chart, source breakdown, mention volume bar chart, trending tickers sidebar

## 12. Integration Testing and Polish

- [x] 12.1 Verify all 9 new panels render correctly in the tiling manager (add/remove/split/resize)
- [x] 12.2 Verify all command bar shortcuts work (`YCRV`, `MAP`, `SCREEN`, `INSI`, `HOLD`, `FLNG`, `WEER`, `RISK`, `SENT`)
- [x] 12.3 Test error states for each panel (API failure, rate limiting, missing data) — ensure graceful degradation
- [x] 12.4 Add function key mappings for the 3 most-used new panels to the function keys bar
