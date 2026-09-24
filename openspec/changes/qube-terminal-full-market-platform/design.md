# Qube Terminal Full Market Platform — System Architecture & Design

## 1. Executive Summary & Architectural Vision

Qube Terminal is evolving from a browser-based prototype with hardwired ticker strings and client-side polling into a professional, multi-pane, market-data truthful, cross-asset terminal with an AI-native operating brain.

The target architecture is guided by five foundational tenets:
1. **Canonical Cross-Asset Identity**: Every asset, contract, rate, commodity, bond, and index has a precise, provider-agnostic canonical identity (`InstrumentRef`) resolved through a multi-tier Security Master.
2. **Decoupled, Linkable Panel Contexts**: Panels own their active instrument state independently, coordinated dynamically via Bloomberg-style color link groups (`RED`, `YELLOW`, `GREEN`, `BLUE`, `MAGENTA`, `CYAN`, `UNLINKED`).
3. **Uncompromising Market Data Integrity**: Data provenance (`LIVE`, `DELAYED`, `DERIVED`, `SIMULATED`, `STALE`, `UNAVAILABLE`) is first-class, strictly labeled, and inspectable. Synthetic prices, fake Level 2 books, and simulated tapes are eliminated or relegated to explicitly marked demo sandboxes.
4. **Resilient Provider Abstraction & Streaming Multiplexing**: Market data consumers program against capability interfaces (`QuoteProvider`, `FinancialStatementsProvider`, `TranscriptProvider`, etc.), backed by a resilient WebSocket/SSE multiplexer and intelligent caching layer.
5. **AI-Native Terminal Operability**: The AI Brain is not an external chatbot; it is an integrated terminal orchestrator with structured tools to manipulate layouts, inspect multi-period financial models, analyze transcripts, compare peer companies, and cite concrete evidence.

---

## 2. Current Architecture Assessment

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             CURRENT ARCHITECTURE                           │
│                                                                            │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                        TerminalContext                             │   │
│   │   symbol: string ("AAPL") [SINGLE GLOBAL ACTIVE SYMBOL]            │   │
│   │   watchlist: WatchlistItem[] (30s setInterval polling)             │   │
│   │   alerts: AlertRule[] (Client-side 30s check in localStorage)      │   │
│   │   portfolio: Position[] (localStorage "blm_portfolio_positions")   │   │
│   │   command: string (Handled by 40+ if-else string ladder)           │   │
│   └──────────────────────────────────┬─────────────────────────────────┘   │
│                                      │                                     │
│            ┌─────────────────────────┴────────────────────────┐            │
│            ▼                                                  ▼            │
│   ┌───────────────────┐                              ┌───────────────────┐ │
│   │   TilingContext   │                              │   42+ UI Panels   │ │
│   │   layout: Tree    │                              │   All read single │ │
│   │   activePanelId   │                              │   global symbol   │ │
│   └────────┬──────────┘                              └─────────┬─────────┘ │
│            │                                                   │           │
│            ▼                                                   ▼           │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                        Ad-Hoc API Layer                            │   │
│   │   /api/yfin/* (Scraped HTML regex, curl child-processes)           │   │
│   │   /api/godel/* (Undocumented private endpoints via curl)           │   │
│   │   /api/sec/* (Direct SEC EDGAR curl calls)                         │   │
│   │   [Synthetic Data: mock IV, synthetic bid/ask, PRNG tape & L2]     │   │
│   └────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Identified Architectural Deficiencies:
- **Global Symbol Coupling**: Changing the ticker in one pane forces all other panes in the workspace to change simultaneously.
- **Yahoo String Coupling**: Asset resolution is hardcoded to Yahoo ticker conventions (`AAPL`, `EURUSD=X`), breaking options OSI symbology, bond CUSIPs, and futures contracts.
- **Silent Mock Data**: `quote-monitor.tsx` computes synthetic bids (`price - 0.01`) and asks (`price + 0.01`); `options-chain-panel.tsx` calculates mock IV (`18.4 + dist * 0.65`); `/api/yfin/tape` generates synthetic trades from 1m candles; `/api/yfin/depth` synthesizes 20 book levels with fake market makers (`JPM`, `GS`, `MS`).
- **Synchronous Child-Process Executions**: Backend routes execute `curl` via `node:child_process.execSync`, causing thread blocking under load.
- **Unstructured Command Bar**: Command handling is a 150-line `if (bare === ...)` sequence in `terminal-context.tsx`.

---

## 3. Target Architecture & Layering

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TARGET ARCHITECTURE                                       │
│                                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              PRESENTATION & TILING LAYER                             │   │
│   │                                                                                      │   │
│   │   ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐ │   │
│   │   │ Leaf Panel A           │  │ Leaf Panel B           │  │ Leaf Panel C           │ │   │
│   │   │ - Type: 'chart'        │  │ - Type: 'options'      │  │ - Type: 'news'         │ │   │
│   │   │ - Instrument: AAPL:US  │  │ - Instrument: AAPL:US  │  │ - Instrument: NVDA:US  │ │   │
│   │   │ - Link: GREEN          │  │ - Link: GREEN          │  │ - Link: BLUE           │ │   │
│   │   │ - Provenance: LIVE     │  │ - Provenance: DELAYED  │  │ - Provenance: LIVE     │ │   │
│   │   └────────────────────────┘  └────────────────────────┘  └────────────────────────┘ │   │
│   └──────────────────────────────────────────┬───────────────────────────────────────────┘   │
│                                              │                                               │
│   ┌──────────────────────────────────────────┴───────────────────────────────────────────┐   │
│   │                              TERMINAL RUNTIME BUS LAYER                              │   │
│   │                                                                                      │   │
│   │   ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐ │   │
│   │   │ Link Group Event Bus   │  │ Command Registry & AST │  │ AI Terminal Engine     │ │   │
│   │   │ Color-group broadcast  │  │ Tokenizer, Autocomplete│  │ Multi-tool Orchestrator│ │   │
│   │   │ & panel synchronization│  │ & Help Reflection      │  │ & Provenance Citations │ │   │
│   │   └────────────────────────┘  └────────────────────────┘  └────────────────────────┘ │   │
│   │   ┌────────────────────────────────────────────────────────────────────────────────┐ │   │
│   │   │ Security Master Cache & Client Instrument Resolver                             │ │   │
│   │   └────────────────────────────────────────────────────────────────────────────────┘ │   │
│   └──────────────────────────────────────────┬───────────────────────────────────────────┘   │
│                                              │                                               │
│   ┌──────────────────────────────────────────┴───────────────────────────────────────────┐   │
│   │                             CLIENT DATA & STREAMING LAYER                            │   │
│   │                                                                                      │   │
│   │   ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐ │   │
│   │   │ Streaming Multiplexer  │  │ Normalized Data Cache  │  │ Offline/Cloud Sync     │ │   │
│   │   │ WebSocket / SSE client │  │ Stale-while-revalidate │  │ IndexedDB / LocalStorage│ │   │
│   │   │ Heartbeat & Backoff    │  │ Deduplication & Throttling│ Schema Migrations     │ │   │
│   │   └────────────────────────┘  └────────────────────────┘  └────────────────────────┘ │   │
│   └──────────────────────────────────────────┬───────────────────────────────────────────┘   │
│                                              │                                               │
│ ═════════════════════════════════════════════╪══════════════════════════════════════════════ │
│                                  NETWORK / SERVER BOUNDARY                                   │
│ ═════════════════════════════════════════════╪══════════════════════════════════════════════ │
│                                              │                                               │
│   ┌──────────────────────────────────────────┴───────────────────────────────────────────┐   │
│   │                           SERVER ADAPTER & BACKEND SERVICES                          │   │
│   │                                                                                      │   │
│   │   ┌────────────────────────────────────────────────────────────────────────────────┐ │   │
│   │   │ Standardized API Gateway (/api/v2/*) + WebSocket Streaming Hub                 │ │   │
│   │   └──────────────────────────────────────┬─────────────────────────────────────────┘ │   │
│   │                                          │                                           │   │
│   │   ┌──────────────────────────────────────┴─────────────────────────────────────────┐ │   │
│   │   │ Modular Capability Provider Framework                                          │ │   │
│   │   │ - InstrumentSearchProvider       - TradeTapeProvider                           │ │   │
│   │   │ - QuoteProvider (Live/Delayed)   - OrderBookProvider (L2)                      │ │   │
│   │   │ - HistoricalBarsProvider         - OptionsChainProvider + Greeks Calculator    │ │   │
│   │   │ - FinancialStatementsProvider    - FilingsProvider (SEC EDGAR)                 │ │   │
│   │   │ - EarningsEstimatesProvider      - TranscriptProvider                          │ │   │
│   │   │ - NewsProvider (Multi-source)    - BrokerageProvider (SnapTrade/Read-only)     │ │   │
│   │   └──────────────────────────────────────┬─────────────────────────────────────────┘ │   │
│   │                                          │                                           │   │
│   │   ┌──────────────────────────────────────┴─────────────────────────────────────────┐ │   │
│   │   │ Server-side Cache (Redis/In-Memory) + Rate Limiters + Entitlement Manager      │ │   │
│   │   └──────────────────────────────────────┬─────────────────────────────────────────┘ │   │
│   │                                          │                                           │   │
│   │   ┌──────────────────────────────────────┴─────────────────────────────────────────┐ │   │
│   │   │ Persistent Storage (PostgreSQL / SQLite / Supabase): Workspaces, Alerts, Notes │ │   │
│   │   └────────────────────────────────────────────────────────────────────────────────┘ │   │
│   └──────────────────────────────────────────┬───────────────────────────────────────────┘   │
│                                              │                                               │
│   ┌──────────────────────────────────────────┴───────────────────────────────────────────┐   │
│   │                             EXTERNAL DATA SOURCES & APIS                             │   │
│   │                                                                                      │   │
│   │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │   │
│   │   │ Market Data APIs │  │ SEC EDGAR        │  │ Macro / Treasury │  │ LLM APIs     │ │   │
│   │   │ Polygon / Finnhub│  │ Company Facts    │  │ FRED / BLS / BEA │  │ Anthropic    │ │   │
│   │   │ Massive / Tiingo │  │ Submissions      │  │ Yield Curves     │  │ OpenAI       │ │   │
│   │   │ TwelveData / FMP │  │ Form 4 / 13F-HR  │  │ Economic Calendar│  │ Perplexity   │ │   │
│   │   └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘ │   │
│   └──────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Canonical Cross-Asset Instrument Model

### 4.1 Data Structures & TypeScript Schema
The canonical security master models every tradeable and observable financial instrument:

```typescript
export type AssetClass =
  | 'EQUITY'
  | 'ETF'
  | 'MUTUAL_FUND'
  | 'INDEX'
  | 'OPTION'
  | 'FUTURE'
  | 'FUTURE_OPTION'
  | 'FX'
  | 'CRYPTO'
  | 'BOND_GOVT'
  | 'BOND_CORP'
  | 'COMMODITY'
  | 'ECONOMIC_INDICATOR';

export type OptionType = 'CALL' | 'PUT';
export type SettlementType = 'PHYSICAL' | 'CASH';

export interface CanonicalIdentifiers {
  figi?: string;             // Financial Instrument Global Identifier
  compositeFigi?: string;    // Composite FIGI for equity
  isin?: string;             // International Securities Identification Number
  cusip?: string;            // Committee on Uniform Securities Identification Procedures
  sedol?: string;            // Stock Exchange Daily Official List
  ticker: string;            // Canonical root symbol (e.g. "AAPL", "SPX")
  displaySymbol: string;     // Formatted terminal display (e.g. "AAPL US Equity")
  mic: string;               // ISO 10383 Market Identifier Code (e.g. "XNAS", "XNYS")
  currency: string;          // ISO 4217 Currency Code (e.g. "USD", "EUR")
  country: string;           // ISO 3166-1 alpha-2 (e.g. "US", "DE")
}

export interface OptionDetails {
  underlyingInstrumentId: string;
  strikePrice: number;
  expirationDate: string;    // ISO YYYY-MM-DD
  optionType: OptionType;
  contractMultiplier: number; // Standard: 100
  settlementType: SettlementType;
  exerciseStyle: 'AMERICAN' | 'EUROPEAN';
  osiSymbol: string;         // Options Symbology Initiative format (e.g. "AAPL  260515C00200000")
}

export interface FutureDetails {
  underlyingSymbol: string;
  contractMonth: string;     // e.g. "2026-12"
  contractYear: number;
  expirationDate: string;
  contractSize: number;
  tickSize: number;
  settlementCurrency: string;
}

export interface BondDetails {
  issuerName: string;
  couponRate: number;        // e.g. 4.25 for 4.25%
  maturityDate: string;
  yieldToMaturity?: number;
  rating?: string;           // e.g. "Aaa", "BBB+"
}

export interface Instrument {
  id: string;                // Global Unique ID: "EQUITY:XNAS:AAPL" or "OPTION:OCC:AAPL260515C00200000"
  assetClass: AssetClass;
  name: string;              // "Apple Inc."
  description?: string;
  identifiers: CanonicalIdentifiers;
  primaryExchange: string;
  timezone: string;          // "America/New_York"
  tradingHours: {
    regularStart: string;    // "09:30"
    regularEnd: string;      // "16:00"
    hasPreMarket: boolean;
    hasPostMarket: boolean;
  };
  sector?: string;
  industry?: string;
  active: boolean;
  
  // Specific instrument sub-type payloads
  optionDetails?: OptionDetails;
  futureDetails?: FutureDetails;
  bondDetails?: BondDetails;
  
  // Cross-listing relationships
  primaryInstrumentId?: string;
  alternateListingIds?: string[];
  shareClasses?: string[];   // ["GOOG", "GOOGL"] or ["BRK.A", "BRK.B"]
  
  // Provider Mapping Metadata
  providerMappings: Record<string, string>; // { "yahoo": "AAPL", "finnhub": "AAPL", "polygon": "AAPL" }
}

export interface InstrumentRef {
  id: string;
  symbol: string;
  displaySymbol: string;
  assetClass: AssetClass;
  name?: string;
  exchange?: string;
}
```

### 4.2 Instrument Resolution Engine (`SecurityMasterResolver`)
The resolver translates user input into canonical `InstrumentRef` structures:
- `AAPL` -> `{ id: "EQUITY:XNAS:AAPL", symbol: "AAPL", assetClass: "EQUITY" }`
- `AAPL US Equity` -> `{ id: "EQUITY:XNAS:AAPL", symbol: "AAPL", assetClass: "EQUITY" }`
- `AAPL 260515 C 200` -> Resolves to canonical option instrument `OPTION:OCC:AAPL260515C00200000`
- `EURUSD` / `EUR/USD` -> `{ id: "FX:GEN:EURUSD", symbol: "EURUSD", assetClass: "FX" }`
- `US10Y` -> `{ id: "BOND_GOVT:US:10Y", symbol: "US10Y", assetClass: "BOND_GOVT" }`

---

## 5. Panel Context & Color-Link Graph Architecture

### 5.1 Panel Config Extension
`src/lib/tiling-types.ts` is extended so that every panel leaf maintains independent context:

```typescript
export type LinkGroupColor =
  | 'RED'
  | 'YELLOW'
  | 'GREEN'
  | 'BLUE'
  | 'MAGENTA'
  | 'CYAN'
  | 'UNLINKED';

export interface PanelConfig {
  id: string;
  type: PanelType;
  label: string;
  instrument?: InstrumentRef | null;  // Per-panel active instrument
  linkGroup?: LinkGroupColor;         // Color-link coordination group
  panelSettings?: Record<string, unknown>; // Panel-specific local configuration
}
```

### 5.2 Color-Link Propagation Event Bus
```typescript
export interface LinkGroupChangeEvent {
  linkGroup: LinkGroupColor;
  instrument: InstrumentRef;
  sourcePanelId: string;
}

// In tiling context:
// When Panel A (LinkGroup GREEN) updates its instrument:
// 1. Panel A updates its local config.instrument.
// 2. Event bus broadcasts LinkGroupChangeEvent to all nodes in the tiling tree.
// 3. Every leaf panel with linkGroup === 'GREEN' (except source) updates its local instrument and triggers fetch.
// 4. Panels with linkGroup === 'UNLINKED' or other colors remain unchanged.
```

### 5.3 Backward-Compatible Migration
Existing panels continue to function seamlessly:
- Panels read `panel.instrument ?? context.fallbackInstrument`.
- If `panel.instrument` is undefined, it defaults to the terminal global instrument until explicitly assigned or linked.

---

## 6. Provider Abstraction Framework & Capability Interfaces

Direct calls to `curl` and ad-hoc Yahoo/Gödel endpoints are encapsulated behind standardized server-side interfaces:

```typescript
export interface DataProvenance {
  sourceProvider: string;     // e.g. "Polygon", "SEC-EDGAR", "Nasdaq", "TwelveData"
  retrievalTimestamp: string; // ISO 8601
  exchangeTimestamp?: string; // ISO 8601 exchange print time
  quality: 'LIVE' | 'DELAYED' | 'DERIVED' | 'SIMULATED' | 'STALE' | 'UNAVAILABLE';
  delayMinutes?: number;
  entitlementRequired?: string;
  currency: string;
}

export interface QuoteResult {
  instrument: InstrumentRef;
  lastPrice: number;
  lastSize?: number;
  change: number;
  changePercent: number;
  bid?: number;
  bidSize?: number;
  ask?: number;
  askSize?: number;
  volume: number;
  vwap?: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  high52w?: number;
  low52w?: number;
  marketCap?: number;
  provenance: DataProvenance;
}

export interface IQuoteProvider {
  getQuote(instrument: InstrumentRef): Promise<QuoteResult>;
  getQuotes(instruments: InstrumentRef[]): Promise<QuoteResult[]>;
}

export interface IHistoricalBarsProvider {
  getBars(
    instrument: InstrumentRef,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1mo',
    from: number,
    to: number,
    adjusted?: boolean
  ): Promise<{ bars: Bar[]; provenance: DataProvenance }>;
}

export interface IOptionsProvider {
  getOptionsChain(
    instrument: InstrumentRef,
    expiration?: string,
    strikesRange?: { min?: number; max?: number }
  ): Promise<{ expirations: string[]; strikes: OptionStrikeRow[]; provenance: DataProvenance }>;
}

export interface IFinancialStatementsProvider {
  getStatements(
    instrument: InstrumentRef,
    statementType: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW',
    period: 'ANNUAL' | 'QUARTERLY' | 'TTM',
    limit?: number
  ): Promise<{ statements: StandardizedStatement[]; provenance: DataProvenance }>;
}

export interface ITranscriptsProvider {
  getTranscriptsList(instrument: InstrumentRef): Promise<TranscriptMetadata[]>;
  getTranscript(transcriptId: string): Promise<StructuredTranscript>;
}

export interface INewsProvider {
  getNews(query: NewsQuery): Promise<{ items: NewsArticle[]; total: number; provenance: DataProvenance }>;
}

export interface IFilingsProvider {
  getFilings(instrument: InstrumentRef, forms?: string[]): Promise<FilingSummary[]>;
  getFilingDocument(accessionNumber: string, primaryDoc: string): Promise<FilingDocument>;
}
```

### 6.1 Provider Fallback Resolution Pipeline
When a request arrives at `/api/v2/quotes`:
1. Check Primary Configured Provider (e.g. Polygon / Alpaca / User API Key).
2. If healthy and entitled: Return `quality: 'LIVE'`.
3. If rate-limited or unavailable: Fallback to Secondary Provider (e.g. Finnhub / Twelve Data) -> Return `quality: 'DELAYED'`.
4. If all upstream providers fail: Return cached data with `quality: 'STALE'`.
5. If no data exists: Return structured response with `quality: 'UNAVAILABLE'`.

---

## 7. Real-Time Streaming & WebSocket Multiplexer

```typescript
export type StreamChannel =
  | { topic: 'quotes'; symbol: string }
  | { topic: 'trades'; symbol: string }
  | { topic: 'depth'; symbol: string }
  | { topic: 'options'; symbol: string; expiration: string }
  | { topic: 'breaking_news' }
  | { topic: 'halts' };

export class MarketDataStreamClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(data: any) => void>>();
  private reconnectAttempts = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isStale = false;
  
  public subscribe(channel: StreamChannel, callback: (data: any) => void): () => void {
    const key = JSON.stringify(channel);
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.sendSubscription(channel, 'SUBSCRIBE');
    }
    this.subscriptions.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(key);
          this.sendSubscription(channel, 'UNSUBSCRIBE');
        }
      }
    };
  }
}
```

---

## 8. Data Provenance & Synthetic Data Remediation Plan

### 8.1 Provenance Badge Visual Standards
Every panel title bar and data table footer will display a standardized provenance pill:
- `● LIVE` (Green `#00b050`): Real-time exchange-entitled data.
- `● DELAYED (15m)` (Amber `#ffb000`): Exchange-delayed public quote feed.
- `● DERIVED` (Cyan `#00ccff`): Computed analytics (Greeks, VaR, correlations, technical indicators).
- `● SIMULATED` (Magenta `#ff00ff`): Backtesting simulations or demo sandbox.
- `● STALE` (Dark Orange `#ff6600`): Cached data due to temporary network or provider loss.
- `● UNAVAILABLE` (Red `#ef4444`): Feature requires entitlement or provider is currently down.

### 8.2 Synthetic Data Audit & Migration Action Matrix

| Target Feature | Current Synthetic Implementation | Remediation Action | Final State |
| :--- | :--- | :--- | :--- |
| **Quote Monitor Bid/Ask** | `price ± 0.01` formula | Replace with real NBBO from provider | Show actual provider bid/ask/size, or "---" if quote-only |
| **Options Chain IV** | `18.4 + dist * 0.65` formula | Calculate real IV via Black-Scholes solver from actual bid/ask | Provider IV or exact numerical BS solver; labeled `DERIVED` |
| **Options Volume** | String hash randomized formula | Read real exchange contract volume | Real contract volume from provider |
| **Time & Sales (Tape)** | PRNG `mulberry32` from 1m OHLCV | Connect to streaming trade tick feed | Real millisecond tick feed; if no stream, show `UNAVAILABLE` |
| **Level 2 Depth** | PRNG book levels & fake MMs (`JPM`, `GS`) | Connect to real L2/L3 order book | Real market depth; if unentitled, show `ENTITLEMENT REQUIRED` |
| **Superinvestors** | Hardcoded funds + random AUM/return | Parse real SEC Form 13F-HR filings | Real 13F portfolio holdings and historical position changes |
| **Social Sentiment** | Seeded random mention numbers | Connect to Reddit/StockTwits API or news NLP | Real mention volume or clearly mark as `EXPERIMENTAL PROXY` |
| **Fear & Greed Fallback** | Random noise generator in fallback | Cache last valid CNN index or FRED proxy | Display cached value with `STALE` provenance badge |

---

## 9. Full Financial Research Suite

### 9.1 Financial Statements (`FA`)
Dedicated panel with tabbed navigation:
- **Income Statement**: Revenue, Cost of Goods Sold, Gross Profit, Operating Expenses (R&D, SG&A), Operating Income (EBIT), Interest Expense, Pretax Income, Tax Expense, Net Income, Shares Outstanding, Basic/Diluted EPS.
- **Balance Sheet**: Cash & Equivalents, Short-Term Investments, Accounts Receivable, Inventory, Total Current Assets, Property Plant & Equipment, Goodwill & Intangibles, Total Assets, Current Liabilities, Short-Term Debt, Accounts Payable, Total Current Liabilities, Long-Term Debt, Total Liabilities, Common Stock, Retained Earnings, Total Shareholder Equity.
- **Cash Flow**: Cash from Operations, Capital Expenditures, Free Cash Flow, Cash from Investing, Acquisitions, Cash from Financing, Debt Issuance/Repayment, Share Repurchases, Dividends Paid, Net Change in Cash.
- **Features**: Annual vs. Quarterly toggle, TTM calculation, Multi-column period comparison (up to 5 years / 8 quarters), YoY growth % delta, Common-size analysis (% of Revenue or % of Assets).

### 9.2 Financial Ratio Analysis (`RATIO`)
- **Valuation**: P/E, Forward P/E, PEG, EV/Sales, EV/EBITDA, P/B, Price/FCF, Dividend Yield.
- **Profitability**: Gross Margin, Operating Margin, Net Margin, Return on Equity (ROE), Return on Assets (ROA), Return on Invested Capital (ROIC).
- **Growth**: 1Y / 3Y / 5Y Revenue CAGR, EPS CAGR, EBITDA Growth.
- **Leverage & Solvency**: Debt/Equity, Debt/EBITDA, Net Debt/EBITDA, Interest Coverage Ratio.
- **Liquidity**: Current Ratio, Quick Ratio, Cash Ratio.

### 9.3 Forward Earnings & Earnings Matrix (`ERN`, `EM`)
- **Consensus Estimates (`ERN`)**: Mean, High, Low EPS and Revenue estimates across Next Quarter, Current Year, and Next Year; Analyst revision momentum (upgrades vs downgrades in last 30/90 days).
- **Earnings Matrix (`EM`)**: Combined grid linking 5 historical annual periods, 8 historical quarterly periods, and 4 forward forecast periods for Sales, EBITDA, Net Income, and EPS.

### 9.4 Earnings Transcripts (`TRAN`)
- **Structured Schema**:
  ```typescript
  export interface TranscriptSegment {
    id: string;
    speakerName: string;
    speakerRole: 'EXECUTIVE' | 'ANALYST' | 'OPERATOR';
    speakerCompany?: string;
    section: 'PREPARED_REMARKS' | 'Q_AND_A';
    text: string;
    paragraphIndex: number;
  }
  ```
- **Capabilities**: Full-text keyword search, filter by executive or analyst, jump to speaker, and structured AI access.

### 9.5 SEC Filings Browser & Reader (`FLNG`)
- **Integrated Reader**: Renders SEC EDGAR HTML directly with navigation sidebar, section anchors (Item 1A Risk Factors, Item 7 MD&A), full-text search, and exhibit links.

---

## 10. Options Analytics & Valuation Calculator (`OVME`)

### 10.1 Options Analytics Suite (`OMON`)
- Calls & Puts side-by-side with center strike column.
- Real Implied Volatility per strike with IV Skew curve chart.
- Provider Greeks with Black-Scholes fallback engine:
  - **Delta ($\Delta$)**: Price sensitivity $\frac{\partial V}{\partial S}$
  - **Gamma ($\Gamma$)**: Delta sensitivity $\frac{\partial^2 V}{\partial S^2}$
  - **Theta ($\Theta$)**: Time decay per day $\frac{\partial V}{\partial t}$
  - **Vega ($\nu$)**: Volatility sensitivity per 1% change $\frac{\partial V}{\partial \sigma}$
  - **Rho ($\rho$)**: Interest rate sensitivity $\frac{\partial V}{\partial r}$

### 10.2 Options Valuation Model Evaluator (`OVME`)
Dedicated interactive option pricing and scenario modeling workstation:
- **Inputs**: Underlying Spot Price ($S$), Strike ($K$), Expiration Date / Time to Expiry ($T$), Risk-Free Rate ($r$), Dividend Yield ($q$), Market Option Premium ($P_{mkt}$).
- **Calculations**:
  - Implied Volatility Solver (Newton-Raphson / Brent's method)
  - Theoretical Price (Black-Scholes-Merton 1973 for European, Barone-Adesi-Whaley for American)
  - Greek sensitivities with interactive scenario sliders ($\pm 10\%$ spot, $\pm 5\%$ vol, time decay progression).
  - P&L at expiration diagram with breakeven lines.

---

## 11. Persistence, Workspaces & Rich Research Notes

### 11.1 Schema-Versioned Storage Model
```typescript
export interface SavedWorkspace {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  layout: TilingNode;
  activePresetId: string | null;
  globalSettings: Record<string, unknown>;
}

export interface ResearchNoteDocument {
  id: string;
  title: string;
  content: string; // Markdown or Delta format
  associatedSymbols: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 11.2 Hybrid Cloud & Offline Persistence Architecture
1. **Local-First Layer**: Instant state reads/writes via IndexedDB / localStorage.
2. **Cloud Synchronization**: Background sync to PostgreSQL / Supabase user repository when authenticated.
3. **Workspace Commands**: `WORKSPACE SAVE <name>`, `WORKSPACE LOAD <name>`, `WORKSPACE DELETE <name>`, `WORKSPACE LIST`.

---

## 12. AI Brain as a First-Class Terminal Orchestrator

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AI BRAIN ORCHESTRATION                           │
│                                                                             │
│   User Prompt: "Compare NVDA and AMD margins, valuation, and last call"    │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         AI Terminal Engine                          │   │
│   │   System Prompt injected with live workspace state, active panels,  │   │
│   │   selected link groups, and available tools.                        │   │
│   └─────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│         ┌───────────────────────────┼───────────────────────────┐           │
│         ▼                           ▼                           ▼           │
│   ┌───────────────┐           ┌───────────────┐           ┌───────────────┐ │
│   │ Workspace Tool│           │ Market Tool   │           │ Research Tool │ │
│   │ open_panel    │           │ get_financials│           │ query_trans-  │ │
│   │ (Split Chart) │           │ (NVDA & AMD)  │           │ cript (Guid.) │ │
│   └───────────────┘           └───────────────┘           └───────────────┘ │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Structured Synthesis: Markdown comparison table + Cited evidence    │   │
│   │ [1] NVDA Q4 10-K Item 7 (MD&A)  [2] AMD Q4 Earnings Call (CFO Q&A)  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.1 Tool Schemas
- **Workspace Tools**: `open_panel`, `close_panel`, `split_panel`, `set_panel_instrument`, `set_link_group`, `load_workspace`, `save_workspace`.
- **Market Data Tools**: `get_quote`, `get_bars`, `get_options_chain`, `get_greeks`, `get_financial_statements`, `get_ratios`, `get_consensus_estimates`, `get_filings`, `get_transcripts`, `get_dividends`.
- **Research & Comparative Tools**: `compare_instruments`, `search_transcripts`, `extract_guidance`, `summarize_filing`, `create_research_note`.

### 12.2 Strict Safety & Provenance Boundaries
- AI tools cannot silently perform destructive actions without confirmation.
- Every assertion derived from financial statements, transcripts, or filings includes clickable citations with line/paragraph references.

---

## 13. Command Language V2 & Help System

### 13.1 Formal Lexer & Parser Architecture
Commands are parsed via a deterministic tokenizer and AST evaluator:
```
Input: "NVDA US EQUITY GP"
Tokens: [SYMBOL: "NVDA", VENUE: "US", ASSET_CLASS: "EQUITY", MNEMONIC: "GP"]
AST: { target: { symbol: "NVDA", country: "US", assetClass: "EQUITY" }, action: "OPEN_CHART" }

Input: "WORKSPACE SAVE tech-overview"
Tokens: [COMMAND: "WORKSPACE", SUBCOMMAND: "SAVE", ARG: "tech-overview"]
AST: { action: "WORKSPACE_SAVE", name: "tech-overview" }
```

### 13.2 Command Registry Definition
```typescript
export interface CommandDefinition {
  mnemonic: string;
  aliases: string[];
  name: string;
  category: 'MARKET_DATA' | 'COMPANY_RESEARCH' | 'ANALYTICS' | 'WORKSPACE' | 'SETTINGS';
  description: string;
  usage: string;
  examples: string[];
  targetPanelType?: PanelType;
  handler: (args: ParsedCommandArgs, context: CommandExecutionContext) => void;
}
```

### 13.3 Auto-Generated Help System (`HELP`)
Executing `HELP` or `HELP <mnemonic>` dynamically reflects over the Command Registry, rendering categorized lists, keyboard shortcuts, argument syntax, and usage examples.

---

## 14. Phased Migration Plan

- **Phase 0: Foundation, Types & Provenance Framework**
  - Define canonical `InstrumentRef`, `Instrument`, `DataProvenance`, and capability provider interfaces.
  - Audit and attach provenance badges to all existing panels.
- **Phase 1: Canonical Instrument Master & Link-Group Routing**
  - Implement `SecurityMasterResolver` and `SECF` search.
  - Upgrade `PanelConfig` with `instrument` and `linkGroup`.
  - Implement color-link event bus in tiling manager.
  - Upgrade Command Bar to Registry-driven AST parser.
- **Phase 2: Market Data Integrity & Real-Time Streaming Hub**
  - Implement WebSocket/SSE multiplexer with fallback polling.
  - Eliminate synthetic bid/ask, mock IV, synthetic tape, and fake L2.
  - Upgrade Quote Monitor (`QM`), Time & Sales (`TAPE`), and Level 2 (`DEPTH`).
- **Phase 3: Financial Research & Statements Suite**
  - Implement `FA` Financial Statements, `RATIO` Analysis, `ERN` Estimates, and `EM` Earnings Matrix.
- **Phase 4: Filings, Transcripts, News & IPO/Halts**
  - Implement in-terminal SEC Filing Reader (`FLNG`), Transcript Explorer (`TRAN`), News v2 with Breaking Alerts, `HALT`, and `IPO` monitors.
- **Phase 5: Persistence, Saved Workspaces & Research Notes**
  - Implement cloud/offline persistence engine, `WORKSPACE SAVE/LOAD`, Rich Research Notes, server-side alerts, and Notification Center.
- **Phase 6: Options Valuation (`OVME`), Brokerage & Advanced Analytics**
  - Implement `OVME` Black-Scholes calculator, read-only brokerage aggregator provider (SnapTrade), and centralized export engine (CSV/JSON/XLSX).
- **Phase 7: AI Brain Orchestrator & Autonomous Research Agent**
  - Equip AI Brain with full workspace control, multi-period financial tools, transcript analysis, citation verification, and comparative research workflows (`COMPARE`).

---

## 15. Risk Assessment & Mitigations

1. **Market Data Provider Rate Limits & Licensing**:
   - *Mitigation*: Modular provider interface with multi-tier fallbacks, Redis caching, and client-side subscription deduplication.
2. **State Synchronization Complexity in Tiling Tree**:
   - *Mitigation*: Unidirectional color-link event bus with pure immutable reducer updates.
3. **Large Dataset Memory Pressure (Transcripts, Options Chains)**:
   - *Mitigation*: Virtualized scrolling (e.g. `@tanstack/react-virtual`), selective DOM rendering, and indexedDB offloading.
4. **LLM Hallucination in Financial Answers**:
   - *Mitigation*: Tool-grounded structured fetching where LLM must invoke `get_financial_statements` or `get_transcript` and cite exact accession numbers or timestamps.

---

## 16. Alternatives Considered & Trade-offs

- **Keep Single Global Symbol**: *Rejected* — Fundamentally blocks side-by-side comparative analysis and multi-monitor trading workflows.
- **Direct Client-Side Provider Calls**: *Rejected* — Leaks secret API keys to the browser, violates CORS, and prevents unified server-side caching and rate limiting.
- **Pure WebSockets Without Polling Fallback**: *Rejected* — Unstable network environments and restrictive firewalls require seamless HTTP long-polling / SSE fallback.
- **Monolithic App Rewrite**: *Rejected* — High risk of regressions. Incremental capability-based evolution preserves all 42+ existing features while upgrading their foundations.
