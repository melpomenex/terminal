import { execSync } from 'node:child_process';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SEC_UA = 'Terminal Bot contact@example.com';
const SEC_ARGS = [
  '-H', `User-Agent: ${SEC_UA}`,
  '-H', 'Accept: application/json',
  '--compressed', '-s', '--max-time', '20',
];

/* ------------------------------------------------------------------ */
/*  In-memory cache                                                    */
/* ------------------------------------------------------------------ */

interface CacheEntry { data: unknown; expires: number }
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

/* 100 ms spacing to respect 10 req/s rate limit */
let lastRequest = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const gap = 100 - (now - lastRequest);
  if (gap > 0) await new Promise<void>((r) => setTimeout(r, gap));
  lastRequest = Date.now();
}

/* ------------------------------------------------------------------ */
/*  Core SEC GET with curl                                             */
/* ------------------------------------------------------------------ */

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function secGet(url: string, ttlMs = 300_000): Promise<any> {
  const cached = getCached(url);
  if (cached != null) return cached;

  await throttle();

  const args = [...SEC_ARGS, '-w', '\n%{http_code}', url];
  const cmd = `curl ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`;

  const raw = execSync(cmd, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 25_000,
    encoding: 'utf-8',
  });

  const nl = raw.lastIndexOf('\n');
  const body = raw.substring(0, nl);
  const code = raw.substring(nl + 1).trim();

  if (code === '429') throw new Error('SEC rate limited');
  if (code !== '200') throw new Error(`SEC HTTP ${code} for ${url}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`SEC invalid JSON from ${url}`);
  }

  setCache(url, parsed, ttlMs);
  return parsed;
}

/* ------------------------------------------------------------------ */
/*  TypeScript interfaces                                              */
/* ------------------------------------------------------------------ */

export interface SECFiling {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
  primaryDocDescription: string;
  entityName: string;
  cik: string;
}

export interface InsiderTransaction {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportingName: string;
  reportingTitle: string;
  transactionDate: string;
  transactionCode: string;        // P = Purchase, S = Sale
  securitiesOwned: number;
  shares: number;
  price: number | null;
  totalValue: number | null;
}

export interface InstitutionalHolder {
  cik: string;
  name: string;
  sharesHeld: number;
  value: number;
  pctPortfolio: number | null;
  change: number;
  pctChange: number | null;
  reportDate: string;
}

export interface CompanyInfo {
  cik: string;
  ticker: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Ticker-to-CIK mapping                                             */
/* ------------------------------------------------------------------ */

type TickerMap = Record<string, { cik_str: string; ticker: string; title: string }>;
let tickerMap: TickerMap | null = null;
let tickerMapPromise: Promise<TickerMap> | null = null;

async function loadTickerMap(): Promise<TickerMap> {
  if (tickerMap) return tickerMap;
  if (tickerMapPromise) return tickerMapPromise;

  tickerMapPromise = (async () => {
    const raw = await secGet('https://www.sec.gov/files/company_tickers.json', 900_000);
    tickerMap = raw as TickerMap;
    return tickerMap;
  })();

  return tickerMapPromise;
}

export async function tickerToCik(ticker: string): Promise<string | null> {
  const map = await loadTickerMap();
  const upper = ticker.toUpperCase();
  for (const entry of Object.values(map)) {
    if (entry.ticker === upper) return String(entry.cik_str);
  }
  return null;
}

export async function tickerToCompanyInfo(ticker: string): Promise<CompanyInfo | null> {
  const map = await loadTickerMap();
  const upper = ticker.toUpperCase();
  for (const entry of Object.values(map)) {
    if (entry.ticker === upper) {
      return { cik: String(entry.cik_str), ticker: entry.ticker, name: entry.title };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Pad CIK to 10 digits                                              */
/* ------------------------------------------------------------------ */

function padCik(cik: string | number): string {
  return String(cik).padStart(10, '0');
}

/* ------------------------------------------------------------------ */
/*  Company filings                                                    */
/* ------------------------------------------------------------------ */

export async function getCompanyFilings(
  cik: string,
  formTypes?: string[],
): Promise<SECFiling[]> {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const raw = await secGet(url, 300_000) as Record<string, unknown>;

  const filingsWrapper = raw.filings as Record<string, unknown> | undefined;
  if (!filingsWrapper) return [];

  const recent = filingsWrapper.recent as Record<string, unknown> | undefined;
  if (!recent) return [];

  const forms = (recent.form as string[]) ?? [];
  const dates = (recent.filingDate as string[]) ?? [];
  const reports = (recent.reportDate as string[]) ?? [];
  const accessions = (recent.accessionNumber as string[]) ?? [];
  const docs = (recent.primaryDocument as string[]) ?? [];
  const docDescs = (recent.primaryDocDescription as string[]) ?? [];
  const entityName = (raw.name as string) ?? '';

  const filter = formTypes?.length ? new Set(formTypes) : null;

  const filings: SECFiling[] = [];
  for (let i = 0; i < forms.length; i++) {
    if (filter && !filter.has(forms[i])) continue;
    filings.push({
      accessionNumber: accessions[i] ?? '',
      form: forms[i],
      filingDate: dates[i] ?? '',
      reportDate: reports[i] ?? '',
      primaryDocument: docs[i] ?? '',
      primaryDocDescription: docDescs[i] ?? '',
      entityName,
      cik: padded,
    });
  }
  return filings;
}

/* ------------------------------------------------------------------ */
/*  Insider transactions (Form 4 via EFTS full-text search)            */
/* ------------------------------------------------------------------ */

export async function getInsiderTransactions(cik: string): Promise<InsiderTransaction[]> {
  const padded = padCik(cik);
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${padded}%22&forms=4&dateRange=custom&startdt=2024-01-01&enddt=2026-12-31`;
  const raw = await secGet(url, 120_000);

  const hitsRaw = (raw.hits as Record<string, unknown> | undefined)?.hits;
  const hits = (Array.isArray(hitsRaw) ? hitsRaw : []) as Array<Record<string, unknown>>;
  const results: InsiderTransaction[] = [];

  for (const hit of hits.slice(0, 50)) {
    const src = (hit._source ?? {}) as Record<string, unknown>;
    const filingDate = String(src.file_date ?? '');
    const accessionNo = String(src.adsh ?? '');

    /* EFTS Form 4: display_names has [person, company]. Person is the insider. */
    const displayNames = src.display_names as string[] | undefined;
    const companyName = Array.isArray(displayNames) && displayNames.length > 1
      ? displayNames[1].replace(/\s*\(CIK\s+\d+\)\s*/, '').trim()
      : '';
    const reportingName = Array.isArray(displayNames) && displayNames.length > 0
      ? displayNames[0].replace(/\s*\(CIK\s+\d+\)\s*/, '').trim()
      : '';

    results.push({
      accessionNumber: accessionNo,
      form: '4',
      filingDate,
      reportingName,
      reportingTitle: companyName,
      transactionDate: String(src.period_ending ?? filingDate),
      transactionCode: '',
      securitiesOwned: 0,
      shares: 0,
      price: null,
      totalValue: null,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Institutional holders (13F-HR filings for a given company CIK)     */
/* ------------------------------------------------------------------ */

export async function getInstitutionalHolders(cik: string): Promise<InstitutionalHolder[]> {
  const padded = padCik(cik);

  /* First find 13F filers that hold this company.
     We search the EFTS index for 13F-HR filings, then we would need
     to parse the actual filing XML. Since the SEC does not have a
     direct "who holds stock X" API, we use the company facts endpoint
     and supplement with a search approach. */

  /* Approach: use the full-text search to find 13F filings mentioning
     this CIK, then parse the XML information table.
     In practice, we use a simpler approach: search for the ticker in
     13F-HR filings via EFTS. */

  const ticker = cik; // caller passes ticker for this path
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&forms=13F-HR&dateRange=custom&startdt=2025-01-01&enddt=2026-12-31`;
  const raw = await secGet(searchUrl, 180_000) as Record<string, unknown>;

  const hitsRaw = (raw.hits as Record<string, unknown> | undefined)?.hits;
  const hits = (Array.isArray(hitsRaw) ? hitsRaw : []) as Array<Record<string, unknown>>;
  const holders: InstitutionalHolder[] = [];

  for (const hit of hits.slice(0, 30)) {
    const src = (hit._source ?? {}) as Record<string, unknown>;
    const displayNames = src.display_names as string[] | undefined;
    const name = Array.isArray(displayNames) && displayNames.length > 0
      ? displayNames[0]
      : String(src.entity_name ?? 'Unknown');
    const filingDate = String(src.filing_date ?? '');
    const holderCik = String(src.entity_id ?? src.cik ?? '');

    holders.push({
      cik: holderCik,
      name,
      sharesHeld: 0,
      value: 0,
      pctPortfolio: null,
      change: 0,
      pctChange: null,
      reportDate: filingDate,
    });
  }

  return holders;
}

/* ------------------------------------------------------------------ */
/*  Market-wide insider transactions                                   */
/* ------------------------------------------------------------------ */

export async function getMarketwideInsider(): Promise<InsiderTransaction[]> {
  const today = new Date();
  const start = `${today.getFullYear()}-01-01`;
  const end = `${today.getFullYear()}-12-31`;
  const url = `https://efts.sec.gov/LATEST/search-index?q=*&forms=4&dateRange=custom&startdt=${start}&enddt=${end}&from=0&size=50`;
  const raw = await secGet(url, 120_000);

  const hitsRaw = (raw.hits as Record<string, unknown> | undefined)?.hits;
  const hits = (Array.isArray(hitsRaw) ? hitsRaw : []) as Array<Record<string, unknown>>;
  const results: InsiderTransaction[] = [];

  for (const hit of hits.slice(0, 50)) {
    const src = (hit._source ?? {}) as Record<string, unknown>;
    const filingDate = String(src.file_date ?? '');
    const displayNames = src.display_names as string[] | undefined;
    const companyName = Array.isArray(displayNames) && displayNames.length > 1
      ? displayNames[1].replace(/\s*\(CIK\s+\d+\)\s*/, '').trim()
      : '';
    const reportingName = Array.isArray(displayNames) && displayNames.length > 0
      ? displayNames[0].replace(/\s*\(CIK\s+\d+\)\s*/, '').trim()
      : '';

    results.push({
      accessionNumber: String(src.adsh ?? ''),
      form: '4',
      filingDate,
      reportingName,
      reportingTitle: companyName,
      transactionDate: String(src.period_ending ?? filingDate),
      transactionCode: '',
      securitiesOwned: 0,
      shares: 0,
      price: null,
      totalValue: null,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  XBRL company facts (for key financials)                            */
/* ------------------------------------------------------------------ */

export async function getCompanyFacts(cik: string): Promise<Record<string, unknown> | null> {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;
  try {
    return (await secGet(url, 600_000)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
