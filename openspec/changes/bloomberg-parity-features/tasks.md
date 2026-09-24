## 1. Foundation & Infrastructure

- [x] 1.1 Fix color coding — update `--green` in `globals.css` to `#00b050`; update `quote-monitor.tsx` and `security-description.tsx` to use `var(--green)` for positive changes
- [x] 1.2 Extend `PanelType` union in `tiling-types.ts` with 6 new types: `'fundamentals'`, `'portfolio'`, `'fx-rates'`, `'commodity'`, `'options-chain'`, `'economic-calendar'`
- [x] 1.3 Add new cases to `panel-content.tsx` switch statement for all 6 new panel types (importing components that will be created in later steps)
- [x] 1.4 Update `context-menu.tsx` to include new panel types in the right-click "New..." menu
- [x] 1.5 Extend `TerminalContextType` interface and provider with new state: `alerts` (AlertRule[]), `customWatchlists` (CustomWatchlist[]), `portfolioPositions` (Position[]), `newsFilter` ({keyword, sources}), `comparisonSymbols` (string[])
- [x] 1.6 Add new API routes stubs: `/api/yfin/fundamentals`, `/api/yfin/options`, `/api/yfin/economic-calendar`

## 2. Company Fundamentals Panel

- [x] 2.1 Create `src/components/panels/fundamentals-panel.tsx` — key-value layout showing P/E, market cap, EPS, dividend yield, beta, 52w range, shares outstanding, float, EV, P/B, P/S, margins, ROE, revenue, FCF, D/E, current ratio
- [x] 2.2 Implement `/api/yfin/fundamentals/route.ts` using Yahoo Finance quoteSummary endpoint (`v10/finance/quoteSummary/{symbol}`) to extract fundamentals data
- [x] 2.3 Wire fundamentals panel to TerminalContext for active symbol + loading/error states

## 3. Portfolio Panel with P&L

- [x] 3.1 Define `Position` interface in types or inline: `{id, symbol, quantity, costBasis, dateAdded}`
- [x] 3.2 Create `src/components/panels/portfolio-panel.tsx` — table with Symbol, Qty, Cost Basis, Mkt Value, Unrealized P&L, P&L %, Day Chg; total row at bottom
- [x] 3.3 Implement portfolio CRUD commands in handleCommand: `ADD 100 AAPL 150` (qty symbol cost), `REMOVE AAPL`, `PORTFOLIO <GO>` opens panel
- [x] 3.4 Add `addToPortfolio(symbol, qty, cost)` and `removeFromPortfolio(id)` to TerminalContext; persist as `blm_portfolio_positions`
- [x] 3.5 Legacy migration: on mount, detect old `blm_portfolio` string[] format and convert to Position[] with qty=0, cost=0 placeholders
- [x] 3.6 Compute P&L: `(currentPrice - costBasis) * quantity` per position; sum for total; update on each watchlist refresh cycle

## 4. FX Rates Panel

- [x] 4.1 Create `src/components/panels/fx-rates-panel.tsx` — reuse QuoteMonitor pattern with displayMode='fx'; columns: Pair, Rate, Bid, Ask, Spread, Chg, Chg%
- [x] 4.2 Define default FX watchlist: EURUSD=X, GBPUSD=X, USDJPY=X, USDCAD=X, AUDUSD=X, USDCNH=X, EURGBP=X, EURJPY=X, GBPJPY=X, USDCHF
- [x] 4.3 Add `FX ADD <pair>` command and `FX <GO>` function key handler
- [x] 4.4 Persist custom FX pairs to localStorage as `blm_fx_watchlist`

## 5. Commodity Panel

- [x] 5.1 Create `src/components/panels/commodity-panel.tsx` — QuoteMonitor with displayMode='commodity'; columns: Contract, Last, Chg, Chg %, Unit
- [x] 5.2 Define default commodity list: GC=F, CL=F, SI=F, NG=F, ZC=F, ZW=F, ZS=F, HG=F, PL=F, PA=F with unit labels ($/oz, $/bbl, $/bu, $/lb, $/MMBtu)
- [x] 5.3 Wire CMDTY function key to open commodity panel; add `CMDTY <GO>` command

## 6. Options Chain Panel

- [x] 6.1 Create `src/components/panels/options-chain-panel.tsx` — grid layout: calls left, puts right, strikes center, expiries across top
- [x] 6.2 Implement `/api/yfin/options/[symbol]/route.ts` proxying Yahoo Finance v7 `/finance/options/{symbol}` returning expirations + strike data
- [x] 6.3 Implement expiration date selector (click header → filter strikes); default to nearest upcoming expiry
- [x] 6.4 Render grid cells with: last/bid/ask, volume, OI, IV%; highlight ITM/OTM visually
- [x] 6.5 Add `OVME <GO>` command to open options panel for active symbol

## 7. Economic Calendar Panel

- [x] 7.1 Create `src/components/panels/economic-calendar-panel.tsx` — table: Date, Time(ET), Currency, Event, Importance(H/M/L), Forecast, Previous, Actual
- [x] 7.2 Implement `/api/yfin/economic-calendar/route.ts` using free economic calendar API (FiscalData or similar RSS/API)
- [x] 7.3 Color-code importance: High→amber-bright, Medium→amber, Low→amber-dim
- [x] 7.4 Add currency/importance filter toggles; add `ECO <GO>` command

## 8. Technical Indicators

- [x] 8.1 Create `src/lib/indicators.ts` — pure computation functions: `sma(data, period)`, `ema(data, period)`, `rsi(data, period)`, `macd(data, fast, slow, signal)`, `bollingerBands(data, period, mult)` — all return `number[]`
- [x] 8.2 Add indicator state to chart panel: `enabledIndicators: Map<string, {type, params}>` (e.g., 'sma-20', 'ema-12')
- [x] 8.3 Add indicator toggle buttons to chart panel header area (SMA, EMA, RSI, MACD, BB); clicking toggles indicator on/off
- [x] 8.4 Render SMA/EMA as `<path>` overlay lines on main SVG (cyan/magenta colors); render RSI in sub-pane below main chart area (0-100 scale, 30/70 reference lines)
- [x] 8.5 Render MACD as: MACD line + signal line (main chart area, thin lines) + histogram (sub-pane, green/red bars)
- [x] 8.6 Render Bollinger Bands as: upper band path + lower band path + middle SMA line (main chart area, amber-dim envelope)

## 9. Chart Multi-Symbol Comparison

- [x] 9.1 Add comparisonSymbols state to chart panel context; support `GP SYM1 SYM2 <GO>` command parsing
- [x] 9.2 Fetch comparison symbol data via existing chart API route when comparison is set
- [x] 9.3 Overlay comparison close-price lines on same SVG axes (distinct colors per symbol: green dashed, blue dotted, etc.)
- [x] 9.4 Share Y-axis scale across all displayed securities (union of price ranges)

## 10. Price Alerts System

- [x] 10.1 Define `AlertRule` type: `{id, symbol, condition: 'above'|'below', threshold: number, triggered: boolean}`
- [x] 10.2 Add alerts state to TerminalContext; implement alert CRUD commands: `ALERT AAPL ABOVE 200`, `ALERT TSLA BELOW 150`, `ALERTS <GO>`, delete from list
- [x] 10.3 In existing 30s refresh cycle, evaluate all non-triggered alerts against current prices; mark breached alerts as triggered=true
- [x] 10.4 Create `src/components/tiling/alert-toast.tsx` — fixed-position notification div: shows symbol, price, threshold, direction; auto-dismisses after 5s; green bg for above-breach, red for below-breach
- [x] 10.5 Persist alerts to localStorage as `blm_alerts`; load on mount

## 11. Custom Watchlists

- [x] 11.1 Define `CustomWatchlist` type: `{id, name, symbols: string[], createdAt}`
- [x] 11.2 Implement commands: `WATCHLIST CREATE <name>`, `WATCHLIST RENAME <old> <new>`, `WATCHLIST DELETE <name>`
- [x] 11.3 When custom watchlist selected, its symbols are used for watchlist fetch (same API call); ADD/REMOVE operate on custom watchlist's symbol array
- [x] 11.4 Render custom watchlists as additional buttons in FunctionKeys row (after INDEXES, using fn-yellow styling)
- [x] 11.5 Persist custom watchlists to localStorage as `blm_custom_watchlists`

## 12. News Filtering

- [x] 12.1 Add newsFilter state to TerminalContext: `{keyword: string, sources: ('BBC'|'CNBC'|'All')[]}`
- [x] 12.2 Add filter bar to NewsFeed component: text input (placeholder "Filter...") + source toggle buttons (BBC, CNBC, All)
- [x] 12.3 Filter news items client-side: keyword match on title (case-insensitive) AND source inclusion check
- [x] 12.4 Preserve filter state during data refreshes (filter is separate from data fetching)

## 13. CSV Data Export

- [x] 13.1 Create `src/lib/csv-export.ts` utility: `exportWatchlistCSV(items)` and `exportChartCSV(symbol, data)` returning formatted CSV strings
- [x] 13.2 Implement browser download: create Blob from CSV string, generate object URL, create hidden `<a>` element with download attribute, trigger click, revoke URL
- [x] 13.3 Add `XL <GO>` command to export focused panel's data; add XL button to function key row if desired
- [x] 13.4 Filename format: `watchlist_YYYYMMDD_HHMMSS.csv` or `chart_SYMBOL_RANGE_YYYYMMDD_HHMMSS.csv`

## 14. Historical OHLCV Data Table

- [x] 14.1 Create sortable table component (or mode within chart panel): columns Date, Open, High, Low, Close, Volume
- [x] 14.2 Sort functionality: click column header → toggle asc/desc; default sort by Date desc
- [x] 14.3 Table uses terminal styling: monospace font, green/red for values, right-aligned numbers, amber-on-black cells
- [x] 14.4 Toggle between chart view and table view via button in chart panel header

## 15. Command Bar & Keyboard Expansion

- [x] 15.1 Expand handleCommand in TerminalContext: add `DES`→open fundamentals, `PRTU`→open portfolio, `FX`→open FX, `ALERT`/`ALERTS`→alert management, `OVME`→open options, `ECO`→open econ calendar, `IND`→toggle indicators, `XL`→export, `WATCHLIST CREATE/RENAME/DELETE`→custom WL mgmt
- [x] 15.2 Expand keyboard shortcuts: wire EQUITY/GOVT/CMDTY keys; add `Ctrl+Shift+A` for new alert; `Ctrl+E` for export
- [x] 15.3 Implement comparison command parser: `GP MSFT` (single), `GP AAPL MSFT` (multi-symbol overlay)
- [x] 15.4 Fix vestigial page commands (NEWS, GP, MON, HELP) to open corresponding panels instead of setting unused page state

## 16. Crosshair & Polish

- [x] 16.1 Snap crosshair OHLV tooltip to nearest candle's actual OHLC values instead of raw mouse Y position (binary search on candle X position)
- [x] 16.2 Ensure all new panels have proper loading/error/empty states matching existing panel patterns
- [x] 16.3 Verify tiling manager renders all new panel types correctly with title bars, resize handles, close buttons, drag-drop
- [x] 16.4 Full integration test: start dev server, verify all 10 panel types render, test resize/drag/add/remove on mixed layouts, test all new commands
