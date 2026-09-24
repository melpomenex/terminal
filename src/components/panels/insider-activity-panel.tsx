'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

interface InsiderTransaction {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportingName: string;
  reportingTitle: string;
  transactionDate: string;
  transactionCode: string;
  securitiesOwned: number;
  shares: number;
  price: number | null;
  totalValue: number | null;
}

interface ApiResponse {
  transactions: InsiderTransaction[];
  ticker?: string;
  cik?: string;
  mode: string;
  error?: string;
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }).toUpperCase();
  } catch { return d || '---'; }
}

function fmtShares(n: number | null | undefined): string {
  if (n == null || n === 0) return '---';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtValue(n: number | null | undefined): string {
  if (n == null || n === 0) return '---';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

type SentimentWindow = '30d' | '90d' | '180d';

export default function InsiderActivityPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [data, setData] = useState<InsiderTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketWide, setMarketWide] = useState(false);
  const [sentimentWindow, setSentimentWindow] = useState<SentimentWindow>('90d');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (sym: string, wide: boolean) => {
    const prev = abortRef.current;
    prev?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const params = wide
        ? 'marketwide=true'
        : `ticker=${encodeURIComponent(sym)}`;
      const res = await fetch(`/api/sec/insider?${params}`, { signal: ctrl.signal });
      const json: ApiResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.transactions ?? []);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(symbol, marketWide);
    return () => { abortRef.current?.abort(); };
  }, [symbol, marketWide, load]);

  /* Compute sentiment stats */
  const now = Date.now();
  const windowMs: Record<SentimentWindow, number> = {
    '30d': 30 * 86400000,
    '90d': 90 * 86400000,
    '180d': 180 * 86400000,
  };

  const filtered = data.filter((t) => {
    if (!t.filingDate) return true;
    return now - new Date(t.filingDate).getTime() < windowMs[sentimentWindow];
  });

  const totalTransactions = filtered.length;
  const buyCount = filtered.filter((t) => t.transactionCode === 'P').length;
  const sellCount = filtered.filter((t) => t.transactionCode === 'S').length;
  const buyValue = filtered.filter((t) => t.transactionCode === 'P').reduce((s, t) => s + (t.totalValue ?? 0), 0);
  const sellValue = filtered.filter((t) => t.transactionCode === 'S').reduce((s, t) => s + (t.totalValue ?? 0), 0);
  const netValue = buyValue - sellValue;
  const sentiment: 'Bullish' | 'Bearish' | 'Neutral' = buyCount > sellCount * 1.5 ? 'Bullish' : sellCount > buyCount * 1.5 ? 'Bearish' : 'Neutral';
  const sentimentColor = sentiment === 'Bullish' ? 'var(--green)' : sentiment === 'Bearish' ? 'var(--red)' : 'var(--amber)';

  const headerStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'var(--amber)',
  };
  const colStyle: React.CSSProperties = {
    fontSize: 9, color: 'var(--amber-dim)', padding: '2px 4px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  };
  const cellStyle: React.CSSProperties = {
    fontSize: 10, padding: '2px 4px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={headerStyle}>{marketWide ? 'MARKET WIDE' : symbol}</span>
          <span style={{ fontSize: 10, color: 'var(--amber-dim)', marginLeft: 6 }}>INSIDER ACTIVITY</span>
        </div>
        <button
          onClick={() => setMarketWide((v) => !v)}
          style={{
            fontSize: 9, padding: '1px 6px', cursor: 'pointer',
            background: marketWide ? 'var(--amber)' : 'transparent',
            color: marketWide ? '#000' : 'var(--amber)',
            border: '1px solid var(--border)', borderRadius: 2,
          }}
        >
          {marketWide ? 'SINGLE' : 'MARKET WIDE'}
        </button>
      </div>

      {loading && <div style={{ padding: 8, color: 'var(--amber-dim)' }}>LOADING INSIDER DATA...</div>}
      {error && <div style={{ padding: 8, color: 'var(--red)' }}>{error.toUpperCase()}</div>}
      {!loading && !error && data.length === 0 && (
        <div style={{ padding: 8, color: 'var(--amber-dim)' }}>NO INSIDER TRANSACTIONS FOUND</div>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 65px 30px 60px 50px 65px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ ...colStyle, textAlign: 'left' }}>INSIDER</div>
            <div style={colStyle}>DATE</div>
            <div style={colStyle}>TITLE</div>
            <div style={colStyle}>TYPE</div>
            <div style={colStyle}>SHARES</div>
            <div style={colStyle}>PRICE</div>
            <div style={colStyle}>VALUE</div>
          </div>

          {/* Transaction rows */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {data.slice(0, 50).map((t, i) => {
              const isBuy = t.transactionCode === 'P';
              const isSell = t.transactionCode === 'S';
              const rowColor = isBuy ? 'rgba(0,255,0,0.05)' : isSell ? 'rgba(255,0,0,0.05)' : 'transparent';
              const typeColor = isBuy ? 'var(--green)' : isSell ? 'var(--red)' : 'var(--amber)';
              return (
                <div key={`${t.accessionNumber}-${i}`} style={{
                  display: 'grid', gridTemplateColumns: '1fr 55px 65px 30px 60px 50px 65px',
                  borderBottom: '1px solid rgba(51,34,0,0.3)', background: rowColor,
                }}>
                  <div style={{ ...cellStyle, textAlign: 'left', color: 'var(--amber)' }}>
                    {t.reportingName || '---'}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber-dim)' }}>
                    {fmtDate(t.transactionDate || t.filingDate)}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber-dim)', fontSize: 9 }}>
                    {t.reportingTitle ? t.reportingTitle.slice(0, 10) : '---'}
                  </div>
                  <div style={{ ...cellStyle, color: typeColor, fontWeight: 700 }}>
                    {t.transactionCode || '?'}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber)' }}>
                    {fmtShares(t.shares)}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber-dim)' }}>
                    {t.price != null ? `$${t.price.toFixed(2)}` : '---'}
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--amber)' }}>
                    {fmtValue(t.totalValue)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary / Sentiment section */}
          <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            {/* Window selector */}
            <div style={{ display: 'flex', gap: 6, padding: '2px 8px', borderBottom: '1px solid rgba(51,34,0,0.3)' }}>
              {(['30d', '90d', '180d'] as SentimentWindow[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setSentimentWindow(w)}
                  style={{
                    fontSize: 9, padding: '1px 4px', cursor: 'pointer', background: 'transparent',
                    color: sentimentWindow === w ? 'var(--amber-bright)' : 'var(--amber-dim)',
                    border: sentimentWindow === w ? '1px solid var(--amber)' : '1px solid transparent',
                    borderRadius: 2,
                  }}
                >
                  {w}
                </button>
              ))}
              <span style={{ fontSize: 9, color: 'var(--amber-dim)', marginLeft: 'auto', alignSelf: 'center' }}>
                SENTIMENT:
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: sentimentColor, alignSelf: 'center' }}>
                {sentiment.toUpperCase()}
              </span>
            </div>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', padding: '2px 8px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--amber-dim)' }}>BUYS</div>
                <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>{buyCount}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--amber-dim)' }}>SELLS</div>
                <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>{sellCount}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--amber-dim)' }}>TOTAL</div>
                <div style={{ fontSize: 11, color: 'var(--amber)' }}>{totalTransactions}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--amber-dim)' }}>BUY VAL</div>
                <div style={{ fontSize: 10, color: 'var(--green)' }}>{fmtValue(buyValue)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--amber-dim)' }}>SELL VAL</div>
                <div style={{ fontSize: 10, color: 'var(--red)' }}>{fmtValue(sellValue)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--amber-dim)' }}>NET VAL</div>
                <div style={{ fontSize: 10, color: netValue >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {netValue >= 0 ? '+' : ''}{fmtValue(Math.abs(netValue))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '2px 8px', fontSize: 9, color: 'var(--amber-dim)', borderTop: '1px solid var(--border)' }}>
            {data.length} TRANSACTIONS | SOURCE: SEC EDGAR FORM 4
          </div>
        </>
      )}
    </div>
  );
}
