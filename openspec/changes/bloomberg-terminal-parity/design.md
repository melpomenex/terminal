## Context

The terminal is a single-page Next.js 15 app with a custom tiling window manager, 12 existing panel types, and two data backends (Yahoo Finance via server-side curl, Godel Terminal API). All panels use inline React styles with amber-on-black terminal aesthetic. The app has a Bloomberg-style command bar for navigation and actions.

This change adds 9 new panels covering fixed income, market visualization, ownership intelligence, SEC filings, global markets, risk analytics, and sentiment — the major feature areas present in a Bloomberg Terminal that are currently missing.

## Goals / Non-Goals

**Goals:**
- Close the feature gap with Bloomberg Terminal across 9 new panel types
- Use free, publicly-available data sources (Yahoo Finance, SEC EDGAR) to avoid paid API dependencies
- Maintain the existing amber-on-black terminal aesthetic and command bar UX patterns
- Keep all data fetching server-side through API routes to avoid CORS issues
- Each panel should be independently loadable via the tiling system

**Non-Goals:**
- Real-time streaming data (WebSockets/SSE) — continue with polling refresh
- User authentication or multi-user support
- Order execution or trading functionality
- Mobile-responsive layout — this is a desktop terminal application
- Replacing existing panels or changing the tiling system architecture

## Decisions

### Data Sources

**Treasury Yields & World Markets**: Yahoo Finance chart API using existing `^TNX`, `^TYX`, `^FVX`, `^IRX` tickers for US Treasuries, and `^GSPC`, `^FTSE`, `^N225`, etc. for global indices. These are already proven to work with the existing Yahoo Finance curl approach.

**SEC Filings, Insider Activity, Institutional Holdings**: SEC EDGAR's free APIs (`efts.sec.gov/LATEST/search-index?q=...` for full-text search, `data.sec.gov/api/xbrl/companyfacts/...` for company data, `www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=...` for filings). Rate limited to 10 req/sec — requires a `User-Agent` header with contact email. No API key needed.

**Market Heatmap**: Yahoo Finance screener or Godel sector data (already has `/api/godel/sectors`) combined with market cap data from Yahoo. The treemap visualization will be built with pure SVG, matching the existing chart approach.

**Stock Screener**: Yahoo Finance's screener API (`query1.finance.yahoo.com/v1/finance/screener`) supports predefined and custom screens with fundamental/technical filters. Free and requires no auth.

**Correlation & Risk**: Computed client-side from historical price data already fetched via the existing `/api/yfin/chart/[symbol]` endpoint. Uses the existing indicator math pattern from `src/lib/indicators.ts`.

**Social Sentiment**: Finnhub's free sentiment API (`finnhub.io/api/v1/stock/social-sentiment`) provides Reddit/Twitter sentiment scores. Free tier allows 60 calls/min. Alternatively, use Yahoo Finance trending tickers.

### Panel Architecture

Each new panel follows the existing pattern:
- Component in `src/components/panels/<name>-panel.tsx`
- Panel type enum value in `src/lib/types.ts`
- Registration in `src/components/tiling/panel-content.tsx`
- Context integration in `src/context/terminal-context.tsx`
- Command bar shortcut in command parser

No new architectural patterns needed — the existing tiling system, context, and API route patterns scale well.

### SVG Treemap for Heatmap

The heatmap panel needs a treemap layout algorithm. Rather than adding a dependency, we'll implement a simple squarified treemap algorithm in pure JS (~50 lines), consistent with the project's zero-dependency SVG approach for charts.

## Risks / Trade-offs

- **SEC EDGAR rate limits (10 req/sec)** → Implement request queuing with 100ms minimum spacing between SEC API calls; cache results for 5 minutes
- **Yahoo Finance unofficial API** → Already used throughout the app; wrap in try/catch with graceful degradation showing "Data unavailable"
- **Finnhub free tier limits** → Cache sentiment data for 15 minutes; show "Upgrade for real-time sentiment" if rate limited
- **9 new panels = large surface area** → Each panel is self-contained; implement in priority order (bond yields, heatmap, screener first as highest-value)
- **SEC EDGAR data format complexity** → XBRL/JSON parsing can be brittle; stick to the simpler EDGAR full-text search API and HTML filing indexes rather than raw XBRL
