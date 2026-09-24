## Context

The terminal is a Bloomberg Terminal clone built with Next.js 15, React 19, TypeScript, zero external UI dependencies, and Yahoo Finance as the data backend. It currently has:
- **4 panel types**: Quote Monitor, Security Description (chart metadata), Candlestick Chart, News Feed
- **Tiling window manager**: Binary tree layout with drag-resize, drag-swap, add/remove panels
- **2 React contexts**: TerminalContext (data/state) + TilingContext (layout/interaction)
- **5 API routes**: watchlist snapshot, chart OHLCV, news RSS, symbol search, article extraction
- **Amber-on-black CRT aesthetic** with JetBrains Mono font

The architecture follows a clean pattern: each new panel type is a `PanelType` union member → component in `panels/` → routed by `panel-content.tsx` switch. API routes are server-side curl wrappers to Yahoo Finance. State lives in contexts; persistence via localStorage.

## Goals / Non-Goals

**Goals:**
- Add 6 new panel types that integrate seamlessly into existing tiling system
- Add technical indicators as chart overlays using pure math on existing OHLCV data
- Implement price alerts evaluated on existing 30s refresh cycle
- Enable custom watchlist creation/editing beyond hardcoded presets
- Add portfolio tracking with P&L calculations
- Fix color coding to use proper green for positive changes
- Wire up all dormant function keys and expand command bar vocabulary
- Zero new npm dependencies — everything built with React + Yahoo Finance APIs

**Non-Goals:**
- Level 2 / order book data (not available on Yahoo free tier)
- Real-time WebSocket streaming (polling is sufficient for individual trader use)
- Authentication / multi-user (single-user terminal)
- PDF generation (external link is acceptable stopgap)
- Chat/messaging subsystem
- Mobile responsive design (terminal is desktop-only)
- Backtesting or strategy simulation

## Decisions

### D1: Panel Architecture — Extend Union Type, Not Abstract

Each new panel type extends the `PanelType` union in `tiling-types.ts` and gets a case in `panel-content.tsx`. This preserves the existing pattern with zero refactoring of the tiling engine.

**Alternative considered**: Generic "renderer" pattern where panels register themselves. Rejected because we have ~10 panel types total — a switch statement is clearer than a registry for this scale.

### D2: Technical Indicators — Client-Side Computation on Existing Data

Indicators (SMA, EMA, RSI, MACD, BB) are computed in `chart-panel.tsx` from the `close[]` array already fetched for candlestick rendering. Each indicator is a pure function `(close: number[], params?) => number[]` returning values to render as SVG `<path>` elements.

**Rationale**: No additional API calls needed. Computation is O(n) per indicator — trivial for typical chart ranges (252 points for 1Y daily). Adding indicators as overlay paths keeps the single-SVG architecture.

### D3: Price Alerts — localStorage Rules + Evaluation Loop

Alerts stored as `AlertRule[]` in localStorage. The existing 30-second `setInterval` in `TerminalProvider` that refreshes the watchlist also evaluates alerts. Breached alerts show as toast notifications (fixed-position div with auto-dismiss).

**Rationale**: Reuses existing polling infrastructure. No backend needed. Toast notifications are simple absolute-positioned divs that auto-remove after 5 seconds.

### D4: Portfolio Data Model — Structured Objects Not Strings

Current portfolio is `string[]` of symbols. New model:
```typescript
interface Position {
  id: string;
  symbol: string;
  quantity: number;
  costBasis: number;       // per-share cost
  dateAdded: string;        // ISO date
}
```
P&L = `(currentPrice - costBasis) * quantity` per position. Total portfolio P&L = sum of all positions.

**Migration**: On load, check if legacy `string[]` format exists in localStorage and convert.

### D5: Fundamentals Data — New API Route Using Yahoo quoteSummary

Yahoo Finance v8/v10 `quoteSummary` endpoint returns `summaryDetail`, `defaultKeyStatistics`, `financialData` which contain P/E, market cap, EPS, dividend yield, beta, 52w range, shares outstanding, etc. New route: `/api/yfin/fundamentals?symbol=AAPL`.

### D6: Options Chain — New API Route + Grid Layout Component

Yahoo Finance v7 `/finance/options/{symbol}` returns expiration dates + strikes with call/put Greeks-style data. UI renders as a two-sided grid: calls on left, puts on right, strikes down the center, expiries across top. This is the most complex new panel but data source exists.

### D7: Color Convention — CSS Variable Fix + Conditional Usage

Change `--green` in `globals.css` from `#FFB000` (amber duplicate) to `#00b050`. In `quote-monitor.tsx` and `security-description.tsx`, use `var(--green)` for positive changes instead of `var(--amber)`. Negative changes stay `var(--red)`.

**Note**: Bloomberg terminals can be configured for regional color conventions (US=green up, EU/Asia=red up). We hardcode US convention but make it a single CSS variable swap for future configurability.

### D8: FX & Commodities — Reuse Existing Watchlist Pattern

FX pairs use Yahoo Finance format `EURUSD=X`, `GBPUSD=X`. Commodities use futures symbols `GC=F`, `CL=F`, `SI=F`. Both reuse the exact same `QuoteMonitor` component structure but with different default symbol sets and column labels (FX shows "Rate" instead of "Last", commodities show "Contract").

Implementation: extend `QuoteMonitor` to accept an optional `displayMode` prop (`'equity' | 'fx' | 'commodity'`) that adjusts column headers and data formatting.

### D9: News Filtering — Pure Client-Side

Add a filter bar above the news list in `news-feed.tsx`: text input for keyword matching against `item.title`, and toggle buttons for source filtering. All filtering runs against the `news[]` array already in context — no re-fetching needed.

### D10: CSV Export — Blob + download attribute

Convert `WatchlistItem[]` or `ChartData` to CSV string, create `Blob`, generate `URL.createObjectURL()`, trigger download via `<a>` element with `download` attribute. Triggered from command bar (`XL <GO>`) or function key.

## Risks / Trade-offs

- [Yahoo Finance rate limiting] → Free tier has no published rate limit but may throttle at high request volume. Mitigation: share existing 30s poll cycle; batch fundamentals fetches with watchlist; cache aggressively in state.
- [Options chain rendering complexity] → Grid with 100+ cells could be slow. Mitigation: virtualize only visible strikes (show 20 OTM/ITM strikes around spot), lazy-load on panel open.
- [localStorage size limits] → Portfolio positions, alerts, custom watchlists, and layout tree all persist to localStorage (~5MB typical limit). Mitigation: prune alert history older than 30 days; compress layout tree.
- [Indicator computation on every render] → useMemo with proper dependency arrays ensures recomputation only when data changes, not on hover/move.
- [Crosshair snap accuracy] → Current implementation uses raw mouse Y. Snapping requires finding nearest candle's OHLC range — adds one binary search per mouse move event. Mitigation: debounce to 16ms (monitor refresh rate).
