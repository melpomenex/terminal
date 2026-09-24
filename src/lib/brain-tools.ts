import { z } from 'zod';

/**
 * AI Brain tool catalog (v2).
 *
 * CLIENT tools mutate the workspace and run in the browser next to the
 * tiling manager (open/close/split panels, instruments, link groups,
 * workspaces, alerts, notes).
 *
 * SERVER tools fetch market/research data inside the chat route (quotes,
 * bars, options, statements, ratios, filings, transcripts, comparisons) and
 * return JSON grounded in the v2 provider stack.
 */

const PANEL_TYPES = [
  'quote-monitor', 'security-description', 'chart', 'news', 'fundamentals', 'portfolio',
  'fx-rates', 'commodity', 'options-chain', 'economic-calendar', 'earnings', 'analyst-ratings',
  'bond-yields', 'market-heatmap', 'stock-screener', 'insider-activity', 'institutional-holdings',
  'sec-filings', 'world-markets', 'correlation-risk', 'social-sentiment', 'help', 'brain-chat',
  'finance-research', 'ticker-cards', 'fear-greed', 'market-breadth', 'tape', 'depth',
  'unusual-options', 'gamma-exposure', 'congress-trades', 'seasonality', 'sector-rotation',
  'movers', 'wsb-trending', 'vix-term', 'dividend-calendar', 'backtest', 'notes', 'superinvestor',
  'etf-flows', 'allq', 'financial-analysis', 'ratio-analysis', 'earnings-matrix', 'transcripts',
  'market-halts', 'ipo-monitor', 'dividend-analytics', 'research-notes', 'options-valuation',
  'aum', 'financial-calculator', 'historical-data', 'workspace-manager',
] as const;

const LINK_GROUPS = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'MAGENTA', 'CYAN', 'UNLINKED'] as const;

export const clientToolDefinitions = {
  // --- Workspace orchestration ---------------------------------------------
  open_panel: {
    description: 'Open a new panel adjacent to the active panel (or a specific panel).',
    parameters: z.object({
      type: z.enum(PANEL_TYPES).describe('Panel type to open'),
      direction: z.enum(['horizontal', 'vertical']).optional().default('vertical').describe('Split direction'),
      instrument: z.string().optional().describe('Optional ticker to set on the new panel (e.g. "NVDA")'),
      link_group: z.enum(LINK_GROUPS).optional().describe('Optional color-link group for the new panel'),
    }),
  },
  close_panel: {
    description: 'Close a panel by ID. DESTRUCTIVE — requires user confirmation.',
    parameters: z.object({ panel_id: z.string().describe('Panel ID from the workspace state') }),
  },
  split_panel: {
    description: 'Split the workspace: inserts a panel next to a target panel with a given ratio.',
    parameters: z.object({
      type: z.enum(PANEL_TYPES),
      direction: z.enum(['horizontal', 'vertical']).default('vertical'),
      ratio: z.number().min(0.1).max(0.9).default(0.5).describe('Size share for the new panel'),
    }),
  },
  set_panel_instrument: {
    description: 'Set the active instrument on a specific panel (per-panel context, not global).',
    parameters: z.object({
      panel_id: z.string().describe('Target panel ID'),
      symbol: z.string().describe('Ticker or composite symbol (AAPL, EURUSD, BTC-USD, SPX…)'),
    }),
  },
  set_link_group: {
    description: 'Assign a panel to a Bloomberg-style color link group; panels sharing a group update instruments together.',
    parameters: z.object({
      panel_id: z.string(),
      group: z.enum(LINK_GROUPS),
    }),
  },
  set_symbol: {
    description: 'Set the global active symbol (legacy fallback for un-instrumented panels).',
    parameters: z.object({ symbol: z.string() }),
  },
  load_preset: {
    description: 'Load a preset layout by name. Replaces the current layout — destructive.',
    parameters: z.object({ preset: z.string().describe('Preset id, e.g. "godel", "trader", "flow"') }),
  },
  load_workspace: {
    description: 'Load a named saved workspace. Replaces the current layout — destructive.',
    parameters: z.object({ name: z.string() }),
  },
  save_workspace: {
    description: 'Save the current layout as a named workspace.',
    parameters: z.object({ name: z.string().describe('Workspace name (lowercase slug)') }),
  },
  switch_watchlist: {
    description: 'Switch the active watchlist.',
    parameters: z.object({ name: z.string() }),
  },
  set_chart_range: {
    description: 'Change the chart time range.',
    parameters: z.object({ range: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y']) }),
  },
  toggle_indicator: {
    description: 'Toggle a technical indicator overlay on the chart.',
    parameters: z.object({
      indicator: z.enum(['SMA', 'EMA', 'RSI', 'MACD', 'BB', 'VWAP']),
      enabled: z.boolean(),
    }),
  },
  add_alert: {
    description: 'Create a price alert for a symbol.',
    parameters: z.object({
      symbol: z.string(),
      condition: z.enum(['above', 'below']),
      threshold: z.number().positive(),
    }),
  },
  create_research_note: {
    description: 'Create a markdown research note document with ticker tags.',
    parameters: z.object({
      title: z.string(),
      content: z.string().describe('Markdown body'),
      symbols: z.array(z.string()).default([]).describe('Associated tickers'),
    }),
  },
};

export const serverToolDefinitions = {
  // --- Market data ----------------------------------------------------------
  get_quote: {
    description: 'Get the latest quote (price, change, day range, volume, 52w) for one or more symbols.',
    parameters: z.object({
      symbols: z.array(z.string()).min(1).max(10).describe('Ticker symbols'),
    }),
  },
  get_bars: {
    description: 'Get OHLCV bar history with summary statistics (trend, high/low, avg volume).',
    parameters: z.object({
      symbol: z.string(),
      range: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y']).default('3mo'),
    }),
  },
  get_options_chain: {
    description: 'Get an options chain summary for a symbol: expirations, ATM strikes, volume/OI concentration.',
    parameters: z.object({ symbol: z.string() }),
  },
  get_greeks: {
    description: 'Compute Black-Scholes price and Greeks (delta, gamma, theta, vega, rho) for one option contract.',
    parameters: z.object({
      symbol: z.string().describe('Underlying ticker'),
      strike: z.number().positive(),
      expiration: z.string().describe('ISO date YYYY-MM-DD'),
      option_type: z.enum(['CALL', 'PUT']),
      volatility: z.number().optional().describe('Override IV (decimal). Defaults to solved from quotes when possible.'),
      spot: z.number().optional().describe('Override underlying spot'),
    }),
  },
  get_financial_statements: {
    description: 'Get standardized multi-period financial statements (income / balance sheet / cash flow) from SEC EDGAR XBRL.',
    parameters: z.object({
      symbol: z.string(),
      statement: z.enum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW']).default('INCOME_STATEMENT'),
      period: z.enum(['ANNUAL', 'QUARTERLY', 'TTM']).default('ANNUAL'),
    }),
  },
  get_ratios: {
    description: 'Get computed financial ratios (margins, ROE/ROA, leverage, liquidity) from the latest statements.',
    parameters: z.object({ symbol: z.string() }),
  },
  get_consensus_estimates: {
    description: 'Get earnings history (quarterly EPS/revenue actuals with YoY growth). Consensus requires a licensed provider and reports UNAVAILABLE when absent.',
    parameters: z.object({ symbol: z.string() }),
  },
  get_filings: {
    description: 'List recent SEC EDGAR filings for a symbol (form, date, accession).',
    parameters: z.object({
      symbol: z.string(),
      forms: z.array(z.string()).optional().describe('Optional form filter e.g. ["10-K","8-K"]'),
    }),
  },
  get_transcripts: {
    description: 'List available earnings-call transcripts for a symbol, or fetch one by id.',
    parameters: z.object({
      symbol: z.string(),
      transcript_id: z.string().optional().describe('Specific transcript id from the list; omit to list'),
    }),
  },
  get_dividends: {
    description: 'Get dividend history and analytics (yield, growth streak, payout) for a symbol.',
    parameters: z.object({ symbol: z.string() }),
  },

  // --- Research -------------------------------------------------------------
  compare_instruments: {
    description: 'Compare 2-4 instruments across quotes, scale metrics, profitability and growth. Returns a comparison table.',
    parameters: z.object({
      symbols: z.array(z.string()).min(2).max(4),
      focus: z.enum(['valuation', 'profitability', 'growth', 'risk', 'all']).default('all'),
    }),
  },
  search_transcripts: {
    description: 'Full-text keyword search across a transcript (returns matching speaker segments with ids for citation).',
    parameters: z.object({
      symbol: z.string(),
      keyword: z.string().min(2),
    }),
  },
  extract_guidance: {
    description: 'Extract forward guidance statements (revenue/EPS outlook, margin targets) from the latest earnings-call transcript.',
    parameters: z.object({ symbol: z.string() }),
  },
  summarize_filing: {
    description: 'Summarize a recent SEC filing for a symbol (key items, risks, MD&A highlights) with section references.',
    parameters: z.object({
      symbol: z.string(),
      form: z.string().default('10-K').describe('Filing form to summarize'),
    }),
  },
  research: {
    description: 'Search the web for real-time information using Perplexity AI.',
    parameters: z.object({ query: z.string() }),
  },
};

export const CLIENT_TOOL_NAMES = new Set(Object.keys(clientToolDefinitions));
export const SERVER_TOOL_NAMES = new Set(Object.keys(serverToolDefinitions));

/** Tools that are destructive and require explicit user confirmation. */
export const DESTRUCTIVE_TOOLS = new Set(['close_panel', 'load_preset', 'load_workspace']);
