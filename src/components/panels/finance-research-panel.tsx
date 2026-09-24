'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

// --- Types ---
interface FinanceResult {
  category: string;
  tickers: string[];
  content: string;
  sources: string[];
}

interface SearchResponse {
  text: string;
  financeResults: FinanceResult[];
  usage: any;
}

type SearchConfig = 'fast' | 'balanced' | 'deep';

// --- Markdown table parser ---
interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(md: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    // Detect table header line (starts with |)
    if (line.startsWith('|') && line.endsWith('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      // Check for separator row
      if (/^\|[\s\-:|]+\|$/.test(nextLine)) {
        const headers = line
          .split('|')
          .slice(1, -1)
          .map((h) => h.trim());
        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length) {
          const rowLine = lines[j].trim();
          if (rowLine.startsWith('|') && rowLine.endsWith('|')) {
            rows.push(
              rowLine
                .split('|')
                .slice(1, -1)
                .map((c) => c.trim()),
            );
            j++;
          } else {
            break;
          }
        }
        if (headers.length > 0 && rows.length > 0) {
          tables.push({ headers, rows });
        }
        i = j;
        continue;
      }
    }
    i++;
  }
  return tables;
}

// --- Number formatter ---
function formatLargeNumber(value: string): string {
  const str = value.replace(/[$,%\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(str);
  if (isNaN(num)) return value;

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1e12) return `${sign}$${(absNum / 1e12).toFixed(2)}T`;
  if (absNum >= 1e9) return `${sign}$${(absNum / 1e9).toFixed(2)}B`;
  if (absNum >= 1e6) return `${sign}$${(absNum / 1e6).toFixed(2)}M`;
  if (absNum >= 1e3) return `${sign}$${(absNum / 1e3).toFixed(1)}K`;

  return value;
}

function isNumericCell(value: string): boolean {
  const cleaned = value.replace(/[$,%\s]/g, '').replace(/\((.+)\)/, '-$1');
  return !isNaN(parseFloat(cleaned)) && cleaned.length > 0;
}

function isPositiveNumeric(value: string): boolean {
  const cleaned = value.replace(/[$,%\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0;
}

function isNegativeNumeric(value: string): boolean {
  const cleaned = value.replace(/[$,%\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return !isNaN(num) && num < 0;
}

// --- Simple markdown renderer for summary text ---
function renderMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={key++} style={{ color: 'var(--bright)' }}>{match[1]}</strong>);
    } else if (match[2] && match[3]) {
      parts.push(
        <a key={key++} href={match[3]} target="_blank" rel="noopener" style={{ color: '#4dabf7', textDecoration: 'none' }}>
          {match[2]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// --- Config labels ---
const CONFIG_META: Record<SearchConfig, { label: string; desc: string }> = {
  fast: { label: 'LIVE', desc: 'Live quotes & quick lookups' },
  balanced: { label: 'RESEARCH', desc: 'Historical analysis with context' },
  deep: { label: 'DEEP', desc: 'Multi-step research report' },
};

const SUGGESTED_QUERIES = [
  'Show NVIDIA valuation and segment revenue',
  'Compare Apple vs Microsoft margins',
  'Summarize Tesla\'s last earnings call',
  'What are analyst estimates for AMZN?',
  'Show top institutional holders of MSFT',
];

export default function FinanceResearchPanel({ panelId }: { panelId: string }) {
  const { brainSettings } = useTerminalContext();
  const [query, setQuery] = useState('');
  const [config, setConfig] = useState<SearchConfig>('balanced');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (searchQuery: string, searchConfig: SearchConfig) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/brain/finance-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          settings: { perplexityKey: brainSettings.perplexityKey },
          config: searchConfig,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }

      setResponse(data);
    } catch (err: any) {
      setError(`Connection error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, brainSettings.perplexityKey]);

  const handleSearch = useCallback(() => {
    doSearch(query, config);
  }, [query, config, doSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  // Auto-scroll on results
  useEffect(() => {
    if (response || error) {
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }
  }, [response, error]);

  // --- No key state ---
  if (!brainSettings.perplexityKey) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 20 }}>
        <div style={{ fontSize: 24, color: 'var(--amber-dim)' }}>◎</div>
        <div style={{ fontSize: 12, color: 'var(--amber)', textAlign: 'center', lineHeight: 1.6 }}>
          Perplexity API key not configured.<br />
          Open <span style={{ color: 'var(--bright)', fontWeight: 700 }}>BRAIN SETTINGS</span> to add your key.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Config Toggle Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
        background: 'rgba(0,0,0,0.3)',
      }}>
        {(Object.keys(CONFIG_META) as SearchConfig[]).map((c) => {
          const active = config === c;
          return (
            <button
              key={c}
              onClick={() => setConfig(c)}
              title={CONFIG_META[c].desc}
              style={{
                background: active ? 'rgba(255,176,0,0.2)' : 'transparent',
                color: active ? 'var(--amber)' : 'var(--amber-dim)',
                border: active ? '1px solid var(--amber)' : '1px solid transparent',
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'var(--font)',
                cursor: 'pointer',
                letterSpacing: 1,
                borderRadius: 2,
                transition: 'all 0.15s',
              }}
            >
              {CONFIG_META[c].label}
            </button>
          );
        })}
        <span style={{ fontSize: 9, color: 'var(--amber-dim)', marginLeft: 4 }}>
          {CONFIG_META[config].desc}
        </span>
      </div>

      {/* Results area */}
      <div ref={resultsRef} style={{
        flex: 1, overflow: 'auto', padding: 0, minHeight: 0,
      }}>
        {/* Empty state */}
        {!response && !error && !isLoading && (
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--amber-dim)', marginBottom: 12, textAlign: 'center', lineHeight: 1.6 }}>
              Ask any finance question — get structured data & AI analysis
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SUGGESTED_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => doSearch(q, config)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', fontSize: 10,
                    background: 'rgba(255,176,0,0.04)', border: '1px solid var(--border)',
                    color: 'var(--amber)', cursor: 'pointer', fontFamily: 'var(--font)',
                    borderRadius: 2, lineHeight: 1.4,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,176,0,0.1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,176,0,0.04)'; }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--amber)' }}>
              {config === 'deep' ? 'Deep research in progress' : 'Searching financial data'}
            </div>
            <div style={{
              marginTop: 8, display: 'inline-flex', gap: 4,
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: 'var(--amber)',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: 12, margin: 8,
            background: 'rgba(255,68,0,0.08)', border: '1px solid rgba(255,68,0,0.3)',
            borderRadius: 3, fontSize: 10, color: '#ff4400', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* AI Summary */}
        {response?.text && (
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--amber-dim)',
              letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
            }}>
              Analysis
            </div>
            <div style={{
              fontSize: 11, lineHeight: 1.7, color: 'var(--bright)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {renderMarkdown(response.text)}
            </div>
          </div>
        )}

        {/* Finance Results Tables */}
        {response?.financeResults?.map((fr, idx) => {
          const tables = parseMarkdownTable(fr.content);
          // Also get any non-table text
          const tablesText = tables.map((t) =>
            `| ${t.headers.join(' | ')} |`).join('\n');
          const nonTableContent = fr.content
            .split('\n')
            .filter((line) => !line.trim().startsWith('|'))
            .join('\n')
            .trim();

          return (
            <div key={idx} style={{ padding: '8px 12px 12px' }}>
              {/* Category badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  padding: '1px 6px', borderRadius: 2,
                  background: 'rgba(255,176,0,0.12)', color: 'var(--amber)',
                  border: '1px solid rgba(255,176,0,0.25)',
                }}>
                  {fr.category.toUpperCase()}
                </span>
                {fr.tickers.length > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--amber-dim)' }}>
                    {fr.tickers.join(', ')}
                  </span>
                )}
              </div>

              {/* Non-table text */}
              {nonTableContent && (
                <div style={{ fontSize: 10, color: 'var(--bright)', lineHeight: 1.6, marginBottom: 8 }}>
                  {renderMarkdown(nonTableContent)}
                </div>
              )}

              {/* Rendered tables */}
              {tables.map((table, tIdx) => (
                <div key={tIdx} style={{
                  overflowX: 'auto', marginBottom: 8,
                  border: '1px solid var(--border)', borderRadius: 2,
                }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    fontSize: 10, fontFamily: 'var(--font)',
                  }}>
                    <thead>
                      <tr>
                        {table.headers.map((header, hIdx) => (
                          <th key={hIdx} style={{
                            position: 'sticky', top: 0, zIndex: 1,
                            padding: '4px 8px', textAlign: 'left',
                            background: 'rgba(255,176,0,0.15)', color: '#fff',
                            fontWeight: 700, fontSize: 9, letterSpacing: 0.5,
                            whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{
                          background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,176,0,0.05)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'; }}
                        >
                          {row.map((cell, cIdx) => {
                            const numeric = isNumericCell(cell);
                            const positive = isPositiveNumeric(cell);
                            const negative = isNegativeNumeric(cell);
                            return (
                              <td key={cIdx} style={{
                                padding: '3px 8px',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                color: negative ? '#ff4400' : positive ? '#00b050' : 'var(--bright)',
                                textAlign: numeric ? 'right' : 'left',
                                fontFamily: numeric ? 'var(--font)' : 'var(--font)',
                                whiteSpace: 'nowrap',
                              }}>
                                {numeric && Math.abs(parseFloat(cell.replace(/[$,%\s]/g, ''))) >= 1e6
                                  ? formatLargeNumber(cell)
                                  : cell}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Per-result sources */}
              {fr.sources.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {fr.sources.map((src, sIdx) => (
                    <a
                      key={sIdx}
                      href={src}
                      target="_blank"
                      rel="noopener"
                      style={{ fontSize: 9, color: '#4dabf7', textDecoration: 'none', lineHeight: 1.4 }}
                    >
                      {src.length > 50 ? src.slice(0, 50) + '…' : src}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Usage footer */}
        {response?.usage && (
          <div style={{
            padding: '4px 12px', borderTop: '1px solid var(--border)',
            fontSize: 9, color: 'var(--amber-dim)', textAlign: 'right',
          }}>
            {response.usage.input_tokens || '?'} in · {response.usage.output_tokens || '?'} out
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'rgba(0,0,0,0.3)' }}>
        <div style={{
          fontSize: 10, color: 'var(--amber-dim)', display: 'flex', alignItems: 'center',
          paddingRight: 6, borderRight: '1px solid var(--border)', marginRight: 2,
          flexShrink: 0,
        }}>
          ◎
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? `${CONFIG_META[config].label}…` : 'Ask any finance question…'}
          disabled={isLoading}
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--amber)',
            border: 'none',
            padding: '4px 6px',
            fontSize: 11,
            fontFamily: 'var(--font)',
            outline: 'none',
            opacity: isLoading ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          style={{
            background: isLoading || !query.trim() ? 'var(--border)' : 'var(--amber)',
            color: isLoading || !query.trim() ? 'var(--amber-dim)' : '#000',
            border: 'none',
            padding: '4px 10px',
            fontSize: 9,
            fontWeight: 700,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)',
            borderRadius: 2,
            letterSpacing: 0.5,
          }}
        >
          GO
        </button>
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
