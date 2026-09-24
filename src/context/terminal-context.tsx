'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ChartData, NewsItem, SearchQuote, WatchlistItem } from '@/lib/types';
import type { GodelCompanyProfile, GodelEarningsEntry, GodelAnalystRatingsSummary, GodelOptionsChain, GodelShortInterest, GodelDividend } from '@/lib/godel-types';
import { godelGet, godelPost } from '@/lib/godel-client';
import type { BrainSettings } from '@/lib/brain-types';
import { loadBrainSettings, saveBrainSettings } from '@/lib/brain-types';
import { parseCommand, suggestMnemonic } from '@/lib/commands/command-parser';
import { commandRegistry, type CommandExecutionContext } from '@/lib/commands/command-registry';
import type { PanelType } from '@/lib/tiling-types';

export interface AlertRule {
  id: string; symbol: string; condition: 'above' | 'below'; threshold: number; triggered: boolean;
}

export interface Position {
  id: string; symbol: string; quantity: number; costBasis: number; dateAdded: string;
}

export interface CustomWatchlist {
  id: string; name: string; symbols: string[]; createdAt: string;
}

const WATCHLISTS: Record<string, string[]> = {
  DEFAULT: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY', 'QQQ'],
  SECTORS: ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLU', 'XLP', 'XLB', 'XLY', 'XLC', 'XLRE'],
  INDEXES: ['SPY', 'QQQ', 'IWM', 'DIA', 'VTV', 'VUG', 'VOO', 'VTI', 'GLD', 'TLT'],
};

export const WATCHLIST_KEYS = Object.keys(WATCHLISTS);

export type ChartType = 'candle' | 'line' | 'area';

function isMarketOpen(): boolean {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = nyTime.getHours(), m = nyTime.getMinutes(), day = nyTime.getDay();
  if (day === 0 || day === 6) return false;
  if (h < 9 || (h === 9 && m < 30)) return false;
  if (h >= 16) return false;
  return true;
}

interface TerminalContextType {
  symbol: string; setSymbol: (s: string) => void;
  watchlistKey: string; setWatchlistKey: (k: string) => void;
  watchlist: WatchlistItem[];
  chart: ChartData | null;
  news: NewsItem[];
  loading: boolean;
  command: string; setCommand: (v: string) => void; handleCommand: () => void;
  lastAction: string | null;
  setLastAction: (a: string | null) => void;
  searchResults: SearchQuote[]; showSearch: boolean; setShowSearch: (v: boolean) => void;
  onSearchChange: (q: string) => void; onSelectSearch: (s: string) => void;
  chartRange: string; setChartRange: (r: string) => void;
  chartType: ChartType; setChartType: (t: ChartType) => void;
  time: string; marketOpen: boolean;
  portfolio: string[]; addToPortfolio: (sym: string) => void; removeFromPortfolio: (sym: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectedArticle: string | null;
  setSelectedArticle: (url: string | null) => void;
  alerts: AlertRule[];
  addAlert: (rule: AlertRule) => void;
  removeAlert: (id: string) => void;
  triggeredAlerts: AlertRule[];
  portfolioPositions: Position[];
  addPosition: (symbol: string, quantity: number, costBasis: number) => void;
  removePosition: (id: string) => void;
  customWatchlists: CustomWatchlist[];
  addCustomWatchlist: (name: string) => void;
  removeCustomWatchlist: (id: string) => void;
  renameCustomWatchlist: (id: string, name: string) => void;
  newsFilter: { keyword: string; sources: string[] };
  setNewsFilter: (f: { keyword: string; sources: string[] }) => void;
  comparisonSymbols: string[];
  setComparisonSymbols: (s: string[]) => void;
  seriesIdMap: Record<string, number>;
  currentSeriesId: number | null;
  companyProfile: GodelCompanyProfile | null;
  earnings: GodelEarningsEntry[] | null;
  analystRatings: GodelAnalystRatingsSummary | null;
  optionsChain: GodelOptionsChain | null;
  shortInterest: GodelShortInterest | null;
  dividends: GodelDividend[] | null;
  fetchEarnings: (seriesId: number) => Promise<GodelEarningsEntry[]>;
  fetchAnalystRatings: (seriesId: number) => Promise<unknown>;
  fetchOptions: (seriesId: number, strikesAbove?: number, strikesBelow?: number) => Promise<unknown>;
  fetchShortInterest: (seriesId: number) => Promise<unknown>;
  fetchDividends: (seriesId: number) => Promise<unknown>;
  brainSettings: BrainSettings;
  setBrainSettings: (s: BrainSettings) => void;
}

export const TerminalContext = createContext<TerminalContextType | null>(null);

export function useTerminalContext() {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminalContext must be used within TerminalProvider');
  return ctx;
}

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [symbol, setSymbol] = useState('AAPL');
  const [watchlistKey, setWatchlistKey] = useState('DEFAULT');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState('');
  const [chartRange, setChartRange] = useState('6mo');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [time, setTime] = useState('');
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const [searchResults, setSearchResults] = useState<SearchQuote[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [portfolio, setPortfolio] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('blm_portfolio') || '[]'); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertRule[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('blm_alerts') || '[]'); } catch { return []; }
  });
  const [triggeredAlerts, setTriggeredAlerts] = useState<AlertRule[]>([]);
  const [portfolioPositions, setPortfolioPositions] = useState<Position[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('blm_portfolio_positions') || '[]'); } catch { return []; }
  });
  const [customWatchlists, setCustomWatchlists] = useState<CustomWatchlist[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('blm_custom_watchlists') || '[]'); } catch { return []; }
  });
  const [newsFilter, setNewsFilter] = useState({ keyword: '', sources: ['All'] as string[] });
  const [comparisonSymbols, setComparisonSymbols] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [seriesIdMap, setSeriesIdMap] = useState<Record<string, number>>({});
  const [currentSeriesId, setCurrentSeriesId] = useState<number | null>(null);
  const [companyProfile, setCompanyProfile] = useState<GodelCompanyProfile | null>(null);
  const [earnings, setEarnings] = useState<GodelEarningsEntry[] | null>(null);
  const [analystRatings, setAnalystRatings] = useState<GodelAnalystRatingsSummary | null>(null);
  const [optionsChain, setOptionsChain] = useState<GodelOptionsChain | null>(null);
  const [shortInterest, setShortInterest] = useState<GodelShortInterest | null>(null);
  const [dividends, setDividends] = useState<GodelDividend[] | null>(null);
  const [brainSettings, setBrainSettingsState] = useState<BrainSettings>(loadBrainSettings);

  useEffect(() => {
    try { setPortfolio(JSON.parse(localStorage.getItem('blm_portfolio') || '[]')); } catch {}
    // Legacy migration: convert old string[] portfolio to Position[]
    try {
      const old = JSON.parse(localStorage.getItem('blm_portfolio') || '[]');
      if (Array.isArray(old) && old.length > 0 && typeof old[0] === 'string' && portfolioPositions.length === 0) {
        const migrated = old.map((sym: string) => ({
          id: crypto.randomUUID(), symbol: sym, quantity: 0, costBasis: 0,
          dateAdded: new Date().toISOString(),
        }));
        setPortfolioPositions(migrated);
        localStorage.setItem('blm_portfolio_positions', JSON.stringify(migrated));
      }
    } catch {}
  }, []);

  const savePortfolio = useCallback((p: string[]) => {
    setPortfolio(p);
    try { localStorage.setItem('blm_portfolio', JSON.stringify(p)); } catch {}
  }, []);

  const fetchWatchlist = useCallback(async () => {
    try {
      const syms = WATCHLISTS[watchlistKey]?.join(',') ?? WATCHLISTS.DEFAULT.join(',');
      const res = await fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(syms)}`);
      const data = await res.json();
      setWatchlist(((data.items ?? []) as Array<Record<string, unknown>>).map((item) => ({
        symbol: String(item.symbol ?? ''),
        price: item.price != null ? Number(item.price) : null,
        previousClose: item.previousClose != null ? Number(item.previousClose) : null,
        change: item.change != null ? Number(item.change) : null,
        changePercent: item.changePercent != null ? Number(item.changePercent) : null,
        high52w: item.high52w != null ? Number(item.high52w) : null,
        low52w: item.low52w != null ? Number(item.low52w) : null,
      })));
    } catch {}
  }, [watchlistKey]);

  const fetchChart = useCallback(async (sym: string, range: string) => {
    try {
      const res = await fetch(`/api/yfin/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChart({
        symbol: String(data.symbol ?? sym),
        price: data.price != null ? Number(data.price) : null,
        previousClose: data.previousClose != null ? Number(data.previousClose) : null,
        high52w: data.high52w != null ? Number(data.high52w) : null,
        low52w: data.low52w != null ? Number(data.low52w) : null,
        currency: String(data.currency ?? ''),
        exchange: String(data.exchange ?? ''),
        timestamps: (data.timestamps ?? []) as number[],
        open: (data.open ?? []) as number[],
        high: (data.high ?? []) as number[],
        low: (data.low ?? []) as number[],
        close: (data.close ?? []) as number[],
        volume: (data.volume ?? []) as number[],
      });
    } catch {}
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/yfin/news');
      const data = await res.json();
      setNews(((data.items ?? []) as Array<Record<string, unknown>>).map((item) => ({
        title: String(item.title ?? ''),
        link: String(item.link ?? ''),
        pubDate: String(item.pubDate ?? ''),
        source: String(item.source ?? ''),
      })));
    } catch {}
  }, []);

  const searchSymbols = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); setShowSearch(false); return; }
    try {
      const res = await fetch(`/api/yfin/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(((data.quotes ?? []) as Array<Record<string, unknown>>).map((item) => ({
        symbol: String(item.symbol ?? ''),
        name: item.name != null ? String(item.name) : null,
        exchange: item.exchange != null ? String(item.exchange) : null,
        type: item.type != null ? String(item.type) : null,
        score: item.score != null ? Number(item.score) : null,
      })));
      setShowSearch(true);
    } catch { setSearchResults([]); }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWatchlist(), fetchChart(symbol, chartRange), fetchNews()]).then(() => setLoading(false));
  }, []);

  // Symbol change
  useEffect(() => { fetchChart(symbol, chartRange); }, [symbol, chartRange, fetchChart]);

  // Watchlist key change
  useEffect(() => { fetchWatchlist(); }, [watchlistKey, fetchWatchlist]);

  // Refresh quotes + news every 30s
  useEffect(() => {
    const id = setInterval(() => {
      fetchWatchlist();
      fetchNews();
      setMarketOpen(isMarketOpen());
    }, 30000);
    return () => clearInterval(id);
  }, [fetchWatchlist, fetchNews]);

  // Evaluate alerts against watchlist prices
  useEffect(() => {
    if (watchlist.length === 0) return;
    setAlerts((prev) => {
      const nowTriggered: AlertRule[] = [];
      const updated = prev.map((alert) => {
        if (alert.triggered) return alert;
        const item = watchlist.find((w) => w.symbol === alert.symbol);
        if (!item || item.price == null) return alert;
        const breached =
          (alert.condition === 'above' && item.price > alert.threshold) ||
          (alert.condition === 'below' && item.price < alert.threshold);
        if (breached) {
          const triggered = { ...alert, triggered: true };
          nowTriggered.push(triggered);
          return triggered;
        }
        return alert;
      });
      if (nowTriggered.length > 0) {
        // Persist updated alerts
        try { localStorage.setItem('blm_alerts', JSON.stringify(updated)); } catch {}
        // Queue toast notifications
        setTriggeredAlerts((queue) => [...queue, ...nowTriggered]);
      }
      return updated;
    });
  }, [watchlist]);

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Company profile / Godel features are lazy-loaded from panels
  // (no auto-fetch on symbol change — avoids CORS errors)

  const fetchEarnings = useCallback(async (seriesId: number) => {
    return godelGet('/api/v1/earnings', { seriesId: String(seriesId) }) as Promise<GodelEarningsEntry[]>;
  }, []);

  const fetchAnalystRatings = useCallback(async (seriesId: number) => {
    return godelGet('/api/v1/analyst-ratings', { seriesId: String(seriesId) }) as Promise<GodelAnalystRatingsSummary>;
  }, []);

  const fetchOptions = useCallback(async (seriesId: number, strikesAbove = 10, strikesBelow = 10) => {
    return godelPost('api', '/api/v1/optionsv2', {
      series_id: seriesId,
      seriesId: seriesId,
      number_of_strikes_above: strikesAbove,
      number_of_strikes_below: strikesBelow,
      start_expiry: new Date().toISOString(),
      end_expiry: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    }) as Promise<GodelOptionsChain>;
  }, []);

  const fetchShortInterest = useCallback(async (seriesId: number) => {
    return godelPost('api', '/api/v1/shortinterest', { seriesId }) as Promise<GodelShortInterest>;
  }, []);

  const fetchDividends = useCallback(async (seriesId: number) => {
    return godelPost('api', '/api/v1/corporate-actions/dvd', { seriesId }) as Promise<GodelDividend[]>;
  }, []);

  const addToPortfolio = useCallback((sym: string) => {
    if (!portfolio.includes(sym)) savePortfolio([...portfolio, sym]);
  }, [portfolio, savePortfolio]);

  const removeFromPortfolio = useCallback((sym: string) => {
    savePortfolio(portfolio.filter((s) => s !== sym));
  }, [portfolio, savePortfolio]);

  const onSelectSearch = useCallback((s: string) => {
    setSymbol(s); setShowSearch(false); setCommand('');
  }, []);

  const addAlert = useCallback((rule: AlertRule) => {
    setAlerts((prev) => {
      const next = [...prev, rule];
      try { localStorage.setItem('blm_alerts', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      try { localStorage.setItem('blm_alerts', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addPosition = useCallback((symbol: string, quantity: number, costBasis: number) => {
    setPortfolioPositions((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), symbol, quantity, costBasis, dateAdded: new Date().toISOString() }];
      try { localStorage.setItem('blm_portfolio_positions', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removePosition = useCallback((id: string) => {
    setPortfolioPositions((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try { localStorage.setItem('blm_portfolio_positions', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addCustomWatchlist = useCallback((name: string) => {
    setCustomWatchlists((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), name, symbols: [], createdAt: new Date().toISOString() }];
      try { localStorage.setItem('blm_custom_watchlists', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeCustomWatchlist = useCallback((id: string) => {
    setCustomWatchlists((prev) => {
      const next = prev.filter((w) => w.id !== id);
      try { localStorage.setItem('blm_custom_watchlists', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const renameCustomWatchlist = useCallback((id: string, name: string) => {
    setCustomWatchlists((prev) => {
      const next = prev.map((w) => w.id === id ? { ...w, name } : w);
      try { localStorage.setItem('blm_custom_watchlists', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setBrainSettings = useCallback((s: BrainSettings) => {
    setBrainSettingsState(s);
    saveBrainSettings(s);
  }, []);

  // Bridge between registry handlers and the app shell. Panel opens flow
  // through `lastAction` so the tiling manager can place them.
  const execContext: CommandExecutionContext = {
    openPanel: (panelType: PanelType) => setLastAction(`open:${panelType}`),
    setInstrument: (ref) => { setSymbol(ref.symbol); setLastAction(`instrument:${ref.symbol}`); },
    openSecurityFinder: () => setLastAction('open:secf'),
    loadPreset: (presetId) => setLastAction(`preset:${presetId}`),
    addAlert: (sym, condition, threshold) => {
      addAlert({ id: crypto.randomUUID(), symbol: sym, condition, threshold, triggered: false });
      setLastAction(`alert:created:${sym}`);
    },
    addPosition,
    removePositionBySymbol: (sym) => {
      setPortfolioPositions((prev) => {
        const next = prev.filter((p) => p.symbol !== sym);
        try { localStorage.setItem('blm_portfolio_positions', JSON.stringify(next)); } catch {}
        return next;
      });
      setLastAction(`position:removed:${sym}`);
    },
    toggleIndicator: (indicator) => {
      setComparisonSymbols((prev) => prev.includes(indicator) ? prev.filter((s) => s !== indicator) : [...prev, indicator]);
      setLastAction(`toggle:${indicator.toLowerCase()}`);
    },
    exportData: (format, scope) => setLastAction(`export:${format}:${scope}`),
    openModal: (modal) => setLastAction(`open:${modal === 'workspace' ? 'workspace-modal' : modal}`),
    addCustomWatchlist,
    deleteCustomWatchlist: (name) => {
      const target = customWatchlists.find((w) => w.name.toUpperCase() === name.toUpperCase());
      if (target) removeCustomWatchlist(target.id);
    },
    renameCustomWatchlist: (oldName, newName) => {
      const target = customWatchlists.find((w) => w.name.toUpperCase() === oldName.toUpperCase());
      if (target) renameCustomWatchlist(target.id, newName);
    },
    setWatchlistKey,
    saveWorkspace: (name) => setLastAction(`workspace:save:${name}`),
    loadWorkspace: (name) => setLastAction(`workspace:load:${name}`),
    deleteWorkspace: (name) => setLastAction(`workspace:delete:${name}`),
    listWorkspaces: () => setLastAction('open:workspace-modal'),
    notify: (message, level) => setLastAction(`notify:${level ?? 'info'}:${message}`),
    brainCompare: (symbols) => setLastAction(`brain:compare:${symbols.join(',')}`),
  };

  const handleCommand = useCallback(() => {
    const cmd = command.trim();
    if (!cmd) return;
    setCommand('');
    setShowSearch(false);

    const ast = parseCommand(cmd, commandRegistry.matchableTokens());

    if (ast.kind === 'EMPTY') return;

    if (ast.kind === 'INSTRUMENT') {
      setSymbol(ast.instrument.symbol);
      if (ast.mnemonic) {
        const def = commandRegistry.get(ast.mnemonic);
        if (def?.handler) {
          def.handler({ args: [], target: ast.instrument, raw: cmd }, execContext);
          return;
        }
      }
      setLastAction(null);
      return;
    }

    // COMMAND node
    const def = commandRegistry.get(ast.mnemonic);
    if (def) {
      def.handler?.(
        { args: ast.args, target: ast.target, subcommand: ast.subcommand, raw: cmd },
        execContext,
      );
      return;
    }

    // Watchlist keys remain directly addressable (DEFAULT / SECTORS / custom names)
    const wlKey = WATCHLIST_KEYS.find((k) => k === ast.mnemonic);
    if (wlKey) { setWatchlistKey(wlKey); return; }
    const customWl = customWatchlists.find((w) => w.name.toUpperCase() === ast.mnemonic);
    if (customWl) { setWatchlistKey(customWl.name); return; }

    const suggestion = suggestMnemonic(ast.mnemonic, [...commandRegistry.matchableTokens()]);
    setLastAction(suggestion ? `unknown:${ast.mnemonic}:${suggestion}` : `unknown:${ast.mnemonic}:`);
  }, [command, customWatchlists, execContext]);

  const value: TerminalContextType = {
    symbol, setSymbol,
    watchlistKey, setWatchlistKey,
    watchlist,
    chart,
    news,
    loading,
    command, setCommand, handleCommand,
    searchResults, showSearch, setShowSearch,
    onSearchChange: searchSymbols, onSelectSearch,
    chartRange, setChartRange,
    chartType, setChartType,
    time, marketOpen,
    portfolio, addToPortfolio, removeFromPortfolio,
    inputRef,
    selectedArticle, setSelectedArticle,
    alerts, addAlert, removeAlert,
    triggeredAlerts,
    portfolioPositions, addPosition, removePosition,
    customWatchlists, addCustomWatchlist, removeCustomWatchlist, renameCustomWatchlist,
    newsFilter, setNewsFilter,
    comparisonSymbols, setComparisonSymbols,
    lastAction, setLastAction,
    seriesIdMap, currentSeriesId,
    companyProfile, earnings, analystRatings, optionsChain, shortInterest, dividends,
    fetchEarnings, fetchAnalystRatings, fetchOptions, fetchShortInterest, fetchDividends,
    brainSettings, setBrainSettings,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}
