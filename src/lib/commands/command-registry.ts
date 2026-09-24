/**
 * Command Registry — single source of truth for every terminal command.
 *
 * Each command declares metadata (mnemonic, aliases, category, usage,
 * examples, target panel) used by the parser, autocomplete, the auto-generated
 * HELP panel, and the AI Brain's tool catalog. Handlers receive a
 * `CommandExecutionContext` implemented by the app shell, so the registry
 * itself stays framework-free and testable.
 */

import type { PanelType } from '@/lib/tiling-types';
import type { InstrumentRef } from '@/lib/types/instrument';

export type CommandCategory = 'MARKET_DATA' | 'COMPANY_RESEARCH' | 'ANALYTICS' | 'WORKSPACE' | 'ACTIONS' | 'AI';

export interface ParsedCommandArgs {
  /** Raw words after the mnemonic/subcommand. */
  args: string[];
  /** Resolved instrument target, when the command carries one. */
  target?: InstrumentRef;
  subcommand?: string;
  raw: string;
}

export interface CommandExecutionContext {
  openPanel: (panelType: PanelType) => void;
  setInstrument: (ref: InstrumentRef) => void;
  openSecurityFinder: () => void;
  loadPreset: (presetId: string) => void;
  addAlert: (symbol: string, condition: 'above' | 'below', threshold: number) => void;
  addPosition: (symbol: string, quantity: number, costBasis: number) => void;
  removePositionBySymbol: (symbol: string) => void;
  toggleIndicator: (indicator: string) => void;
  exportData: (format: 'csv' | 'json' | 'xlsx', scope: string) => void;
  openModal: (modal: 'workspace' | 'settings' | 'shortcuts' | 'notifications') => void;
  addCustomWatchlist: (name: string) => void;
  deleteCustomWatchlist: (name: string) => void;
  renameCustomWatchlist: (oldName: string, newName: string) => void;
  setWatchlistKey: (key: string) => void;
  saveWorkspace: (name: string) => void;
  loadWorkspace: (name: string) => void;
  deleteWorkspace: (name: string) => void;
  listWorkspaces: () => void;
  notify: (message: string, level?: 'info' | 'error' | 'success') => void;
  brainCompare: (symbols: string[]) => void;
}

export interface CommandDefinition {
  mnemonic: string;
  aliases: string[];
  name: string;
  category: CommandCategory;
  description: string;
  usage: string;
  examples: string[];
  /** Panel type opened when this command runs (used for autocomplete hints). */
  targetPanelType?: PanelType;
  /** When true, an instrument target before the mnemonic loads it first. */
  takesInstrument?: boolean;
  handler?: (parsed: ParsedCommandArgs, ctx: CommandExecutionContext) => void;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class CommandRegistry {
  private byMnemonic = new Map<string, CommandDefinition>();
  /** alias/upper mnemonic -> canonical definition */
  private lookup = new Map<string, CommandDefinition>();

  register(def: CommandDefinition): void {
    this.byMnemonic.set(def.mnemonic, def);
    this.lookup.set(def.mnemonic, def);
    for (const a of def.aliases) this.lookup.set(a, def);
  }

  get(mnemonic: string): CommandDefinition | undefined {
    return this.lookup.get(mnemonic.toUpperCase());
  }

  all(): CommandDefinition[] {
    return [...this.byMnemonic.values()];
  }

  /** All matchable tokens (mnemonics + aliases) for the parser. */
  matchableTokens(): Set<string> {
    return new Set(this.lookup.keys());
  }

  byCategory(): Record<CommandCategory, CommandDefinition[]> {
    const out = {} as Record<CommandCategory, CommandDefinition[]>;
    for (const cmd of this.byMnemonic.values()) {
      (out[cmd.category] ??= []).push(cmd);
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Default command set
// ---------------------------------------------------------------------------

function panelCommand(
  mnemonic: string,
  aliases: string[],
  name: string,
  category: CommandCategory,
  description: string,
  targetPanelType: PanelType,
  opts?: { takesInstrument?: boolean; extraExamples?: string[] },
): CommandDefinition {
  return {
    mnemonic,
    aliases,
    name,
    category,
    description,
    usage: `${mnemonic} [TICKER]`,
    examples: [mnemonic, ...(opts?.takesInstrument ? [`${mnemonic} NVDA`] : []), ...(opts?.extraExamples ?? [])],
    targetPanelType,
    takesInstrument: opts?.takesInstrument,
    handler: (parsed, ctx) => {
      if (parsed.target) ctx.setInstrument(parsed.target);
      ctx.openPanel(targetPanelType);
    },
  };
}

export function createDefaultRegistry(): CommandRegistry {
  const r = new CommandRegistry();

  // --- Market data panels -------------------------------------------------
  r.register(panelCommand('QM', ['MON', 'MONITOR'], 'Quote Monitor', 'MARKET_DATA', 'Live watchlist with real bid/ask, VWAP and flash updates', 'quote-monitor'));
  r.register(panelCommand('GP', ['CHART'], 'Line Chart', 'MARKET_DATA', 'Price chart with indicators and comparisons', 'chart', { takesInstrument: true, extraExamples: ['NVDA GP', 'GP'] }));
  r.register(panelCommand('TAPE', ['T&S', 'SALES'], 'Time & Sales', 'MARKET_DATA', 'Millisecond trade prints with conditions', 'tape', { takesInstrument: true }));
  r.register(panelCommand('L2', ['DEPTH', 'BOOK'], 'Level 2 Depth', 'MARKET_DATA', 'Order book depth (entitlement required)', 'depth', { takesInstrument: true }));
  r.register(panelCommand('OMON', ['OPT', 'OPTIONS'], 'Options Chain', 'MARKET_DATA', 'Options chain with real IV and Greeks', 'options-chain', { takesInstrument: true }));
  r.register(panelCommand('OVME', [], 'Options Valuation', 'ANALYTICS', 'Black-Scholes pricing calculator and scenario lab', 'options-valuation', { takesInstrument: true }));
  r.register(panelCommand('ALLQ', [], 'All Quotes', 'MARKET_DATA', 'Primary, regional, ADR and dual listings for an issuer', 'allq', { takesInstrument: true, extraExamples: ['SHEL ALLQ', 'ALLQ'] }));
  r.register(panelCommand('HP', ['HIST'], 'Historical Data', 'MARKET_DATA', 'Full historical price workstation with export', 'historical-data', { takesInstrument: true }));
  r.register(panelCommand('FX', [], 'FX Rates', 'MARKET_DATA', 'Currency cross-rate board', 'fx-rates'));
  r.register(panelCommand('CMDTY', [], 'Commodities', 'MARKET_DATA', 'Energy, metals and agriculture futures board', 'commodity'));
  r.register(panelCommand('YCRV', ['BONDS'], 'Yield Curve', 'MARKET_DATA', 'Treasury yield curve snapshot', 'bond-yields'));
  r.register(panelCommand('MAP', [], 'Heatmap', 'MARKET_DATA', 'Market treemap by sector', 'market-heatmap'));
  r.register(panelCommand('WEER', ['WE'], 'World Markets', 'MARKET_DATA', 'Global indices snapshot', 'world-markets'));
  r.register(panelCommand('MOVERS', ['MOMO', 'GAINERS'], 'Movers', 'MARKET_DATA', 'Top gainers, losers and most active', 'movers'));
  r.register(panelCommand('BREADTH', ['BREAD', 'AD'], 'Market Breadth', 'MARKET_DATA', 'Advance/decline and McClellan internals', 'market-breadth'));
  r.register(panelCommand('VIX', ['VIXTERM'], 'VIX Term Structure', 'MARKET_DATA', 'VIX futures contango/backwardation', 'vix-term'));
  r.register(panelCommand('ECO', [], 'Economic Calendar', 'MARKET_DATA', 'Upcoming economic releases', 'economic-calendar'));

  // --- Company research ----------------------------------------------------
  r.register(panelCommand('DES', [], 'Security Description', 'COMPANY_RESEARCH', 'Company profile, sector, exchange details', 'fundamentals', { takesInstrument: true }));
  r.register(panelCommand('FA', ['FINANCIALS'], 'Financial Analysis', 'COMPANY_RESEARCH', 'Income statement, balance sheet, cash flow', 'financial-analysis', { takesInstrument: true }));
  r.register(panelCommand('RATIO', [], 'Ratio Analysis', 'COMPANY_RESEARCH', 'Valuation, profitability, leverage, liquidity ratios', 'ratio-analysis', { takesInstrument: true }));
  r.register(panelCommand('ERN', ['EARNINGS'], 'Earnings', 'COMPANY_RESEARCH', 'Historical surprises and forward consensus', 'earnings', { takesInstrument: true }));
  r.register(panelCommand('EM', [], 'Earnings Matrix', 'COMPANY_RESEARCH', 'Multi-period actuals vs consensus matrix', 'earnings-matrix', { takesInstrument: true }));
  r.register(panelCommand('TRAN', ['TRANSCRIPT'], 'Earnings Transcripts', 'COMPANY_RESEARCH', 'Speaker-segmented call transcripts', 'transcripts', { takesInstrument: true }));
  r.register(panelCommand('FLNG', ['FILINGS'], 'SEC Filings', 'COMPANY_RESEARCH', 'EDGAR filings with in-terminal reader', 'sec-filings', { takesInstrument: true }));
  r.register(panelCommand('NEWS', [], 'News Feed', 'COMPANY_RESEARCH', 'Multi-source filtered news', 'news'));
  r.register(panelCommand('DIV', ['DIVS', 'DVD'], 'Dividend Analytics', 'COMPANY_RESEARCH', 'Payout history, growth rates, yield projections', 'dividend-analytics', { takesInstrument: true }));
  r.register(panelCommand('INSI', [], 'Insider Activity', 'COMPANY_RESEARCH', 'Form 4 insider transactions', 'insider-activity', { takesInstrument: true }));
  r.register(panelCommand('HOLD', ['13F'], 'Institutional Holdings', 'COMPANY_RESEARCH', '13F institutional positions', 'institutional-holdings', { takesInstrument: true }));
  r.register(panelCommand('ANR', ['RATINGS'], 'Analyst Ratings', 'COMPANY_RESEARCH', 'Analyst recommendations and price targets', 'analyst-ratings', { takesInstrument: true }));
  r.register(panelCommand('SCREEN', [], 'Stock Screener', 'COMPANY_RESEARCH', 'Multi-metric screener with export', 'stock-screener'));

  // --- Analytics -----------------------------------------------------------
  r.register(panelCommand('GEX', ['GAMMA'], 'Gamma Exposure', 'ANALYTICS', 'Dealer gamma exposure profile (derived)', 'gamma-exposure', { takesInstrument: true }));
  r.register(panelCommand('FLOW', ['UNUSUAL', 'UOA'], 'Unusual Options', 'ANALYTICS', 'Unusual options flow detector', 'unusual-options'));
  r.register(panelCommand('RISK', [], 'Correlation & Risk', 'ANALYTICS', 'Correlation matrix and portfolio risk', 'correlation-risk'));
  r.register(panelCommand('SEASON', ['SEAS'], 'Seasonality', 'ANALYTICS', 'Monthly and day-of-week seasonality', 'seasonality', { takesInstrument: true }));
  r.register(panelCommand('SECTORS', ['ROT', 'ROTATION'], 'Sector Rotation', 'ANALYTICS', 'Sector rotation matrix', 'sector-rotation'));
  r.register(panelCommand('CALC', [], 'Financial Calculator', 'ANALYTICS', 'TVM, NPV, IRR and bond yield solver', 'financial-calculator'));
  r.register(panelCommand('LAB', ['BACKTEST', 'BT'], 'Backtest Lab', 'ANALYTICS', 'Strategy backtesting', 'backtest'));
  r.register(panelCommand('ETF', ['FLOWS'], 'ETF Flows', 'ANALYTICS', 'ETF flow proxy board', 'etf-flows'));
  r.register(panelCommand('CONGRESS', ['POLI'], 'Congress Trades', 'ANALYTICS', 'House/senate trading disclosures', 'congress-trades'));
  r.register(panelCommand('WHALE', ['SUPER'], 'Superinvestors', 'ANALYTICS', '13F superinvestor holdings', 'superinvestor'));
  r.register(panelCommand('AUM', [], 'AUM Analytics', 'ANALYTICS', 'Account AUM curve and allocation', 'aum'));
  r.register(panelCommand('SENT', [], 'Social Sentiment', 'ANALYTICS', 'Social sentiment proxy', 'social-sentiment'));
  r.register(panelCommand('WSB', ['RETAIL'], 'WSB Trends', 'ANALYTICS', 'Retail trending tickers', 'wsb-trending'));
  r.register(panelCommand('FEAR', ['FNG'], 'Fear & Greed', 'ANALYTICS', 'CNN Fear & Greed index', 'fear-greed'));

  // --- Workspace -----------------------------------------------------------
  r.register(panelCommand('PRTU', ['PORT'], 'Portfolio', 'WORKSPACE', 'Positions, lots and P&L', 'portfolio'));
  r.register(panelCommand('NOTE', ['NOTES2'], 'Research Notes', 'WORKSPACE', 'Multi-document research notes', 'research-notes'));
  r.register({ mnemonic: 'JOURNAL', aliases: ['NOTES', 'JRNL'], name: 'Trading Journal', category: 'WORKSPACE', description: 'Tagged trading journal', usage: 'JOURNAL', examples: ['JOURNAL'], targetPanelType: 'notes', handler: (_p, ctx) => ctx.openPanel('notes') });
  r.register(panelCommand('HALT', [], 'Market Halts', 'WORKSPACE', 'Real-time exchange halt monitor', 'market-halts'));
  r.register(panelCommand('IPO', [], 'IPO Monitor', 'WORKSPACE', 'IPO calendar and pricing', 'ipo-monitor'));
  r.register(panelCommand('TICKER', ['TICKERS'], 'Ticker Cards', 'WORKSPACE', 'Watchlist ticker cards', 'ticker-cards'));

  r.register({
    mnemonic: 'WORKSPACE',
    aliases: ['WS'],
    name: 'Workspace Management',
    category: 'WORKSPACE',
    description: 'Save, load, delete and list named workspace layouts',
    usage: 'WORKSPACE <SAVE|LOAD|DELETE|LIST> [name]',
    examples: ['WORKSPACE SAVE tech-setup', 'WORKSPACE LOAD tech-setup', 'WORKSPACE LIST'],
    targetPanelType: 'workspace-manager',
    handler: (parsed, ctx) => {
      const name = parsed.args.filter((a) => a !== parsed.subcommand).join(' ');
      switch (parsed.subcommand) {
        case 'SAVE':
          if (!name) { ctx.notify('Usage: WORKSPACE SAVE <name>', 'error'); return; }
          ctx.saveWorkspace(name.toLowerCase());
          return;
        case 'LOAD':
          if (!name) { ctx.notify('Usage: WORKSPACE LOAD <name>', 'error'); return; }
          ctx.loadWorkspace(name.toLowerCase());
          return;
        case 'DELETE':
          if (!name) { ctx.notify('Usage: WORKSPACE DELETE <name>', 'error'); return; }
          ctx.deleteWorkspace(name.toLowerCase());
          return;
        case 'LIST':
          ctx.listWorkspaces();
          return;
        default:
          ctx.openModal('workspace');
      }
    },
  });

  r.register({ mnemonic: 'VIEW', aliases: [], name: 'Layout Preset', category: 'WORKSPACE', description: 'Load a built-in layout preset', usage: 'VIEW <preset>', examples: ['VIEW GODEL', 'VIEW TRADER'], handler: (parsed, ctx) => { const id = parsed.args.join('-').toLowerCase(); ctx.loadPreset(id || 'godel'); } });
  r.register({ mnemonic: 'WATCHLIST', aliases: ['WL'], name: 'Watchlist Management', category: 'WORKSPACE', description: 'Create, delete or rename custom watchlists', usage: 'WATCHLIST <CREATE|DELETE|RENAME> <name>', examples: ['WATCHLIST CREATE momentum', 'WATCHLIST RENAME old new'], handler: (parsed, ctx) => {
    const args = parsed.args.filter((a) => a !== parsed.subcommand);
    const name = args.join(' ');
    switch (parsed.subcommand) {
      case 'CREATE': if (name) ctx.addCustomWatchlist(name.toLowerCase()); return;
      case 'DELETE': if (name) ctx.deleteCustomWatchlist(name); return;
      case 'RENAME': {
        const [oldN, ...rest] = args;
        if (oldN && rest.length) ctx.renameCustomWatchlist(oldN, rest.join(' '));
        return;
      }
      default: ctx.setWatchlistKey(name || 'DEFAULT');
    }
  } });

  // --- Actions -------------------------------------------------------------
  r.register({
    mnemonic: 'ALERT', aliases: ['ALERTS'], name: 'Price Alert', category: 'ACTIONS',
    description: 'Create a price alert', usage: 'ALERT <TICKER> <ABOVE|BELOW> <price>',
    examples: ['ALERT AAPL ABOVE 200', 'ALERT TSLA BELOW 220'],
    handler: (parsed, ctx) => {
      const [sym, cond, price] = parsed.args;
      if (!sym || (cond !== 'ABOVE' && cond !== 'BELOW') || !price || Number.isNaN(Number(price))) {
        ctx.notify('Usage: ALERT <TICKER> <ABOVE|BELOW> <price>', 'error');
        return;
      }
      ctx.addAlert(sym, cond.toLowerCase() as 'above' | 'below', Number(price));
    },
  });
  r.register({ mnemonic: 'ADD', aliases: ['BUY'], name: 'Add Position', category: 'ACTIONS', description: 'Add a portfolio position lot', usage: 'ADD <qty> <TICKER> <cost>', examples: ['ADD 100 AAPL 150'], handler: (parsed, ctx) => {
    const [qty, sym, cost] = parsed.args;
    if (!qty || !sym || !cost || Number.isNaN(Number(qty)) || Number.isNaN(Number(cost))) { ctx.notify('Usage: ADD <qty> <TICKER> <cost>', 'error'); return; }
    ctx.addPosition(sym, Number(qty), Number(cost));
  } });
  r.register({ mnemonic: 'REMOVE', aliases: ['SELL'], name: 'Remove Position', category: 'ACTIONS', description: 'Remove portfolio positions for a symbol', usage: 'REMOVE <TICKER>', examples: ['REMOVE AAPL'], handler: (parsed, ctx) => {
    const sym = parsed.args[0];
    if (!sym) { ctx.notify('Usage: REMOVE <TICKER>', 'error'); return; }
    ctx.removePositionBySymbol(sym);
  } });
  r.register({ mnemonic: 'XL', aliases: ['EXPORT'], name: 'Export Data', category: 'ACTIONS', description: 'Export the active panel data', usage: 'XL [csv|json|xlsx]', examples: ['XL', 'XL xlsx'], handler: (parsed, ctx) => {
    const fmt = (parsed.args[0]?.toLowerCase() as 'csv' | 'json' | 'xlsx') ?? 'csv';
    ctx.exportData(fmt, 'watchlist');
  } });
  r.register({ mnemonic: 'IND', aliases: [], name: 'Toggle Indicator', category: 'ACTIONS', description: 'Toggle a chart indicator', usage: 'IND <SMA|VWAP|RSI|MACD>', examples: ['IND SMA'], handler: (parsed, ctx) => { const ind = parsed.args.join(' '); if (ind) ctx.toggleIndicator(ind); } });
  r.register({ mnemonic: 'SECF', aliases: ['FIND'], name: 'Security Finder', category: 'ACTIONS', description: 'Global multi-asset security finder', usage: 'SECF [query]', examples: ['SECF', 'SECF gold'], handler: (_p, ctx) => ctx.openSecurityFinder() });

  // --- AI ------------------------------------------------------------------
  r.register(panelCommand('BRAIN', ['AI'], 'AI Brain', 'AI', 'AI co-pilot and terminal orchestrator', 'brain-chat'));
  r.register(panelCommand('BRAINCFG', ['AICFG'], 'Brain Settings', 'AI', 'AI model & provider configuration', 'brain-settings'));
  r.register(panelCommand('FINR', ['FINRESEARCH'], 'Finance Research', 'AI', 'Perplexity-backed deep research', 'finance-research'));
  r.register({
    mnemonic: 'COMPARE', aliases: ['COMP'], name: 'Comparative Research', category: 'AI',
    description: 'AI multi-symbol comparison with orchestrated panes', usage: 'COMPARE <TICKER> <TICKER> [TICKER…]',
    examples: ['COMPARE NVDA AMD INTC'], handler: (parsed, ctx) => {
      const symbols = parsed.args.filter((a) => /^[A-Z0-9.\-]{1,10}$/.test(a));
      if (symbols.length < 2) { ctx.notify('Usage: COMPARE <TICKER> <TICKER> [...]', 'error'); return; }
      ctx.brainCompare(symbols);
    },
  });

  // --- Help & settings -----------------------------------------------------
  r.register({ mnemonic: 'HELP', aliases: ['?'], name: 'Help', category: 'ACTIONS', description: 'Auto-generated command reference', usage: 'HELP [mnemonic]', examples: ['HELP', 'HELP ALERT'], targetPanelType: 'help', handler: (parsed, ctx) => ctx.openPanel('help') });
  r.register({ mnemonic: 'SETTINGS', aliases: ['CONFIG'], name: 'Settings', category: 'ACTIONS', description: 'Themes & preferences', usage: 'SETTINGS', examples: ['SETTINGS'], handler: (_p, ctx) => ctx.openModal('settings') });
  r.register({ mnemonic: 'SHORTCUTS', aliases: [], name: 'Keyboard Shortcuts', category: 'ACTIONS', description: 'Keyboard shortcut overlay', usage: 'SHORTCUTS', examples: ['SHORTCUTS'], handler: (_p, ctx) => ctx.openModal('shortcuts') });
  r.register({ mnemonic: 'CHAT', aliases: [], name: 'Brain Chat', category: 'AI', description: 'Open the AI Brain chat', usage: 'CHAT', examples: ['CHAT'], targetPanelType: 'brain-chat', handler: (_p, ctx) => ctx.openPanel('brain-chat') });

  return r;
}

export const commandRegistry = createDefaultRegistry();
