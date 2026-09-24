## Why

The terminal currently implements ~25% of Bloomberg Terminal features — 4 panel types (quote monitor, security description, chart, news), basic tiling window manager, and amber-on-black CRT aesthetics. The architecture is solid (binary tree tiling, React contexts, Yahoo Finance backend) but content depth is shallow: no fundamentals data, no technical indicators, no alerts, no portfolio P&L, limited command set, and several non-functional UI elements (3 of 10 function keys do nothing). This change closes the biggest feature gaps to reach functional parity with a real Bloomberg terminal for individual traders.

## What Changes

- **6 new panel types**: Fundamentals (DES), Portfolio P&L (PRTU), FX Rates (FXCV), Commodity Watchlist (CMDTY), Options Chain (OVME), Economic Calendar (ECO)
- **Technical indicators** on charts: SMA, EMA, RSI, MACD, Bollinger Bands — rendered as overlay paths on existing SVG chart
- **Chart multi-symbol comparison**: overlay 2nd/3rd security's price line on same axes
- **Price alert system**: user-defined price thresholds with toast notifications on breach
- **Custom watchlist management**: create/edit/delete watchlists beyond the 3 hardcoded presets
- **News search & filtering**: keyword filter + source toggle on news feed
- **Portfolio with quantities & cost basis**: extend from `string[]` to `{symbol, qty, cost}[]` with unrealized/realized P&L
- **CSV/Excel export**: export watchlist or chart data via Blob download
- **Historical OHLCV data table**: sortable table view alongside chart
- **Fix color coding**: proper green (`#00b050`) for positive changes instead of amber
- **Wire up dormant function keys**: EQUITY → equity screener, GOVT → bond yields, CMDTY → commodity prices, HELP → help overlay
- **Expand command bar**: `DES`, `PRTU`, `FX`, `ALERT`, `OVME`, `ECO`, `IND` commands
- **Crosshair snap-to-candle**: OHLV tooltip snaps to nearest candle instead of raw mouse Y position

## Capabilities

### New Capabilities

- `fundamentals-panel`: Company fundamentals display (P/E, market cap, EPS, dividend yield, beta, 52w high/low, shares outstanding, float) sourced from Yahoo Finance quoteSummary
- `portfolio-panel`: Portfolio tracking with per-position quantity, cost basis, market value, unrealized P&L, total portfolio P&L, and daily change
- `fx-rates-panel`: Forex pair watchlist with spot prices and changes, using Yahoo Finance currency pairs (EURUSD=X, GBPUSD=X, etc.)
- `commodity-panel`: Commodity futures tracking (GC=F gold, CL=F oil, SI=F silver, ZC=F corn, etc.)
- `options-chain-panel`: Options chain grid showing strikes, expiries, calls/puts with IV and greeks-style data from Yahoo Finance options API
- `economic-calendar-panel`: Upcoming economic events with date, time, importance, forecast vs actual values
- `technical-indicators`: Chart overlay computations (SMA, EMA, RSI, MACD, Bollinger Bands) rendered as SVG paths with optional indicator sub-pane
- `chart-comparison`: Multi-symbol price overlay on shared chart axes
- `price-alerts`: User-defined alert rules (symbol, condition, threshold) stored in localStorage, evaluated on each data refresh cycle
- `custom-watchlists`: User-created watchlists with add/remove/rename, persisted alongside presets
- `news-filtering`: Client-side news feed filtering by keyword text and source (BBC/CNBC/All)
- `data-export`: CSV generation from watchlist or chart OHLCV data, triggered via browser Blob download
- `historical-data-table`: Sortable HTML table of OHLCV timestamps/values as alternative/complement to visual chart
- `color-correction`: Proper green/red color scheme following market convention (green=up, red=down)

### Modified Capabilities

- `tiling-window-manager`: No spec-level requirement changes; new panel types integrate into existing `PanelType` union and `PanelContent` router automatically
- `command-system`: Extended command parser to recognize new function shortcuts (`DES`, `PRTU`, `FX`, `ALERT`, `OVME`, `ECO`, `IND`, comparison syntax)
- `chart-panel`: Chart component gains indicator overlay layer, comparison mode, and indicator configuration sub-header; existing candlestick/line/area modes unchanged

## Impact

- **New files**: ~15 new components (6 panels + indicators module + alerts system + export utility + data table), 4+ new API routes (fundamentals, options, FX snapshot, economic calendar), updated types/lib files
- **Modified files**: `tiling-types.ts` (extend PanelType union), `panel-content.tsx` (new switch cases), `terminal-context.tsx` (new state for alerts/portfolio/watchlists), `chart-panel.tsx` (indicator overlays), `globals.css` (green color fix), `function-keys.tsx` (wire handlers), `terminal-shell.tsx` (expanded keyboard shortcuts), `context-menu.tsx` (new panel types in menu)
- **No breaking changes**: All additions are additive; existing 4 panel types, layout persistence, and tiling behavior remain unchanged
- **Dependencies**: Zero new npm packages — all features built with existing React/Next.js stack and Yahoo Finance free tier APIs
- **Performance**: Indicators computed client-side from existing chart data (O(n) per render); negligible impact. Alert evaluation runs on existing 30s refresh cycle. News filtering is O(m) client-side string matching
