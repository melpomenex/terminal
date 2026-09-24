# Implementation Tasks — Qube Terminal Full Market Platform

## Phase 0: Foundations, Canonical Types & Data Provenance Framework [Priority: P0]

- [x] Define canonical cross-asset data models in `src/lib/types/instrument.ts` (`AssetClass`, `InstrumentRef`, `Instrument`, `CanonicalIdentifiers`, `OptionDetails`, `FutureDetails`, `BondDetails`). [PARALLEL: P0-foundation]
- [x] Define data provenance and quality types in `src/lib/types/provenance.ts` (`DataProvenance`, `QualityLevel: 'LIVE' | 'DELAYED' | 'DERIVED' | 'SIMULATED' | 'STALE' | 'UNAVAILABLE'`). [PARALLEL: P0-foundation]
- [x] Define capability provider contracts in `src/lib/providers/contracts.ts` (`IQuoteProvider`, `IHistoricalBarsProvider`, `IOptionsProvider`, `IFinancialStatementsProvider`, `ITranscriptsProvider`, `INewsProvider`, `IFilingsProvider`, `IBrokerageProvider`). [PARALLEL: P0-foundation]
- [x] Implement visual `ProvenanceBadge` UI component in `src/components/ui/provenance-badge.tsx` supporting color-coded tooltips and timestamp latency indicators. [BLOCKED-BY: provenance.ts]
- [x] Implement base provider registry and fallback dispatcher in `src/lib/providers/provider-registry.ts`. [BLOCKED-BY: contracts.ts]

---

## Phase 1: Security Master, Per-Panel State, Link Groups & Command Registry [Priority: P0]

- [x] Implement `SecurityMasterResolver` in `src/lib/security-master/resolver.ts` to parse raw ticker strings, Bloomberg mnemonics, and composite symbols into canonical `InstrumentRef`. [BLOCKED-BY: instrument.ts]
- [x] Create Global Security Finder component `SecurityFinderModal` (`SECF`) in `src/components/modals/security-finder-modal.tsx` with fuzzy multi-asset search, asset-class filter pills, and keyboard navigation. [BLOCKED-BY: resolver.ts]
- [x] Implement `ALLQ` related listings view and resolver in `src/components/panels/allq-panel.tsx` to display primary, regional, ADR, and dual listings for a company. [BLOCKED-BY: resolver.ts]
- [x] Extend `PanelConfig` in `src/lib/tiling-types.ts` with `instrument?: InstrumentRef | null`, `linkGroup?: LinkGroupColor`, and `panelSettings?: Record<string, unknown>`.
- [x] Implement `LinkGroupColor` enum (`RED`, `YELLOW`, `GREEN`, `BLUE`, `MAGENTA`, `CYAN`, `UNLINKED`) and visual indicator in `src/components/tiling/panel-title-bar.tsx`.
- [x] Implement color-link broadcast event bus in `src/context/tiling-context.tsx` to propagate instrument changes across linked panes without affecting unlinked panes. [BLOCKED-BY: tiling-types.ts]
- [x] Implement Command Registry, Lexer, and AST Parser in `src/lib/commands/command-registry.ts` and `src/lib/commands/command-parser.ts`.
- [x] Connect Command Bar in `src/components/shell/command-bar.tsx` to the new command parser, with auto-complete suggestions and keyboard navigation. [BLOCKED-BY: command-registry.ts]
- [x] Implement auto-generated `HelpPanel` (`HELP`) in `src/components/panels/help-panel.tsx` reflecting command metadata, aliases, examples, and shortcuts. [BLOCKED-BY: command-registry.ts]

---

## Phase 2: Market Data Integrity, Streaming Hub & Quote Monitor v2 [Priority: P0/P1]

- [x] Implement client-side WebSocket/SSE streaming connection manager in `src/lib/streaming/stream-client.ts` with heartbeat, exponential backoff reconnect, topic multiplexing, and subscription deduplication. [PARALLEL: streaming-core]
- [x] Implement server-side streaming gateway / SSE multiplexer route in `src/app/api/v2/stream/route.ts`. [PARALLEL: streaming-core]
- [x] Audit and remove synthetic `price ± 0.01` bid/ask calculations in `src/components/panels/quote-monitor.tsx`; connect to real provider NBBO quotes with fallback labeling. [BLOCKED-BY: contracts.ts]
- [x] Upgrade Quote Monitor v2 (`QM`) in `src/components/panels/quote-monitor.tsx` with configurable columns, real bid/ask/size, VWAP, flash updates, sort/filter controls, and multi-watchlist support. [BLOCKED-BY: stream-client.ts]
- [x] Refactor Time & Sales (`TAPE`) in `src/components/panels/tape-panel.tsx` to consume real millisecond trade prints; remove PRNG `mulberry32` candle slicing in `/api/yfin/tape`; display `UNAVAILABLE` if streaming feed is missing. [BLOCKED-BY: stream-client.ts]
- [x] Refactor Level 2 Order Book (`DEPTH`) in `src/components/panels/depth-panel.tsx` to consume real market depth; remove PRNG book generator in `/api/yfin/depth`; display entitlement requirements clearly. [BLOCKED-BY: stream-client.ts]
- [x] Refactor Options Chain (`OMON`) in `src/components/panels/options-chain-panel.tsx` to eliminate mock IV formula; implement real provider IV ingestion and Black-Scholes IV solver fallback. [BLOCKED-BY: contracts.ts]

---

## Phase 3: Full Financial Research Suite (`FA`, `RATIO`, `ERN`, `EM`) [Priority: P1]

- [x] Implement standardized Financial Statements Provider in `src/lib/providers/financial-statements-provider.ts` normalizing SEC EDGAR XBRL and structured financials. [PARALLEL: financial-research]
- [x] Implement dedicated Financial Analysis Panel (`FA`) in `src/components/panels/financial-analysis-panel.tsx` with tabbed Income Statement, Balance Sheet, and Cash Flow views, annual/quarterly toggles, TTM, and YoY growth deltas. [BLOCKED-BY: financial-statements-provider.ts]
- [x] Implement Financial Ratio Analysis Panel (`RATIO`) in `src/components/panels/ratio-analysis-panel.tsx` computing Valuation, Profitability, Growth, Leverage, and Liquidity ratios with historical trends. [BLOCKED-BY: financial-statements-provider.ts]
- [x] Implement Earnings Consensus & Surprise Panel (`ERN`) in `src/components/panels/earnings-panel.tsx` showing historical EPS/Revenue actual vs. estimate, beats/misses, forward estimate revisions, and analyst momentum. [BLOCKED-BY: financial-statements-provider.ts]
- [x] Implement Earnings Matrix Panel (`EM`) in `src/components/panels/earnings-matrix-panel.tsx` combining historical annuals/quarters and forward consensus forecast columns in an expandable grid. [BLOCKED-BY: financial-statements-provider.ts]

---

## Phase 4: Transcripts, SEC Reader, News v2, IPOs & Halts [Priority: P1/P2]

- [x] Implement Structured Transcripts Provider in `src/lib/providers/transcripts-provider.ts` supporting quarter lookup, speaker metadata, and section partitioning. [PARALLEL: news-filings]
- [x] Implement Earnings Transcripts Panel (`TRAN`) in `src/components/panels/transcripts-panel.tsx` with prepared remarks, Q&A tabs, speaker role filters, keyword jumping, and AI extraction anchors. [BLOCKED-BY: transcripts-provider.ts]
- [x] Implement News v2 Provider in `src/lib/providers/news-provider.ts` supporting multi-source aggregation, category filters, and search queries. [PARALLEL: news-filings]
- [x] Implement News Feed v2 Panel (`NEWS`) in `src/components/panels/news-feed.tsx` with multi-ticker filters, watchlist linking, keyword exclusion, and in-terminal article reader modal. [BLOCKED-BY: news-provider.ts]
- [x] Implement Real-Time Breaking News Banner & Audio Alerts (`BREAKING`) in `src/components/shell/breaking-news-banner.tsx`. [BLOCKED-BY: news-provider.ts]
- [x] Implement in-terminal SEC Filing Reader (`FLNG`) in `src/components/panels/sec-filings-panel.tsx` with HTML/XBRL parser, section index navigation (Item 1A, Item 7), search, and exhibit viewer. [PARALLEL: news-filings]
- [x] Implement Market Halts Monitor Panel (`HALT`) in `src/components/panels/market-halts-panel.tsx` displaying real-time halt codes, reason decoding, and resumption times. [PARALLEL: news-filings]
- [x] Implement IPO Monitor Panel (`IPO`) in `src/components/panels/ipo-monitor-panel.tsx` tracking filed, expected, priced, and trading IPOs with offer ranges and S-1 links. [PARALLEL: news-filings]
- [x] Implement Dividend Analytics Panel (`DIV`) in `src/components/panels/dividend-analytics-panel.tsx` with payout history, dividend growth rates, payout ratios, and yield projections. [PARALLEL: news-filings]

---

## Phase 5: Persistence, Saved Workspaces, Notes & Alerts v2 [Priority: P1/P2]

- [x] Implement schema-versioned persistence manager in `src/lib/persistence/storage-manager.ts` supporting IndexedDB local caching, export/import JSON backups, and cloud database sync. [PARALLEL: persistence-core]
- [x] Implement Named Saved Workspaces service in `src/lib/workspaces/workspace-service.ts` (`WORKSPACE SAVE <name>`, `WORKSPACE LOAD <name>`, `WORKSPACE DELETE <name>`). [BLOCKED-BY: storage-manager.ts]
- [x] Implement Workspace Management Modal in `src/components/modals/workspace-modal.tsx` with layout preview thumbnails, duplication, renaming, and default setting. [BLOCKED-BY: workspace-service.ts]
- [x] Implement Rich Research Notes Panel (`NOTE`) in `src/components/panels/research-notes-panel.tsx` supporting multi-document tabs, Markdown/rich-text formatting, ticker tag associations, full-text search, and cloud autosave (preserving existing trading journal in `notes-panel.tsx`). [BLOCKED-BY: storage-manager.ts]
- [x] Implement Server-Side Alert Evaluator in `src/lib/alerts/alert-evaluator.ts` supporting multi-condition triggers (price, volume, IV, earnings date, filing release, breaking news). [BLOCKED-BY: stream-client.ts]
- [x] Implement Centralized Notification Center in `src/components/shell/notification-center.tsx` aggregating triggered alerts, breaking news, corporate filings, and system announcements. [BLOCKED-BY: alert-evaluator.ts]

---

## Phase 6: Options Valuation (`OVME`), Brokerage, AUM & Export [Priority: P2]

- [x] Implement Black-Scholes / Barone-Adesi-Whaley mathematical pricing engine and Greeks calculator in `src/lib/math/options-pricing.ts`. [PARALLEL: advanced-analytics]
- [x] Implement Options Valuation Model Evaluator Panel (`OVME`) in `src/components/panels/options-valuation-panel.tsx` with interactive parameter sliders, IV solver, Greek sensitivities, and P&L expiration graph. [BLOCKED-BY: options-pricing.ts]
- [x] Implement Read-Only Brokerage Provider abstraction in `src/lib/providers/brokerage-provider.ts` (supporting SnapTrade / Plaid aggregators). [PARALLEL: advanced-analytics]
- [x] Upgrade Portfolio Panel (`PRTU`) in `src/components/panels/portfolio-panel.tsx` with multi-account support, position lots, cost basis, unrealized/realized P&L, sector exposures, and VaR integration. [BLOCKED-BY: brokerage-provider.ts]
- [x] Implement Account / Portfolio AUM Analytics Panel in `src/components/panels/aum-panel.tsx` with historical AUM curve and asset allocation pie charts. [BLOCKED-BY: portfolio-panel.tsx]
- [x] Implement Financial Calculator Panel (`CALC`) in `src/components/panels/financial-calculator-panel.tsx` with TVM, PV, FV, NPV, IRR, and bond yield solver. [PARALLEL: advanced-analytics]
- [x] Implement Centralized Data Export Engine in `src/lib/export/export-service.ts` supporting structured CSV, JSON, and XLSX downloads across all table panels. [PARALLEL: advanced-analytics]
- [x] Create chart upgrade roadmap specification in `src/components/panels/chart-workstation/` evaluating TradingView Lightweight Charts vs. custom WebGL canvas engine with persistent drawings, Fibonacci retracements, and crosshair sync. [PARALLEL: advanced-analytics]

---

## Phase 7: AI Brain Orchestrator & Comparative Research Engine [Priority: P0/P1]

- [x] Overhaul AI Brain Tool Definitions in `src/lib/brain-tools.ts` to include:
  - Workspace tools: `open_panel`, `close_panel`, `split_panel`, `set_panel_instrument`, `set_link_group`, `load_workspace`, `save_workspace`.
  - Market tools: `get_quote`, `get_bars`, `get_options_chain`, `get_greeks`, `get_financial_statements`, `get_ratios`, `get_consensus_estimates`, `get_filings`, `get_transcripts`, `get_dividends`.
  - Research tools: `compare_instruments`, `search_transcripts`, `extract_guidance`, `summarize_filing`, `create_research_note`. [BLOCKED-BY: contracts.ts, command-registry.ts]
- [x] Update Brain System Prompt in `src/lib/brain-prompt.ts` to inject full workspace context (active panels, per-panel instruments, link groups, watchlists, selected portfolio, active filing/transcript). [BLOCKED-BY: brain-tools.ts]
- [x] Implement AI Evidence Citation System in `src/components/panels/brain-chat-panel.tsx` linking assistant assertions to source SEC filings, transcript segments, news articles, and financial statement lines. [BLOCKED-BY: brain-tools.ts]
- [x] Implement Multi-Symbol Comparative Workflow Handler (`COMPARE NVDA AMD INTC`) in `src/lib/brain/comparative-workflows.ts` enabling autonomous multi-pane orchestration, financial metric comparison, guidance contrast, and risk synthesis. [BLOCKED-BY: brain-tools.ts]
- [x] Implement strict tool execution security guardrails (read-only verification, confirmation dialogs for destructive layout resets or note deletions). [BLOCKED-BY: brain-tools.ts]

---

## Phase 8: Quality Assurance, Adversarial Testing & Performance Optimization [Priority: P0/P1]

- [x] Implement comprehensive unit test suite in `tests/unit/` covering `SecurityMasterResolver`, Black-Scholes Greeks, TVM financial math, command AST parser, link-group reducer, and storage migrations. [PARALLEL: testing-core]
- [x] Implement provider integration and fallback test suite in `tests/integration/` validating provider degradation, rate-limit recovery, and data provenance tagging. [PARALLEL: testing-core]
- [x] Implement UI test suite in `tests/ui/` covering panel dragging, split resizing, color-link synchronization, keyboard shortcuts, and modal workflows. [PARALLEL: testing-core]
- [x] Implement adversarial stress test suite in `tests/adversarial/` (handling missing prices, delisted tickers, malformed XBRL, dual listings, WebSocket disconnects, corrupted localStorage, and 1000+ item watchlists). [PARALLEL: testing-core]
- [x] Implement DOM virtualization (`@tanstack/react-virtual`) and render memoization across Quote Monitor, Options Chain, Time & Sales, and Transcript viewers to ensure steady 60 FPS performance. [PARALLEL: performance-core]
