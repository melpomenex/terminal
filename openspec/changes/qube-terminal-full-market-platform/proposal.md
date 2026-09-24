# Qube Terminal — Full Market Platform, Cross-Asset Architecture, Data Integrity & AI Orchestrator

## Why

Qube Terminal has evolved into a feature-rich, high-density market exploration interface featuring 42+ specialized panels, tiling window management, technical indicators, SEC EDGAR integration, options chains, risk analytics, and an initial AI Brain co-pilot. However, the underlying codebase has reached a critical architectural inflection point where continuing to add isolated panels on top of the original prototype design introduces severe structural debt, correctness liabilities, and scalability ceilings:

1. **Global Active Symbol Bottleneck**: Terminal state is tightly coupled to a single global `symbol: string` in `terminal-context.tsx`. When a user changes tickers in one panel (e.g., investigating an option chain or SEC filing), every symbol-dependent panel across the entire workspace involuntarily refreshes to that ticker. Professional financial workflows demand multi-instrument research across linkable, independent panes (e.g., comparing AAPL chart with NVDA options, or tracking four different companies simultaneously).
2. **Ticker-String Coupling vs. Canonical Instrument Master**: Assets are identified primarily as raw uppercase ticker strings (`AAPL`, `EURUSD=X`, `^GSPC`). This makes multi-venue instruments, options contracts, futures contracts with delivery months, fixed income instruments (CUSIP/ISIN), OTC securities, dual listings, and share classes (`BRK-A` vs `BRK-B`, `GOOG` vs `GOOGL`) brittle or unrepresentable.
3. **Synthetic / Mock Market Data Liabilities**: Prototyping code contains synthetic derivations presented without provenance labeling (e.g., synthetic bid/ask generated as `price ± $0.01` in `quote-monitor.tsx`, synthetic 20-level order book generated via PRNG in `/api/yfin/depth`, Time & Sales reconstructed from 1-minute OHLCV candles in `/api/yfin/tape`, mock IV calculated from distance-to-strike in `options-chain-panel.tsx`, randomized AUM/performance in `superinvestors/holdings`, and simulated Reddit/Twitter mention counts in `/api/sentiment`). Presenting synthetic numbers as live market data violates financial integrity principles.
4. **Ad-Hoc Polling vs. Real-Time Streaming Infrastructure**: Real-time quotes, news, and monitor feeds depend on uncoordinated 30-second `setInterval` polling loops. This causes redundant HTTP requests, high battery and network consumption, stale pricing, race conditions, and an inability to support true tick-by-tick Time & Sales or Level 2 depth.
5. **Private / Undocumented API Dependencies**: Several features rely directly on undocumented `api.godelterminal.com` and `app.godelterminal.com` endpoints executed via synchronous child-process `curl` commands in `src/lib/godel.ts`. These undocumented endpoints pose severe legal, operational, and availability risks as long-term foundations and must be replaced with robust, capability-based provider abstractions.
6. **Fragmented Command Parsing**: Terminal navigation relies on a monolithic, fragile `if (bare === '...')` ladder in `terminal-context.tsx`. There is no formal tokenizer, argument parser, canonical command registry, alias resolver, or self-documenting help system.
7. **Local-Only Ephemeral State**: Workspaces, watchlists, positions, notes, and alerts reside exclusively in browser `localStorage` under `blm_*` keys. Users cannot save named workspaces, synchronize layouts across devices, maintain persistent server-monitored alerts, or recover gracefully from storage corruption.
8. **Unrealized AI Differentiation**: The AI Brain has initial tool definitions (`open_panel`, `fetch_fundamentals`, `research`), but cannot query canonical multi-period financial statements (`FA`), earnings transcripts (`TRAN`), forward estimate revisions (`ERN`), valuation matrices (`EM`), or manipulate panel link groups and multi-pane comparative layouts.

This OpenSpec proposal establishes the blueprint for evolving Qube Terminal into a professional, extensible, market-data truthful, cross-asset financial terminal with an industry-leading AI orchestration engine.

---

## What Changes

- **Canonical Instrument / Security Master Model (`PART A, C`)**: Transition from raw strings to a provider-agnostic `InstrumentRef` / `Instrument` model supporting equities, ETFs, options, futures, FX, crypto, indices, and bonds with FIGI/ISIN/CUSIP/MIC resolution and `ALLQ` multi-listing discovery.
- **Global Security Finder (`SECF`) (`PART B, AK`)**: Implement a unified, keyboard-navigable asset finder with fuzzy matching, asset-class filtering, exchange/venue breakdown, and entity search.
- **Per-Panel Context & Color-Linked Groups (`PART D, E`)**: Empower each leaf panel in the tiling tree to own its independent `instrumentRef`, while supporting 7 Bloomberg-style color link groups (`RED`, `YELLOW`, `GREEN`, `BLUE`, `MAGENTA`, `CYAN`, `UNLINKED`) for synchronized multi-pane updates.
- **Provider Abstraction Framework (`PART F, AT, AU`)**: Replace direct Yahoo/Gödel/Nasdaq calls with capability-based interfaces (`QuoteProvider`, `HistoricalBarsProvider`, `OptionsProvider`, `FinancialStatementsProvider`, `FilingsProvider`, `TranscriptProvider`, `NewsProvider`, `BrokerageProvider`) supporting fallback tiers and entitlement management.
- **Real-Time Streaming Infrastructure (`PART G`)**: Architect a WebSocket/SSE multiplexing connection manager with backoff reconnect, topic subscriptions, heartbeat monitoring, and throttled UI fan-out.
- **Market Data Provenance & Integrity (`PART H, I, J, AR, AS`)**: Eliminate all silent mock data. Implement visible, inspectable data provenance indicators (`LIVE`, `DELAYED`, `DERIVED`, `SIMULATED`, `STALE`, `UNAVAILABLE`) across all panels. Upgrade Quote Monitor (`QM`), Time & Sales (`T&S`), and Level 2 (`L2`).
- **Professional Options Suite (`PART K, L`)**: Upgrade Options Chain v2 with real implied volatility, open interest, strike ranges, and Black-Scholes Greeks (Delta, Gamma, Theta, Vega, Rho), accompanied by a dedicated Options Valuation Model Evaluator (`OVME`).
- **Full Financial Research Suite (`PART M, N, O, P, Q, T`)**: Add multi-period standardized Financial Statements (`FA` - Income Statement, Balance Sheet, Cash Flow), Ratio Analysis (`RATIO`), Forward Earnings Estimates (`ERN`), Earnings Matrix (`EM`), Earnings Call Transcripts (`TRAN`) with speaker-segmented search, and an in-terminal SEC Filing Reader (`FLNG`).
- **News, Halts, IPOs & Dividend Analytics (`PART R, S, U, V, W, X`)**: Multi-source filtered News v2, Breaking News real-time alerts, IPO Monitor (`IPO`), Exchange Halts (`HALT`), Dividend Analytics (`DIV`), and comprehensive Historical Price Data (`HP`).
- **Persistence, Workspaces & Notes (`PART Z, AA, AB, AC, AD`)**: Schema-versioned Cloud & Local persistence, Named Saved Workspaces (`WORKSPACE SAVE <name>`), Rich Research Notes (Markdown/rich-text multi-document system coexisting with the tagged trading journal), Server-Side Alerts v2, and a Centralized Notification Center.
- **Portfolio & Read-Only Brokerage (`PART AE, AF, AG`)**: Multi-account position lots, cost basis, unrealized/realized P&L, risk metrics, read-only brokerage aggregation (e.g., SnapTrade provider abstraction), and portfolio AUM tracking.
- **Financial Calculator & Export Framework (`PART AH, AI`)**: Built-in financial arithmetic and TVM/NPV/IRR calculator (`CALC`), paired with a standardized multi-format export framework (CSV, JSON, XLSX).
- **Command Registry & Self-Generating Help (`PART AP, AQ`)**: Formal command tokenizer, AST parser, alias registry, schema-validated command handlers, and an auto-generated, interactive Help system (`HELP <cmd>`).
- **AI Brain as a First-Class Terminal Orchestrator (`PART AM, AN, AO`)**: Expand the AI Brain to operate the entire terminal through structured workspace, market, and research tools with strict security boundaries, evidence citations with source provenance, and multi-symbol comparative research workflows (`COMPARE NVDA AMD INTC`).

---

## Capabilities

### New Capabilities
- `instrument-master`: Canonical cross-asset security master, identifiers (FIGI, ISIN, MIC), symbol resolution, and `ALLQ` related listings.
- `instrument-search-secf`: Global multi-asset security search engine with keyboard navigation, fuzzy matching, and metadata previews.
- `panel-context-and-linking`: Per-panel instrument state ownership, 7 color-link broadcast groups, and tiling tree serialization.
- `provider-framework`: Capability-based modular market data and fundamental data provider interfaces, fallbacks, and entitlement enforcement.
- `streaming-market-data`: WebSocket/SSE connection manager, subscription multiplexer, heartbeat monitor, and stale feed detector.
- `data-provenance-and-integrity`: Provenance labeling badges (`LIVE`, `DELAYED`, `DERIVED`, `SIMULATED`, `UNAVAILABLE`) and audit remediation of synthetic data.
- `quote-monitor-v2`: Professional quote monitor with configurable columns, real bid/ask/size, VWAP, flash updates, and watchlist backing.
- `time-and-sales`: Millisecond-precision tick feed with trade sizes, venue codes, condition flags, and block trade filters.
- `order-book-depth`: Multi-level Level 2 order book with aggregate depth, spread metrics, and provider availability guards.
- `options-analytics-v2`: Professional options chain with provider/calculated Greeks, real IV skew, term structure, and `OVME` calculator.
- `financial-analysis-fa`: Multi-period Income Statement, Balance Sheet, and Cash Flow statement panel with YoY growth and export.
- `ratio-analysis`: Comprehensive financial ratio analysis (Valuation, Profitability, Growth, Leverage, Liquidity) with historical trends.
- `earnings-and-matrix`: Historical & forward EPS/Revenue estimates (`ERN`) and combined multi-period Financial Matrix (`EM`).
- `earnings-transcripts-tran`: Structured earnings call transcript viewer with prepared remarks, Q&A, speaker filters, and AI query access.
- `news-and-breaking`: Multi-source filtered News v2, keyword inclusion/exclusion, breaking news audio/banner alerts, and clean article reader.
- `sec-filings-v2`: SEC EDGAR filing browser with integrated HTML/XBRL reader, section anchors, and document search.
- `market-monitors-ipo-halts`: Real-time exchange halt monitor (`HALT`) and IPO tracking monitor (`IPO`).
- `dividend-analytics`: Security-specific dividend history, dividend growth rates, payout ratios, and forward yield projections.
- `historical-data-hp`: Paginated historical price/volume table with custom intervals, adjusted/unadjusted prices, and stats.
- `chart-workstation`: Professional charting engine path, multi-pane indicator architecture, crosshair syncing, and drawing tools.
- `persistence-and-workspaces`: Cloud & offline persistence engine, schema migrations, and named workspace management.
- `research-notes`: Rich-text/Markdown multi-document research notes with ticker tags, full-text search, and AI thesis extraction.
- `alerts-and-notifications`: Multi-condition server-monitored alerts, recurring triggers, toast/system notifications, and Notification Center.
- `portfolio-brokerage-aum`: Position lot tracking, P&L calculations, risk integration, read-only brokerage provider, and AUM analytics.
- `financial-calculator-calc`: Interactive financial and TVM calculator with command bar integration (`CALC`).
- `export-system-v2`: Centralized structured data export service supporting CSV, JSON, and XLSX.
- `community-and-chat`: Future multi-user channel and ticker room architecture (isolated from AI Brain).
- `ai-brain-orchestrator`: AI terminal operator with comprehensive workspace, market, and comparative research tools.
- `ai-citations-provenance`: Evidence citations linking AI assertions directly to filings, transcripts, statements, and timestamps.
- `command-registry-and-help`: Registry-driven command parser, tokenization, autocomplete, and auto-generated Help system.
- `backend-and-infrastructure`: Caching layers, rate limiters, proxy routes, database persistence, and standardized error handling.
- `testing-and-performance`: Unit, integration, UI, and adversarial test suites, virtualization, and memoization guidelines.

### Modified Capabilities
- `src/lib/tiling-types.ts`: Extended `PanelConfig` with `instrumentRef?: InstrumentRef`, `linkGroup?: LinkGroupColor`, and `panelSettings?: Record<string, unknown>`.
- `src/context/terminal-context.tsx`: Refactored to delegate active symbol to panel contexts while maintaining legacy fallback compatibility.
- `src/context/tiling-context.tsx`: Updated to handle link-group propagation, workspace serialization, and per-pane state management.
- `src/lib/brain-tools.ts` & `src/lib/brain-prompt.ts`: Overhauled tool schemas to accept/operate canonical instruments, panel IDs, link groups, and deep financial datasets.

---

## Impact

- **Frontend State**: Gradual shift from singular global state to distributed panel-context state with link-group event bus; unified persistence layer replacing fragmented `localStorage` keys.
- **Panels**: All 42+ existing panels preserved; panel headers upgraded with color-link indicators and provenance badges; data sources decoupled from hardcoded endpoints.
- **Tiling Window Manager**: Enhanced layout engine supporting workspace load/save/export, panel cloning with link-state preservation, and split ratio persistence.
- **Data Providers**: Clean capability interfaces decoupling the application from private Gödel and scraped Yahoo endpoints.
- **API Routes**: Standardized `/api/v2/*` routes with server-side caching, rate limiting, and provider normalization.
- **Persistence & Database**: PostgreSQL/Prisma or SQLite/Supabase backend schema for users, workspaces, alerts, notes, portfolios, and settings, with client-side indexedDB/localStorage offline cache.
- **Command Language**: Full tokenizer and registry replacing the string matching ladder, providing auto-complete and syntax validation.
- **AI Brain**: Upgraded from simple assistant to full terminal operator capable of multi-step research, financial modeling, and layout orchestration.
- **Security & Licensing**: Sensitive API keys and credentials managed server-side or securely encrypted; clear distinction between real exchange feeds and derived metrics.
- **Testing**: End-to-end test coverage for financial math, Greeks, link-group synchronization, command parsing, and streaming reconnection.

---

## Non-Goals

1. **Trade Execution & Order Routing**: Qube is a research and analytics terminal. Order execution, broker trade routing, and regulatory broker/dealer responsibilities are strictly out of scope.
2. **Paywall / Copyright Bypassing**: The terminal will not scrape, circumvent paywalls, or redistribute copyrighted news articles or proprietary analyst research reports.
3. **Unlicensed Exchange Data Redistribution**: Qube will not redistribute raw proprietary exchange data without appropriate vendor entitlements or user-supplied credentials.
4. **Faking Market Data to Look "Professional"**: The terminal will never generate synthetic bid/ask quotes, synthetic order books, or fake time-and-sales prints to simulate live feeds. If real feeds are absent, panels will explicitly report `UNAVAILABLE` or `DERIVED`.
5. **Hard Dependency on Undocumented APIs**: Qube will not treat undocumented reverse-engineered endpoints as permanent production infrastructure.
6. **Total Monolithic Rewrite**: Existing working features will be preserved and migrated incrementally through backward-compatible adapters.

---

## Appendix: Repository Audit & Feature Migration Treatment

Based on comprehensive codebase inspection, the following table details the audited status and planned treatment for every major panel and subsystem:

| Subsystem / Panel | Current File Location | Current Implementation & Issues | Proposed Architectural Treatment | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Quote Monitor** | `src/components/panels/quote-monitor.tsx` | Polling via Yahoo API; synthetic `bid/ask` (`price ± 0.01`). | **REFACTOR**: Provider abstraction, real bid/ask/size, configurable columns, streaming updates. | P0 |
| **Security Description** | `src/components/panels/security-description.tsx` | Global symbol coupled; Yahoo/Gödel profile. | **EXTEND**: Link-group aware, canonical instrument metadata, exchange/MIC details. | P0 |
| **Chart (GP)** | `src/components/panels/chart-panel.tsx` | Custom SVG chart; global symbol; basic indicators. | **EXTEND / MIGRATE**: Per-panel symbol, link-group aware; create path to TradingView/Canvas workstation. | P0 / P2 |
| **News Feed** | `src/components/panels/news-feed.tsx` | Yahoo RSS + basic filter; global symbol. | **EXTEND**: Multi-source news provider, breaking news integration, ticker/watchlist filters. | P1 |
| **Fundamentals** | `src/components/panels/fundamentals-panel.tsx` | Scraped Yahoo key-statistics HTML via regex; fragile. | **REFACTOR**: Replace with structured `FundamentalsProvider` & multi-period data model. | P1 |
| **Financial Statements (FA)** | *New Subsystem* | Only basic metrics snapshot currently exists. | **NEW**: Dedicated multi-period Income Statement, Balance Sheet, Cash Flow panel. | P1 |
| **Ratio Analysis** | *New Subsystem* | Partial ratios in fundamentals snapshot. | **NEW**: Dedicated valuation, profitability, leverage, and liquidity analysis panel. | P1 |
| **Options Chain** | `src/components/panels/options-chain-panel.tsx` | Nasdaq options scraping; mocked IV formula (`base + dist*0.65`); fake volume hash. | **REFACTOR + REMOVE MOCK**: Real IV from provider, Black-Scholes solver fallback, Greeks, IV skew. | P0 / P1 |
| **Options Valuation (OVME)**| *New Subsystem* | Merged into options chain command alias. | **NEW**: Dedicated pricing calculator with volatility and rate sensitivity solvers. | P1 |
| **Earnings (ERN)** | `src/components/panels/earnings-panel.tsx` | Gödel private API or basic Yahoo earnings. | **EXTEND**: Provider abstraction, historical surprise, forward consensus estimates, revisions. | P1 |
| **Earnings Matrix (EM)** | *New Subsystem* | None. | **NEW**: Multi-period historical and forward consensus matrix with row/col expansion. | P1 |
| **Earnings Transcripts (TRAN)**| *New Subsystem* | None. | **NEW**: Full transcript viewer with prepared remarks, Q&A, speaker segmentation, and AI tools. | P1 |
| **SEC Filings** | `src/components/panels/sec-filings-panel.tsx` | Direct SEC EDGAR API in `sec-edgar.ts`; opens external links. | **EXTEND**: Integrated in-terminal HTML/XBRL reader, section anchors, AI citation linking. | P1 |
| **Time & Sales (TAPE)** | `src/components/panels/tape-panel.tsx` | PRNG-reconstructed synthetic trades from 1m OHLCV. | **REPLACE DATA SOURCE**: Real streaming tick feed if entitled; otherwise clearly show `UNAVAILABLE`. | P0 / P1 |
| **Market Depth (DEPTH)** | `src/components/panels/depth-panel.tsx` | PRNG-generated synthetic Level 2 order book with fake MMs. | **REPLACE DATA SOURCE**: Real L2 feed where available; otherwise show `UNAVAILABLE (Entitlement Required)`. | P0 / P1 |
| **Gamma Exposure (GEX)** | `src/components/panels/gamma-exposure-panel.tsx` | Yahoo options chain with fixed 40% vol assumption. | **EXTEND**: Derived analytics with real per-strike IV and clear `DERIVED` provenance label. | P1 |
| **Unusual Options Flow** | `src/components/panels/unusual-options-panel.tsx` | Scraped options volume/OI ratios. | **EXTEND**: Provider-backed flow detection with volume/OI threshold filters. | P1 |
| **Portfolio** | `src/components/panels/portfolio-panel.tsx` | Local manual positions; localStorage persistence. | **EXTEND**: Position lots, cost basis, risk math integration, multi-portfolio management. | P1 / P2 |
| **Brokerage Integration** | `src/app/api/godel/brokerages/route.ts` | Godel private API stubs. | **NEW**: Provider abstraction for read-only aggregators (SnapTrade, Plaid). | P2 |
| **AUM Analytics** | `src/app/api/godel/aum/global/route.ts` | Godel private API stubs. | **EXTEND**: Account/portfolio synthetic AUM tracking and historical valuation curve. | P2 |
| **Trading Notes** | `src/components/panels/notes-panel.tsx` | Single-line tagged journal in localStorage. | **KEEP + EXTEND**: Preserve tagged journal; add separate multi-document Research Notes system. | P2 |
| **Alerts System** | `src/context/terminal-context.tsx` | 30-second client-side price check against watchlist. | **REFACTOR**: Server-side persistent alert evaluator with multi-metric triggers and notification center. | P1 / P2 |
| **Notification Center** | `src/components/tiling/alert-toast.tsx` | Ephemeral toast notifications only. | **NEW**: Centralized slide-out notification center tracking alerts, breaking news, filings, and halts. | P2 |
| **Economic Calendar** | `src/components/panels/economic-calendar-panel.tsx` | Scraped economic releases. | **EXTEND**: Provider-backed macro data, country filters, consensus vs. actual. | P2 |
| **Bond Yields / Yield Curve**| `src/components/panels/bond-yields-panel.tsx` | Treasury yields snapshot. | **EXTEND**: Multi-country yield curves, 2Y/10Y spread historical tracking, FRED integration. | P2 |
| **FX Rates** | `src/components/panels/fx-rates-panel.tsx` | Yahoo FX pairs snapshot. | **EXTEND**: Cross-rates matrix, pip calculators, real-time streaming rates. | P1 / P2 |
| **Commodities** | `src/components/panels/commodity-panel.tsx` | Energy, metals, agriculture tickers. | **EXTEND**: Futures curve term structure, contract rollover metadata. | P2 |
| **Market Heatmap** | `src/components/panels/market-heatmap-panel.tsx` | S&P 500 tile map by sector. | **KEEP / EXTEND**: Configurable index backing (S&P 500, Nasdaq 100, Global), timeframes. | P2 |
| **Stock Screener** | `src/components/panels/stock-screener-panel.tsx` | Yahoo screener API. | **EXTEND**: Multi-metric filtering (valuation, growth, technicals) with CSV/JSON export. | P2 |
| **Insider Activity** | `src/components/panels/insider-activity-panel.tsx` | SEC Form 4 full-text search via `sec-edgar.ts`. | **EXTEND**: Transaction cluster detection, insider buy/sell ratio charts. | P1 / P2 |
| **Institutional Holdings** | `src/components/panels/institutional-holdings-panel.tsx`| SEC Form 13F EFTS search. | **EXTEND**: 13F parsed position tables, top holder concentration metrics. | P1 / P2 |
| **Superinvestor Tracking** | `src/components/panels/superinvestor-panel.tsx` | Hardcoded list with random performance and AUM. | **REFACTOR + REMOVE MOCK**: Real SEC 13F filings for top funds; eliminate random numbers. | P2 |
| **Social Sentiment** | `src/components/panels/social-sentiment-panel.tsx` | Simulated noise and seeded random mention counts. | **REFACTOR + REMOVE MOCK**: Real social/news sentiment API or clearly label as experimental proxy. | P2 / P3 |
| **WSB / Retail Trends** | `src/components/panels/wsb-trending-panel.tsx` | Reddit public JSON scraping with mock fallback. | **EXTEND**: Real Reddit API / sentiment pipeline with fallback provenance labeling. | P2 |
| **Fear & Greed** | `src/components/panels/fear-greed-panel.tsx` | CNN endpoint with simulated fallback. | **EXTEND**: Fallback provenance indicator; preserve 7-indicator breakdown. | P2 |
| **Market Breadth** | `src/components/panels/market-breadth-panel.tsx` | Synchronous curl loop over SP100; slow. | **REFACTOR**: Server-side batching/caching, advance/decline volume, McClellan oscillator. | P1 / P2 |
| **Market Halts (HALT)** | `src/app/api/godel/halts/route.ts` | Godel private API stub. | **NEW**: Dedicated panel using exchange halt RSS/API feeds with resumption timestamps. | P2 |
| **IPO Monitor (IPO)** | `src/app/api/godel/ipos/route.ts` | Godel private API stub. | **NEW**: Dedicated panel with IPO calendar, pricing ranges, underwriters, and S-1 links. | P2 |
| **Dividend Calendar / Analytics**| `src/components/panels/dividend-calendar-panel.tsx`| Dividend calendar snapshot. | **EXTEND**: Security-specific dividend analytics (history, growth rate, payout sustainability). | P2 |
| **Historical Data (HP)** | `src/components/panels/historical-data-table.tsx`| 1D/5D/1M table view inside chart. | **EXTEND**: Dedicated full-screen historical price/volume workstation with custom ranges and export. | P2 |
| **Financial Calculator (CALC)**| *New Subsystem* | None. | **NEW**: Built-in financial arithmetic, PV, FV, NPV, IRR, bond yield calculator. | P2 |
| **AI Brain Co-pilot** | `src/components/panels/brain-chat-panel.tsx` | Chat panel with basic tool calling. | **EXTEND HEAVILY**: First-class orchestrator with workspace, market, transcript, and comparative tools. | P0 / P1 |
| **Finance Research (Perplexity)**| `src/components/panels/finance-research-panel.tsx`| Perplexity API integration with markdown tables. | **EXTEND**: Integrate into unified AI Brain citation and research engine. | P1 |
| **Command Bar** | `src/components/shell/command-bar.tsx` | `if (bare === '...')` ladder in context. | **REFACTOR**: Formal registry-based command parser with tokenizer, autocomplete, and help. | P0 |
| **Persistence / Layouts** | `src/context/tiling-context.tsx` | LocalStorage only (`blm_*`). | **REFACTOR**: Cloud + offline persistence, schema migrations, named saved workspaces. | P1 / P2 |
| **Data Export** | `src/components/terminal-shell.tsx` | Hardcoded watchlist CSV blob generator. | **REFACTOR**: Centralized export engine for CSV, JSON, and XLSX across all panels. | P2 |
