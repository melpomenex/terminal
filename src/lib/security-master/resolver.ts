/**
 * SecurityMasterResolver — translates human-entered ticker strings,
 * Bloomberg-style mnemonics, OSI options symbology, and composite symbols
 * into canonical `InstrumentRef` instances.
 *
 * Resolution is fully deterministic and offline: a curated static master
 * covers major indices, FX majors, sovereign yield benchmarks, commodities
 * and popular dual-class listings; everything else is classified by
 * symbology rules. A remote search layer (SECF) can later enrich results,
 * but the resolver itself never blocks on the network.
 */

import type { AssetClass, InstrumentRef } from '@/lib/types/instrument';

// ---------------------------------------------------------------------------
// Static reference master
// ---------------------------------------------------------------------------

interface MasterEntry {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  mic: string;
  currency: string;
  /** Yahoo Finance mapping, e.g. "^GSPC" */
  yahoo?: string;
  aliases?: string[];
}

const MASTER: MasterEntry[] = [
  // Indices
  { symbol: 'SPX', name: 'S&P 500 Index', assetClass: 'INDEX', mic: 'XCBF', currency: 'USD', yahoo: '^GSPC', aliases: ['GSPC', 'S&P500'] },
  { symbol: 'NDX', name: 'Nasdaq 100 Index', assetClass: 'INDEX', mic: 'XCBF', currency: 'USD', yahoo: '^NDX', aliases: ['NASDAQ100'] },
  { symbol: 'DJI', name: 'Dow Jones Industrial Average', assetClass: 'INDEX', mic: 'XCBF', currency: 'USD', yahoo: '^DJI', aliases: ['DJIA'] },
  { symbol: 'RUT', name: 'Russell 2000 Index', assetClass: 'INDEX', mic: 'XCBF', currency: 'USD', yahoo: '^RUT' },
  { symbol: 'VIX', name: 'CBOE Volatility Index', assetClass: 'INDEX', mic: 'XCBF', currency: 'USD', yahoo: '^VIX' },
  { symbol: 'SX5E', name: 'Euro Stoxx 50', assetClass: 'INDEX', mic: 'XPAR', currency: 'EUR', yahoo: '^STOXX50E' },
  { symbol: 'UKX', name: 'FTSE 100', assetClass: 'INDEX', mic: 'XLON', currency: 'GBP', yahoo: '^FTSE' },
  { symbol: 'NKY', name: 'Nikkei 225', assetClass: 'INDEX', mic: 'XTKS', currency: 'JPY', yahoo: '^N225' },
  { symbol: 'DAX', name: 'DAX Index', assetClass: 'INDEX', mic: 'XETR', currency: 'EUR', yahoo: '^GDAXI' },
  { symbol: 'HSI', name: 'Hang Seng Index', assetClass: 'INDEX', mic: 'XHKG', currency: 'HKD', yahoo: '^HSI' },

  // FX majors
  { symbol: 'EURUSD', name: 'Euro / US Dollar', assetClass: 'FX', mic: 'GEN', currency: 'USD', yahoo: 'EURUSD=X', aliases: ['EUR/USD'] },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', assetClass: 'FX', mic: 'GEN', currency: 'USD', yahoo: 'GBPUSD=X', aliases: ['GBP/USD', 'CABLE'] },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', assetClass: 'FX', mic: 'GEN', currency: 'JPY', yahoo: 'USDJPY=X', aliases: ['USD/JPY'] },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', assetClass: 'FX', mic: 'GEN', currency: 'CHF', yahoo: 'USDCHF=X', aliases: ['USD/CHF'] },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', assetClass: 'FX', mic: 'GEN', currency: 'USD', yahoo: 'AUDUSD=X', aliases: ['AUD/USD'] },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', assetClass: 'FX', mic: 'GEN', currency: 'CAD', yahoo: 'USDCAD=X', aliases: ['USD/CAD'] },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', assetClass: 'FX', mic: 'GEN', currency: 'USD', yahoo: 'NZDUSD=X', aliases: ['NZD/USD'] },
  { symbol: 'DXY', name: 'US Dollar Index', assetClass: 'FX', mic: 'GEN', currency: 'USD', yahoo: 'DX-Y.NYB' },

  // Sovereign yield benchmarks
  { symbol: 'US02Y', name: 'US 2-Year Treasury Yield', assetClass: 'BOND_GOVT', mic: 'GEN', currency: 'USD', yahoo: '^TNX', aliases: ['2Y'] },
  { symbol: 'US10Y', name: 'US 10-Year Treasury Yield', assetClass: 'BOND_GOVT', mic: 'GEN', currency: 'USD', aliases: ['10Y'] },
  { symbol: 'US30Y', name: 'US 30-Year Treasury Yield', assetClass: 'BOND_GOVT', mic: 'GEN', currency: 'USD', aliases: ['30Y'] },
  { symbol: 'DE10Y', name: 'Germany 10-Year Bund Yield', assetClass: 'BOND_GOVT', mic: 'GEN', currency: 'EUR', aliases: ['BUND'] },
  { symbol: 'JP10Y', name: 'Japan 10-Year JGB Yield', assetClass: 'BOND_GOVT', mic: 'GEN', currency: 'JPY', aliases: ['JGB'] },

  // Commodities / futures fronts
  { symbol: 'CL1', name: 'WTI Crude Oil Front Month', assetClass: 'FUTURE', mic: 'XCME', currency: 'USD', yahoo: 'CL=F', aliases: ['WTI'] },
  { symbol: 'CO1', name: 'Brent Crude Front Month', assetClass: 'FUTURE', mic: 'XICE', currency: 'USD', yahoo: 'BZ=F', aliases: ['BRENT'] },
  { symbol: 'GC1', name: 'Gold Front Month', assetClass: 'FUTURE', mic: 'XCEC', currency: 'USD', yahoo: 'GC=F', aliases: ['GOLD'] },
  { symbol: 'SI1', name: 'Silver Front Month', assetClass: 'FUTURE', mic: 'XCEC', currency: 'USD', yahoo: 'SI=F', aliases: ['SILVER'] },
  { symbol: 'NG1', name: 'Natural Gas Front Month', assetClass: 'FUTURE', mic: 'XCME', currency: 'USD', yahoo: 'NG=F' },
  { symbol: 'HG1', name: 'Copper Front Month', assetClass: 'FUTURE', mic: 'XCMX', currency: 'USD', yahoo: 'HG=F', aliases: ['COPPER'] },
  { symbol: 'ES1', name: 'E-mini S&P 500 Front Month', assetClass: 'FUTURE', mic: 'XCME', currency: 'USD', yahoo: 'ES=F' },
  { symbol: 'NQ1', name: 'E-mini Nasdaq 100 Front Month', assetClass: 'FUTURE', mic: 'XCME', currency: 'USD', yahoo: 'NQ=F' },

  // Popular ETFs (high traffic; gives SECF instant metadata)
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetClass: 'ETF', mic: 'XASE', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: 'ETF', mic: 'XNAS', currency: 'USD' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', assetClass: 'ETF', mic: 'XASE', currency: 'USD' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', assetClass: 'ETF', mic: 'XASE', currency: 'USD' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', assetClass: 'ETF', mic: 'XASE', currency: 'USD' },
];

/** Well-known dual/multi share classes: any spelling resolves to a canonical set. */
const SHARE_CLASSES: Record<string, string[]> = {
  'BRK': ['BRK-A', 'BRK-B'],
  'GOOG': ['GOOG', 'GOOGL'],
  'GOOGL': ['GOOGL', 'GOOG'],
};

const CRYPTO_COINS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT', 'MATIC', 'LTC', 'BCH']);

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export interface ResolveOptions {
  /** Hint asset class when ambiguity exists (e.g. from SECF filter pills). */
  preferAssetClass?: AssetClass;
  /** Exchange MIC hint, e.g. "XLON" from an ALLQ row. */
  mic?: string;
}

const CURRENCY_RE = /^[A-Z]{3}$/;
const FX_PAIR_RE = /^([A-Z]{3})([A-Z]{3})$/;

export class SecurityMasterResolver {
  private bySymbol = new Map<string, MasterEntry>();
  private byAlias = new Map<string, MasterEntry>();
  private byYahoo = new Map<string, MasterEntry>();

  constructor(entries: MasterEntry[] = MASTER) {
    for (const e of entries) {
      this.bySymbol.set(e.symbol, e);
      this.byYahoo.set(e.yahoo ?? e.symbol, e);
      for (const a of e.aliases ?? []) this.byAlias.set(a, e);
    }
  }

  /** Full static master (used by SECF offline results and ALLQ). */
  entries(): MasterEntry[] {
    return [...this.bySymbol.values()];
  }

  /**
   * Parse any user-entered string into a canonical `InstrumentRef`.
   * Returns `null` when the input cannot be classified at all.
   */
  resolve(input: string, opts: ResolveOptions = {}): InstrumentRef | null {
    const raw = input.trim();
    if (!raw) return null;
    const upper = raw.toUpperCase();

    // Strip Bloomberg-style suffixes: "AAPL US Equity", "EURUSD Curncy", "CL1 Comdty"
    const mnemonic = upper.match(/^([A-Z0-9.\-/^=]{1,12})(?:\s+(?:US\s+)?(?:EQUITY|CURNCY|COMDTY|INDEX|GOVT|CORP|CMDTY))?$/i);
    const core = mnemonic?.[1] ?? upper;

    // 1. Yahoo-composite conventions first (they're unambiguous)
    let ref = this.resolveYahooComposite(core, opts);
    if (ref) return ref;

    // 2. OSI / human options symbology: "AAPL 260515C00200000", "AAPL 260515 C 200"
    ref = this.resolveOption(core === upper ? raw : core, upper);
    if (ref) return ref;

    // 3. Static master (indices, FX, yields, futures fronts)
    const entry = this.bySymbol.get(core) ?? this.byAlias.get(core) ?? this.byYahoo.get(core);
    if (entry) {
      return {
        id: `${entry.assetClass}:${entry.mic}:${entry.symbol}`,
        symbol: entry.symbol,
        displaySymbol: this.displayFor(entry.assetClass, entry.symbol, entry.mic),
        assetClass: entry.assetClass,
        name: entry.name,
        exchange: entry.mic,
      };
    }

    // 4. Share-class normalization: BRK.B / BRK-B / BRK/B -> BRK-B
    const shareRoot = core.replace(/[.\-/].*$/, '');
    if (SHARE_CLASSES[shareRoot]) {
      const canonical = core.replace(/\./, '-').replace(/\//, '-');
      const normalized = SHARE_CLASSES[shareRoot].includes(canonical)
        ? canonical
        : SHARE_CLASSES[shareRoot][SHARE_CLASSES[shareRoot].length - 1];
      return {
        id: `EQUITY:${opts.mic ?? 'XNYS'}:${normalized}`,
        symbol: normalized,
        displaySymbol: `${normalized} US Equity`,
        assetClass: 'EQUITY',
        name: shareRoot === 'BRK' ? 'Berkshire Hathaway Inc.' : 'Alphabet Inc.',
        exchange: opts.mic ?? 'XNYS',
      };
    }

    // 5. FX pairs: EURUSD, EUR/USD, EUR-USD
    const fx = core.replace(/[\/\-]/g, '');
    const fxMatch = fx.match(FX_PAIR_RE);
    if (fxMatch && (CURRENCY_RE.test(fxMatch[1]) && CURRENCY_RE.test(fxMatch[2])) && this.isKnownPair(fx)) {
      return {
        id: `FX:GEN:${fx}`,
        symbol: fx,
        displaySymbol: `${fx} Curncy`,
        assetClass: 'FX',
        name: `${fxMatch[1]} / ${fxMatch[2]}`,
        exchange: 'GEN',
      };
    }

    // 6. Crypto: BTC-USD, BTCUSD, ETH-USD
    const crypto = core.match(/^([A-Z]{2,6})(?:-?USD)$/);
    if (crypto && CRYPTO_COINS.has(crypto[1])) {
      return {
        id: `CRYPTO:CCMP:${crypto[1]}-USD`,
        symbol: `${crypto[1]}-USD`,
        displaySymbol: `${crypto[1]}-USD`,
        assetClass: 'CRYPTO',
        name: `${crypto[1]} / USD`,
        exchange: 'CCMP',
      };
    }

    // 7. Sovereign yields: US10Y, DE10Y handled by master; generic "XX#Y"
    const genericYield = core.match(/^([A-Z]{2})(\d{2})Y$/);
    if (genericYield) {
      return {
        id: `BOND_GOVT:GEN:${core}`,
        symbol: core,
        displaySymbol: `${core} Govt`,
        assetClass: 'BOND_GOVT',
        exchange: 'GEN',
      };
    }

    // 8. Plain equity ticker (1-6 letters, digits allowed for class B style "BF-B")
    if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(core) && !/^\d+$/.test(core)) {
      const assetClass: AssetClass = opts.preferAssetClass ?? 'EQUITY';
      const mic = opts.mic ?? 'XNAS';
      return {
        id: `${assetClass}:${mic}:${core}`,
        symbol: core,
        displaySymbol: `${core} US Equity`,
        assetClass,
        exchange: mic,
      };
    }

    return null;
  }

  /** Resolve a Yahoo-flavored composite: ^GSPC, BTC-USD, EURUSD=X, CL=F, AAPL */
  private resolveYahooComposite(core: string, opts: ResolveOptions): InstrumentRef | null {
    // ^INDEX
    if (core.startsWith('^')) {
      const hit = this.byYahoo.get(core);
      const symbol = hit?.symbol ?? core.slice(1);
      return {
        id: `INDEX:${hit?.mic ?? 'XCBF'}:${symbol}`,
        symbol,
        displaySymbol: `${symbol} Index`,
        assetClass: 'INDEX',
        name: hit?.name,
        exchange: hit?.mic ?? 'XCBF',
      };
    }
    // FX "=X" suffix
    if (core.endsWith('=X')) {
      const pair = core.slice(0, -2);
      return this.resolve(pair, opts);
    }
    // Futures "=F" suffix
    if (core.endsWith('=F')) {
      const root = core.slice(0, -2);
      return {
        id: `FUTURE:XCME:${root}1`,
        symbol: `${root}1`,
        displaySymbol: `${root}1 Comdty`,
        assetClass: 'FUTURE',
        exchange: 'XCME',
      };
    }
    // Spot crypto already has "-USD" form; handled below in resolve()
    return null;
  }

  /** Parse "AAPL 260515C00200000" (OSI) or "AAPL 260515 C 200" (human). */
  private resolveOption(rawInput: string, upperInput: string): InstrumentRef | null {
    const s = upperInput.trim();

    // OSI: ROOT + YYMMDD + C/P + 8-digit strike*1000
    const osi = s.match(/^([A-Z]{1,6})\s*(\d{6})([CP])(\d{8})$/);
    if (osi) {
      const [, root, date, cp, strikeStr] = osi;
      return this.optionRef(root, date, cp as 'C' | 'P', parseInt(strikeStr, 10) / 1000);
    }

    // Human: "AAPL 260515 C 200" / "AAPL 2026-05-15 CALL 200"
    const human = s.match(/^([A-Z]{1,6})\s+(\d{6}|\d{4}-\d{2}-\d{2})\s+(C|P|CALL|PUT)\s+([\d.]+)$/);
    if (human) {
      const [, root, date, cpRaw, strikeStr] = human;
      const cp = cpRaw.startsWith('C') ? 'C' : 'P';
      const yymmdd = date.includes('-') ? date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10) : date;
      return this.optionRef(root, yymmdd, cp, parseFloat(strikeStr));
    }
    return null;
  }

  private optionRef(root: string, yymmdd: string, cp: 'C' | 'P', strike: number): InstrumentRef {
    const osiSymbol = `${root.padEnd(6, ' ')}${yymmdd}${cp}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
    const isoDate = `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
    return {
      id: `OPTION:OCC:${root}${yymmdd}${cp}${String(Math.round(strike * 1000)).padStart(8, '0')}`,
      symbol: `${root} ${yymmdd}${cp}${String(Math.round(strike * 1000)).padStart(8, '0')}`,
      displaySymbol: `${root} ${isoDate} ${cp === 'C' ? 'Call' : 'Put'} ${strike.toFixed(2).replace(/\.?0+$/, '')}`,
      assetClass: 'OPTION',
      name: `${root} ${cp === 'C' ? 'Call' : 'Put'} $${strike} exp ${isoDate}`,
      exchange: 'OCC',
    };
  }

  private isKnownPair(pair: string): boolean {
    if (this.bySymbol.has(pair)) return true;
    const m = pair.match(FX_PAIR_RE);
    if (!m) return false;
    const majors = new Set(['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD', 'CNH', 'SEK', 'NOK', 'MXN', 'ZAR', 'SGD', 'HKD', 'TRY', 'PLN']);
    return majors.has(m[1]) && majors.has(m[2]);
  }

  private displayFor(assetClass: AssetClass, symbol: string, mic: string): string {
    switch (assetClass) {
      case 'FX': return `${symbol} Curncy`;
      case 'FUTURE': return `${symbol} Comdty`;
      case 'BOND_GOVT': return `${symbol} Govt`;
      case 'INDEX': return `${symbol} Index`;
      case 'CRYPTO': return symbol;
      default: return `${symbol} ${mic === 'XNAS' || mic === 'XNYS' ? 'US' : mic} Equity`;
    }
  }

  /**
   * Fuzzy-score a query against the master + generic tickers for SECF.
   * Higher is better; 0 means no match.
   */
  fuzzyScore(query: string, candidate: string): number {
    const q = query.toLowerCase();
    const c = candidate.toLowerCase();
    if (!q) return 0;
    if (c === q) return 100;
    if (c.startsWith(q)) return 80;
    const idx = c.indexOf(q);
    if (idx >= 0) return 60 - idx;
    // Subsequence match (e.g. "aapl" vs "Apple Inc.")
    let ci = 0;
    for (const ch of q) {
      ci = c.indexOf(ch, ci);
      if (ci === -1) return 0;
      ci += 1;
    }
    return 25;
  }
}

export const securityMasterResolver = new SecurityMasterResolver();

/** Coerce any string into an InstrumentRef, falling back to an EQUITY guess. */
export function resolveToRef(input: string, opts?: ResolveOptions): InstrumentRef {
  return (
    securityMasterResolver.resolve(input, opts) ?? {
      id: `EQUITY:XNAS:${input.toUpperCase()}`,
      symbol: input.toUpperCase(),
      displaySymbol: `${input.toUpperCase()} US Equity`,
      assetClass: 'EQUITY',
    }
  );
}
