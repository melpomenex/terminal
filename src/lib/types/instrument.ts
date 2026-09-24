/**
 * Canonical cross-asset instrument master model.
 *
 * Every tradeable or observable asset in Qube Terminal is represented by an
 * `Instrument` (full security-master record) or a lightweight `InstrumentRef`
 * (what panels, watchlists, alerts, and AI tools pass around). Asset identity
 * is provider-agnostic: provider-specific symbols live in `providerMappings`.
 */

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
export type ExerciseStyle = 'AMERICAN' | 'EUROPEAN';

export interface CanonicalIdentifiers {
  /** Financial Instrument Global Identifier */
  figi?: string;
  /** Composite FIGI for equity */
  compositeFigi?: string;
  /** International Securities Identification Number */
  isin?: string;
  /** Committee on Uniform Securities Identification Procedures */
  cusip?: string;
  /** Stock Exchange Daily Official List */
  sedol?: string;
  /** Canonical root symbol (e.g. "AAPL", "SPX") */
  ticker: string;
  /** Formatted terminal display (e.g. "AAPL US Equity") */
  displaySymbol: string;
  /** ISO 10383 Market Identifier Code (e.g. "XNAS", "XNYS") */
  mic: string;
  /** ISO 4217 currency code (e.g. "USD", "EUR") */
  currency: string;
  /** ISO 3166-1 alpha-2 country (e.g. "US", "DE") */
  country: string;
}

export interface OptionDetails {
  underlyingInstrumentId: string;
  strikePrice: number;
  /** ISO YYYY-MM-DD */
  expirationDate: string;
  optionType: OptionType;
  /** Standard: 100 */
  contractMultiplier: number;
  settlementType: SettlementType;
  exerciseStyle: ExerciseStyle;
  /** Options Symbology Initiative format (e.g. "AAPL  260515C00200000") */
  osiSymbol: string;
}

export interface FutureDetails {
  underlyingSymbol: string;
  /** e.g. "2026-12" */
  contractMonth: string;
  contractYear: number;
  expirationDate: string;
  contractSize: number;
  tickSize: number;
  settlementCurrency: string;
}

export interface BondDetails {
  issuerName: string;
  /** e.g. 4.25 for 4.25% */
  couponRate: number;
  maturityDate: string;
  yieldToMaturity?: number;
  /** e.g. "Aaa", "BBB+" */
  rating?: string;
}

export interface TradingHours {
  regularStart: string;
  regularEnd: string;
  hasPreMarket: boolean;
  hasPostMarket: boolean;
}

export interface Instrument {
  /** Global unique ID: "EQUITY:XNAS:AAPL" or "OPTION:OCC:AAPL260515C00200000" */
  id: string;
  assetClass: AssetClass;
  /** e.g. "Apple Inc." */
  name: string;
  description?: string;
  identifiers: CanonicalIdentifiers;
  primaryExchange: string;
  /** IANA tz, e.g. "America/New_York" */
  timezone: string;
  tradingHours: TradingHours;
  sector?: string;
  industry?: string;
  active: boolean;

  optionDetails?: OptionDetails;
  futureDetails?: FutureDetails;
  bondDetails?: BondDetails;

  /** Cross-listing relationships */
  primaryInstrumentId?: string;
  alternateListingIds?: string[];
  /** e.g. ["GOOG", "GOOGL"] or ["BRK.A", "BRK.B"] */
  shareClasses?: string[];

  /** Provider mapping metadata: { "yahoo": "AAPL", "polygon": "AAPL" } */
  providerMappings: Record<string, string>;
}

/**
 * Lightweight provider-agnostic instrument reference. Panels, watchlists,
 * alerts, portfolio positions, and AI tools reference instruments through
 * this shape rather than raw ticker strings.
 */
export interface InstrumentRef {
  id: string;
  symbol: string;
  displaySymbol: string;
  assetClass: AssetClass;
  name?: string;
  exchange?: string;
}

/** Convenience factory for equity-style refs from a plain ticker string. */
export function makeEquityRef(ticker: string, name?: string, mic = 'XNAS'): InstrumentRef {
  return {
    id: `EQUITY:${mic}:${ticker}`,
    symbol: ticker,
    displaySymbol: `${ticker} US Equity`,
    assetClass: 'EQUITY',
    name,
    exchange: mic,
  };
}

/** Common ISO 10383 MICs used for fallback mapping. */
export const KNOWN_MIC_BY_SUFFIX: Record<string, string> = {
  L: 'XLON',
  TO: 'XTKS',
  T: 'XTKS',
  DE: 'XETR',
  F: 'XFRA',
  PA: 'XPAR',
  AS: 'XAMS',
  MI: 'XMIL',
  SW: 'XSWX',
  HK: 'XHKG',
  SS: 'XSHG',
  SZ: 'XSHE',
  KS: 'XKRX',
  AX: 'XASX',
  CN: 'XTSE',
  BO: 'XBOM',
  NS: 'XNSE',
  MX: 'XMEX',
  BM: 'BATS',
};

