/**
 * Capability-based provider contracts.
 *
 * Market-data and research consumers program against these interfaces, never
 * against concrete vendors. The provider registry (provider-registry.ts)
 * dispatches over ranked implementations with fallback, and every result
 * carries a `DataProvenance` record.
 */

import type { InstrumentRef } from '@/lib/types/instrument';
import type { DataProvenance } from '@/lib/types/provenance';

// ---------------------------------------------------------------------------
// Shared result envelopes
// ---------------------------------------------------------------------------

export interface Bar {
  /** Epoch milliseconds */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type BarTimeframe = '1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1mo';

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

export interface OptionStrikeRow {
  strike: number;
  expiration: string;

  callBid?: number;
  callAsk?: number;
  callLast?: number;
  callVolume?: number;
  callOpenInterest?: number;
  callIv?: number;
  callDelta?: number;
  callGamma?: number;
  callTheta?: number;
  callVega?: number;
  callRho?: number;

  putBid?: number;
  putAsk?: number;
  putLast?: number;
  putVolume?: number;
  putOpenInterest?: number;
  putIv?: number;
  putDelta?: number;
  putGamma?: number;
  putTheta?: number;
  putVega?: number;
  putRho?: number;
}

export interface OptionsChainResult {
  expirations: string[];
  strikes: OptionStrikeRow[];
  provenance: DataProvenance;
}

export interface StatementLine {
  /** Stable machine key, e.g. "revenue", "netIncome" */
  key: string;
  label: string;
  /** Value per period, keyed by period label e.g. "FY2024", "Q3 2025" */
  values: Record<string, number | null>;
  /** For common-size analysis: divide by this line's key ("revenue" or "totalAssets") */
  percentOf?: string;
  indent?: number;
}

export interface StandardizedStatement {
  statementType: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';
  /** Period labels oldest → newest, e.g. ["FY2021", "FY2022", "FY2023"] */
  periods: string[];
  periodType: 'ANNUAL' | 'QUARTERLY' | 'TTM';
  currency: string;
  lines: StatementLine[];
  provenance: DataProvenance;
}

export type StatementType = StandardizedStatement['statementType'];
export type StatementPeriod = 'ANNUAL' | 'QUARTERLY' | 'TTM';

export interface TranscriptSegment {
  id: string;
  speakerName: string;
  speakerRole: 'EXECUTIVE' | 'ANALYST' | 'OPERATOR';
  speakerCompany?: string;
  section: 'PREPARED_REMARKS' | 'Q_AND_A';
  text: string;
  paragraphIndex: number;
}

export interface TranscriptMetadata {
  id: string;
  instrument: InstrumentRef;
  /** e.g. "Q3 2025" */
  quarterLabel: string;
  callDate: string;
  title: string;
  participantCount?: number;
  wordCount?: number;
  sourceUrl?: string;
}

export interface StructuredTranscript {
  metadata: TranscriptMetadata;
  segments: TranscriptSegment[];
  provenance: DataProvenance;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  tickers: string[];
  /** e.g. "earnings", "macro", "m&a" */
  category?: string;
  /** Publisher-flagged urgency; banner alerts only fire for "high" */
  urgency?: 'high' | 'medium' | 'low';
}

export interface NewsQuery {
  tickers?: string[];
  keyword?: string;
  excludeKeywords?: string[];
  categories?: string[];
  sources?: string[];
  limit?: number;
  cursor?: string;
}

export interface FilingSummary {
  accessionNumber: string;
  instrument: InstrumentRef;
  formType: string;
  filedAt: string;
  reportDate?: string;
  primaryDocument: string;
  primaryDocUrl: string;
  description?: string;
  sizeBytes?: number;
}

export interface FilingDocument {
  summary: FilingSummary;
  /** Sanitized HTML body of the primary document */
  html: string;
  sections: FilingSection[];
  provenance: DataProvenance;
}

export interface FilingSection {
  id: string;
  title: string;
  /** Anchor id within the rendered document */
  anchor: string;
}

export interface BrokerageAccount {
  id: string;
  brokerName: string;
  displayName: string;
  type: 'INDIVIDUAL' | 'IRA' | 'ROTH' | 'MARGIN' | 'CASH' | 'OTHER';
  currency: string;
}

export interface BrokeragePositionLot {
  id: string;
  accountId: string;
  instrument: InstrumentRef;
  quantity: number;
  costBasisPerUnit: number;
  openedAt?: string;
}

export interface BrokerageBalance {
  accountId: string;
  cash: number;
  equity: number;
  marketValue: number;
  asOf: string;
}

// ---------------------------------------------------------------------------
// Capability interfaces
// ---------------------------------------------------------------------------

export interface IQuoteProvider {
  readonly id: string;
  readonly displayName: string;
  getQuote(instrument: InstrumentRef): Promise<QuoteResult>;
  getQuotes(instruments: InstrumentRef[]): Promise<QuoteResult[]>;
}

export interface IHistoricalBarsProvider {
  readonly id: string;
  readonly displayName: string;
  getBars(
    instrument: InstrumentRef,
    timeframe: BarTimeframe,
    from: number,
    to: number,
    adjusted?: boolean,
  ): Promise<{ bars: Bar[]; provenance: DataProvenance }>;
}

export interface IOptionsProvider {
  readonly id: string;
  readonly displayName: string;
  getOptionsChain(
    instrument: InstrumentRef,
    expiration?: string,
    strikesRange?: { min?: number; max?: number },
  ): Promise<OptionsChainResult>;
}

export interface IFinancialStatementsProvider {
  readonly id: string;
  readonly displayName: string;
  getStatements(
    instrument: InstrumentRef,
    statementType: StatementType,
    period: StatementPeriod,
    limit?: number,
  ): Promise<{ statements: StandardizedStatement[]; provenance: DataProvenance }>;
}

export interface ITranscriptsProvider {
  readonly id: string;
  readonly displayName: string;
  getTranscriptsList(instrument: InstrumentRef): Promise<{ transcripts: TranscriptMetadata[]; provenance: DataProvenance }>;
  getTranscript(transcriptId: string): Promise<StructuredTranscript>;
}

export interface INewsProvider {
  readonly id: string;
  readonly displayName: string;
  getNews(query: NewsQuery): Promise<{ items: NewsArticle[]; total: number; nextCursor?: string; provenance: DataProvenance }>;
}

export interface IFilingsProvider {
  readonly id: string;
  readonly displayName: string;
  getFilings(instrument: InstrumentRef, forms?: string[]): Promise<{ filings: FilingSummary[]; provenance: DataProvenance }>;
  getFilingDocument(summary: FilingSummary): Promise<FilingDocument>;
}

export interface IBrokerageProvider {
  readonly id: string;
  readonly displayName: string;
  /** Aggregator identifier, e.g. "snaptrade", "plaid" */
  readonly aggregator: string;
  listAccounts(): Promise<{ accounts: BrokerageAccount[]; provenance: DataProvenance }>;
  getPositions(accountId: string): Promise<{ lots: BrokeragePositionLot[]; provenance: DataProvenance }>;
  getBalances(accountId: string): Promise<{ balances: BrokerageBalance[]; provenance: DataProvenance }>;
}

/** Marker so registries can name each capability slot uniformly. */
export type ProviderCapability =
  | 'quotes'
  | 'historicalBars'
  | 'options'
  | 'financialStatements'
  | 'transcripts'
  | 'news'
  | 'filings'
  | 'brokerage';

export type AnyProvider =
  | IQuoteProvider
  | IHistoricalBarsProvider
  | IOptionsProvider
  | IFinancialStatementsProvider
  | ITranscriptsProvider
  | INewsProvider
  | IFilingsProvider
  | IBrokerageProvider;
