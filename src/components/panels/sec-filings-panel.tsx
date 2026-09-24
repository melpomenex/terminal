'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import type { DataProvenance } from '@/lib/types/provenance';

interface SECFiling {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
  primaryDocDescription: string;
  entityName: string;
  cik: string;
}

interface KeyFinancial {
  value: number;
  end: string;
  form: string;
}

interface ApiResponse {
  ticker: string;
  cik: string;
  filings: SECFiling[];
  keyFinancials: Record<string, KeyFinancial | null> | null;
  error?: string;
}

interface FilingDoc {
  url: string;
  html: string;
  sections: Array<{ id: string; title: string; anchor: string }>;
  exhibits: Array<{ name: string; description: string; type: string }>;
  provenance: DataProvenance;
}

type FilterTab = 'ALL' | '10-K' | '10-Q' | '8-K' | 'PROXY' | 'ALL_SEC';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: '10-K', label: 'Annual' },
  { key: '10-Q', label: 'Quarterly' },
  { key: '8-K', label: 'Current' },
  { key: 'PROXY', label: 'Proxy' },
  { key: 'ALL_SEC', label: 'All SEC' },
];

function fmtDate(d: string): string {
  if (!d) return '---';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  } catch { return d; }
}

function fmtBig(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

const FORM_COLORS: Record<string, string> = {
  '10-K': 'var(--green)',
  '10-Q': 'var(--amber)',
  '8-K': 'var(--amber-bright)',
  'DEF 14A': '#c084fc',
  'DEF 14C': '#c084fc',
  'SC 13D': '#f97316',
  'SC 13G': '#f97316',
  'S-1': '#60a5fa',
  'S-3': '#60a5fa',
  '4': 'var(--green)',
  '3': 'var(--amber-dim)',
  '5': 'var(--amber-dim)',
};

function secDocUrl(filing: SECFiling): string {
  const acc = filing.accessionNumber.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${filing.cik}/${acc}/${filing.primaryDocument}`;
}

export default function SECFilingsPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [filings, setFilings] = useState<SECFiling[]>([]);
  const [keyFinancials, setKeyFinancials] = useState<Record<string, KeyFinancial | null> | null>(null);
  const [cik, setCik] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // --- In-terminal reader state ---
  const [readerFiling, setReaderFiling] = useState<SECFiling | null>(null);
  const [doc, setDoc] = useState<FilingDoc | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [showExhibits, setShowExhibits] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);

  const openReader = useCallback(async (filing: SECFiling) => {
    setReaderFiling(filing);
    setDoc(null);
    setDocError(null);
    setDocLoading(true);
    setDocSearch('');
    try {
      const res = await fetch(`/api/v2/filing-doc?cik=${filing.cik}&accession=${filing.accessionNumber}&doc=${encodeURIComponent(filing.primaryDocument)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDoc(json as FilingDoc);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'reader fetch failed');
    } finally {
      setDocLoading(false);
    }
  }, []);

  const jumpToAnchor = useCallback((anchor: string) => {
    if (!anchor || !readerRef.current) return;
    const el = readerRef.current.querySelector(`a[name="${anchor}"], #${CSS.escape(anchor)}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const docMatches = useMemo(() => {
    if (!doc || !docSearch.trim()) return 0;
    const q = docSearch.toLowerCase();
    const text = doc.html.replace(/<[^>]+>/g, ' ').toLowerCase();
    return text.split(q).length - 1;
  }, [doc, docSearch]);

  const load = useCallback(async (sym: string) => {
    const prev = abortRef.current;
    prev?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setExpandedIndex(null);
    setReaderFiling(null);
    try {
      const res = await fetch(`/api/sec/filings?ticker=${encodeURIComponent(sym)}`, { signal: ctrl.signal });
      const json: ApiResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setFilings(json.filings ?? []);
      setKeyFinancials(json.keyFinancials ?? null);
      setCik(json.cik ?? '');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(symbol);
    return () => { abortRef.current?.abort(); };
  }, [symbol, load]);

  const filteredFilings = filings.filter((f) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PROXY') return f.form.startsWith('DEF ') || f.form.startsWith('PRE ');
    if (activeTab === 'ALL_SEC') return true;
    return f.form === activeTab;
  });

  const formCounts: Record<string, number> = {};
  for (const f of filings) {
    formCounts[f.form] = (formCounts[f.form] || 0) + 1;
  }

  /* Build key financials display from XBRL data */
  const finLabels: Record<string, string> = {
    revenues: 'Revenue',
    netIncome: 'Net Income',
    totalAssets: 'Total Assets',
    totalLiabilities: 'Total Liab.',
    stockholdersEquity: 'Equity',
    cashAndEquivalents: 'Cash',
    operatingIncome: 'Op. Income',
    basicEPS: 'EPS (Basic)',
    dilutedEPS: 'EPS (Diluted)',
    commonSharesOutstanding: 'Shares Out',
    grossProfit: 'Gross Profit',
    researchAndDevelopment: 'R&D',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* ============ IN-TERMINAL READER ============ */}
      {readerFiling && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)', flexShrink: 0 }}>
            <button onClick={() => { setReaderFiling(null); setDoc(null); }} style={{ background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--accent)', fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 2 }}>← BACK</button>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-bright)' }}>{readerFiling.form}</span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{fmtDate(readerFiling.filingDate)}</span>
            <input
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              placeholder="search document…"
              style={{ marginLeft: 'auto', background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none', width: 130 }}
            />
            {docSearch && <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{docMatches} hits</span>}
            <button onClick={() => setShowExhibits((v) => !v)} style={{ background: 'transparent', border: '1px solid var(--border-soft)', color: showExhibits ? 'var(--accent)' : 'var(--text-dim)', fontSize: 8, padding: '1px 5px', cursor: 'pointer', borderRadius: 2 }}>EXHIBITS</button>
            {doc && <ProvenanceBadge provenance={doc.provenance} compact />}
          </div>

          {docLoading && <div style={{ padding: 10, color: 'var(--text-dim)' }}>FETCHING DOCUMENT FROM EDGAR…</div>}
          {docError && (
            <div style={{ padding: 10, color: 'var(--red)', fontSize: 10 }}>
              {docError.toUpperCase()}
              <a href={secDocUrl(readerFiling)} target="_blank" rel="noreferrer" style={{ color: 'var(--amber)', marginLeft: 8, textDecoration: 'underline', fontSize: 9 }}>OPEN ON SEC.GOV ↗</a>
            </div>
          )}

          {doc && !docLoading && (
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              {/* Section index sidebar */}
              {doc.sections.length > 0 && (
                <div style={{ width: 150, borderRight: '1px solid var(--border-soft)', overflowY: 'auto', flexShrink: 0, background: 'var(--surface-sunken)' }}>
                  <div style={{ padding: '4px 6px', fontSize: 8, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 0.5 }}>SECTIONS</div>
                  {doc.sections.map((s) => (
                    <div
                      key={s.id + s.anchor}
                      onClick={() => jumpToAnchor(s.anchor)}
                      className="row-hover"
                      style={{ padding: '3px 6px', fontSize: 9, color: 'var(--text-dim)', cursor: 'pointer', borderBottom: '1px solid var(--row-divider)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={s.title}
                    >
                      {s.title}
                    </div>
                  ))}
                </div>
              )}

              {/* Document body */}
              <div
                ref={readerRef}
                className="sec-doc-reader"
                style={{
                  flex: 1, minWidth: 0, overflowY: 'auto', padding: '8px 14px',
                  background: '#fff', color: '#111',
                }}
                dangerouslySetInnerHTML={{ __html: doc.html }}
              />
            </div>
          )}

          {doc && showExhibits && doc.exhibits.length > 0 && (
            <div style={{ maxHeight: 120, overflowY: 'auto', borderTop: '1px solid var(--border)', background: 'var(--surface-raised)', flexShrink: 0 }}>
              <div style={{ padding: '3px 8px', fontSize: 8, fontWeight: 700, color: 'var(--text-dim)' }}>FILING DIRECTORY / EXHIBITS</div>
              {doc.exhibits.map((ex) => (
                <a
                  key={ex.name}
                  href={`https://www.sec.gov/Archives/edgar/data/${readerFiling.cik}/${readerFiling.accessionNumber.replace(/-/g, '')}/${ex.name}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', gap: 8, padding: '2px 8px', fontSize: 9, color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px solid var(--row-divider)' }}
                >
                  <span style={{ minWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
                  <span style={{ color: 'var(--text-dim)', flex: 1 }}>{ex.description || ex.type}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ FILING LIST ============ */}
      {!readerFiling && (
        <>
      {/* Header */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{symbol}</span>
        <span style={{ fontSize: 10, color: 'var(--amber-dim)', marginLeft: 6 }}>SEC FILINGS</span>
        {cik && <span style={{ fontSize: 9, color: 'var(--amber-dim)', marginLeft: 8 }}>CIK: {cik}</span>}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 6px' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tab.key === 'ALL'
            ? filings.length
            : tab.key === 'PROXY'
              ? filings.filter((f) => f.form.startsWith('DEF ') || f.form.startsWith('PRE ')).length
              : tab.key === 'ALL_SEC'
                ? filings.length
                : formCounts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setExpandedIndex(null); }}
              style={{
                fontSize: 9, padding: '2px 6px', cursor: 'pointer',
                background: isActive ? 'rgba(255,176,0,0.15)' : 'transparent',
                color: isActive ? 'var(--amber-bright)' : 'var(--amber-dim)',
                border: 'none', borderBottom: isActive ? '2px solid var(--amber)' : '2px solid transparent',
                marginRight: 2,
              }}
            >
              {tab.label} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      {loading && <div style={{ padding: 8, color: 'var(--amber-dim)' }}>LOADING FILINGS...</div>}
      {error && <div style={{ padding: 8, color: 'var(--red)' }}>{error.toUpperCase()}</div>}
      {!loading && !error && filteredFilings.length === 0 && (
        <div style={{ padding: 8, color: 'var(--amber-dim)' }}>NO FILINGS FOUND FOR {symbol}</div>
      )}

      {/* Filing list */}
      {!loading && !error && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {filteredFilings.slice(0, 60).map((filing, i) => {
            const isExpanded = expandedIndex === i;
            const formColor = FORM_COLORS[filing.form] ?? 'var(--amber)';
            const url = secDocUrl(filing);

            return (
              <div key={`${filing.accessionNumber}-${i}`}>
                {/* Filing row */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 75px 1fr 24px',
                    borderBottom: '1px solid rgba(51,34,0,0.3)',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(255,176,0,0.05)' : 'transparent',
                  }}
                >
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: formColor,
                    padding: '3px 4px', whiteSpace: 'nowrap',
                  }}>
                    {filing.form}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--amber-dim)', padding: '3px 4px' }}>
                    {fmtDate(filing.filingDate)}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--amber)', padding: '3px 4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {filing.primaryDocDescription || filing.form}
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 10, color: 'var(--amber-dim)', padding: '3px 4px', textDecoration: 'none' }}
                    title="Open on SEC.gov"
                  >
                    &#x2197;
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); void openReader(filing); }}
                    title="Read in terminal"
                    style={{ fontSize: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', borderRadius: 2, margin: '2px 2px', height: 16, lineHeight: '12px' }}
                  >
                    READ
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    padding: '4px 8px 6px', borderBottom: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.2)',
                  }}>
                    <div style={{ fontSize: 9, color: 'var(--amber-dim)', marginBottom: 4 }}>
                      ACCESSION: {filing.accessionNumber} | REPORT DATE: {fmtDate(filing.reportDate)}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--amber-dim)', marginBottom: 4 }}>
                      ENTITY: {filing.entityName}
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 9, color: 'var(--amber)', textDecoration: 'underline' }}
                    >
                      OPEN ON SEC.GOV &#x2197;
                    </a>

                    {/* Key financials from XBRL (only for annual/quarterly filings) */}
                    {(filing.form === '10-K' || filing.form === '10-Q') && keyFinancials && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 9, color: 'var(--amber-dim)', fontWeight: 700, marginBottom: 2 }}>
                          KEY FINANCIALS (XBRL)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 12px' }}>
                          {Object.entries(keyFinancials).map(([key, fin]) => {
                            if (!fin) return null;
                            const label = finLabels[key] || key;
                            return (
                              <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 9, color: 'var(--amber-dim)' }}>{label}</span>
                                <span style={{ fontSize: 9, color: 'var(--amber)' }}>
                                  {fmtBig(fin.value)}
                                  <span style={{ fontSize: 7, color: 'var(--amber-dim)', marginLeft: 2 }}>
                                    {fin.end ? fmtDate(fin.end) : ''}
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '2px 8px', fontSize: 9, color: 'var(--amber-dim)', borderTop: '1px solid var(--border)' }}>
        {filteredFilings.length} FILINGS | SOURCE: SEC EDGAR
      </div>
        </>
      )}
    </div>
  );
}
