'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { securityMasterResolver } from '@/lib/security-master/resolver';
import ProvenanceBadge from '@/components/ui/provenance-badge';
import { makeProvenance } from '@/lib/types/provenance';

interface ListingRow {
  symbol: string;
  yahooSymbol: string;
  venue: string;
  mic: string;
  currency: string;
  country: string;
  listingType: 'PRIMARY' | 'REGIONAL' | 'ADR' | 'DUAL_CLASS' | 'DUAL_LISTED';
  /** Local regular session in venue timezone: [openMinutesUTC, closeMinutesUTC] approximated by NY anchor */
  sessionTz: string;
}

/**
 * Known multi-venue listings. Keyed by root ticker; values list additional
 * venues beyond the US primary. Sourced from public exchange facts.
 */
const MULTI_LISTINGS: Record<string, Omit<ListingRow, 'symbol' | 'yahooSymbol' | 'listingType'>[]> = {
  SHEL: [
    { venue: 'LSE', mic: 'XLON', currency: 'GBP', country: 'GB', sessionTz: 'Europe/London' },
    { venue: 'Euronext AMS', mic: 'XAMS', currency: 'EUR', country: 'NL', sessionTz: 'Europe/Amsterdam' },
  ],
  SONY: [{ venue: 'Tokyo', mic: 'XTKS', currency: 'JPY', country: 'JP', sessionTz: 'Asia/Tokyo' }],
  BABA: [{ venue: 'HKEX', mic: 'XHKG', currency: 'HKD', country: 'HK', sessionTz: 'Asia/Hong_Kong' }],
  TSM: [{ venue: 'TWSE', mic: 'XTAI', currency: 'TWD', country: 'TW', sessionTz: 'Asia/Taipei' }],
  NVO: [{ venue: 'Nasdaq Cph', mic: 'XCSE', currency: 'DKK', country: 'DK', sessionTz: 'Europe/Copenhagen' }],
  SHELUS: [],
  RIO: [{ venue: 'LSE', mic: 'XLON', currency: 'GBP', country: 'GB', sessionTz: 'Europe/London' }, { venue: 'ASX', mic: 'XASX', currency: 'AUD', country: 'AU', sessionTz: 'Australia/Sydney' }],
  BP: [{ venue: 'LSE', mic: 'XLON', currency: 'GBP', country: 'GB', sessionTz: 'Europe/London' }],
  NBPCC: [],
  MCD: [],
  'SAP': [{ venue: 'Xetra', mic: 'XETR', currency: 'EUR', country: 'DE', sessionTz: 'Europe/Berlin' }],
  TM: [{ venue: 'Tokyo', mic: 'XTKS', currency: 'JPY', country: 'JP', sessionTz: 'Asia/Tokyo' }],
  HDB: [{ venue: 'NSE', mic: 'XNSE', currency: 'INR', country: 'IN', sessionTz: 'Asia/Kolkata' }],
  INFY: [{ venue: 'NSE', mic: 'XNSE', currency: 'INR', country: 'IN', sessionTz: 'Asia/Kolkata' }],
  SINEW: [],
  LI: [{ venue: 'HKEX', mic: 'XHKG', currency: 'HKD', country: 'HK', sessionTz: 'Asia/Hong_Kong' }],
  NIO: [{ venue: 'HKEX', mic: 'XHKG', currency: 'HKD', country: 'HK', sessionTz: 'Asia/Hong_Kong' }],
  SMMCY: [{ venue: 'Tokyo', mic: 'XTKS', currency: 'JPY', country: 'JP', sessionTz: 'Asia/Tokyo' }],
};

/** Yahoo suffixes per MIC for fetching regional quotes. */
const YAHOO_SUFFIX: Record<string, string> = {
  XLON: '.L', XTKS: '.T', XETR: '.DE', XPAR: '.PA', XAMS: '.AS', XMIL: '.MI',
  XSWX: '.SW', XHKG: '.HK', XSHG: '.SS', XSHE: '.SZ', XKRX: '.KS', XASX: '.AX',
  XTSE: '.TO', XBOM: '.BO', XNSE: '.NS', XTAI: '.TW', XCSE: '.CO',
};

function venueSessionState(tz: string): { open: boolean; label: string } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short' }).format(now);
    const [weekday, time] = parts.split(' ');
    const h = parseInt(time.split(':')[0], 10);
    const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
    // Approximate 09:30–16:00 local regular session across venues.
    const open = isWeekday && h >= 9 && h < 16;
    return { open, label: open ? 'OPEN' : 'CLOSED' };
  } catch {
    return { open: false, label: '—' };
  }
}

export default function AllqPanel({ panelId }: { panelId: string }) {
  const { symbol, setSymbol } = useTerminalContext();
  const [prices, setPrices] = useState<Record<string, { price: number | null; changePercent: number | null }>>({});
  const [loading, setLoading] = useState(false);

  const root = symbol.replace(/[.\-].*$/, '').toUpperCase();

  const listings = useMemo<ListingRow[]>(() => {
    const rows: ListingRow[] = [];
    // Primary US listing
    const primary = securityMasterResolver.resolve(symbol);
    rows.push({
      symbol: primary?.symbol ?? symbol,
      yahooSymbol: primary?.symbol ?? symbol,
      venue: primary?.assetClass === 'ETF' ? 'NYSE Arca / Nasdaq' : 'US Composite',
      mic: 'XNAS',
      currency: 'USD',
      country: 'US',
      listingType: 'PRIMARY',
      sessionTz: 'America/New_York',
    });

    // Dual/multi share classes
    const shareRoot = symbol.replace(/[.\-/].*$/, '').toUpperCase();
    const classes = shareRoot === 'BRK' ? ['BRK-A', 'BRK-B'] : shareRoot === 'GOOGL' || shareRoot === 'GOOG' ? ['GOOG', 'GOOGL'] : null;
    if (classes) {
      for (const cls of classes) {
        rows.push({
          symbol: cls, yahooSymbol: cls, venue: 'US Composite', mic: 'XNAS', currency: 'USD', country: 'US',
          listingType: 'DUAL_CLASS', sessionTz: 'America/New_York',
        });
      }
    }

    // Regional / dual listings
    for (const extra of MULTI_LISTINGS[root.toUpperCase()] ?? []) {
      const suffix = YAHOO_SUFFIX[extra.mic] ?? '';
      const regionalSymbol = `${root}${suffix}`;
      rows.push({
        symbol: `${root}.${extra.mic.slice(1)}`,
        yahooSymbol: regionalSymbol,
        venue: extra.venue,
        mic: extra.mic,
        currency: extra.currency,
        country: extra.country,
        listingType: root === 'BABA' || root === 'TSM' || root === 'HDB' || root === 'INFY' ? 'ADR' : 'REGIONAL',
        sessionTz: extra.sessionTz,
      });
    }
    return rows;
  }, [symbol, root]);

  // Fetch prices for all mapped Yahoo symbols in one batch
  useEffect(() => {
    const yahooSymbols = [...new Set(listings.map((l) => l.yahooSymbol))];
    if (yahooSymbols.length === 0) return;
    setLoading(true);
    fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(yahooSymbols.join(','))}`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, { price: number | null; changePercent: number | null }> = {};
        for (const item of (d.items ?? []) as Array<{ symbol: string; price: number | null; changePercent: number | null }>) {
          map[item.symbol] = { price: item.price, changePercent: item.changePercent };
        }
        setPrices(map);
      })
      .catch(() => setPrices({}))
      .finally(() => setLoading(false));
  }, [listings]);

  const provenance = useMemo(() => makeProvenance('Yahoo (delayed composite)', 'DELAYED', 'USD', { delayMinutes: 15 }), []);

  return (
    <div data-panel-id={panelId} style={{ height: '100%', overflowY: 'auto', fontSize: 'var(--font-size-base)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ color: 'var(--text-mute)', fontSize: 'var(--font-size-xs)' }}>ALLQ —</span>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{root}</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 'var(--font-size-xxs)' }}>
          {listings.length} listing{listings.length === 1 ? '' : 's'} across venues
        </span>
        {loading && <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xxs)' }}>loading quotes…</span>}
        <span style={{ marginLeft: 'auto' }}><ProvenanceBadge provenance={provenance} compact /></span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)' }}>
            {['TICKER', 'VENUE', 'MIC', 'CCY', 'TYPE', 'LAST', 'CHG%', 'SESSION'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 'var(--font-size-xxs)', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)', letterSpacing: 0.5, fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {listings.map((row) => {
            const q = prices[row.yahooSymbol];
            const chgUp = (q?.changePercent ?? 0) >= 0;
            const session = venueSessionState(row.sessionTz);
            return (
              <tr
                key={`${row.symbol}-${row.mic}`}
                className="row-hover"
                onClick={() => setSymbol(row.symbol.includes('.') && !row.symbol.startsWith('BRK') ? row.symbol : row.symbol)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--row-divider)' }}
                title={`Load ${row.symbol} into linked panes`}
              >
                <td style={{ padding: '4px 8px', fontWeight: 700, color: 'var(--accent)' }}>{row.symbol}</td>
                <td style={{ padding: '4px 8px', color: 'var(--text)' }}>{row.venue}</td>
                <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>{row.mic}</td>
                <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>{row.currency}</td>
                <td style={{ padding: '4px 8px' }}>
                  <span style={{ fontSize: 'var(--font-size-xxs)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '0 4px', color: row.listingType === 'PRIMARY' ? 'var(--positive)' : 'var(--text-dim)' }}>
                    {row.listingType}
                  </span>
                </td>
                <td style={{ padding: '4px 8px', color: 'var(--text-bright)', fontVariantNumeric: 'tabular-nums' }}>{q?.price != null ? q.price.toFixed(2) : '—'}</td>
                <td style={{ padding: '4px 8px', color: q?.changePercent == null ? 'var(--text-mute)' : chgUp ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>
                  {q?.changePercent != null ? `${chgUp ? '+' : ''}${q.changePercent.toFixed(2)}%` : '—'}
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-xxs)', color: session.open ? 'var(--positive)' : 'var(--text-faint)' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: session.open ? 'var(--positive)' : 'var(--text-faint)' }} />
                    {session.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ padding: '6px 12px', fontSize: 'var(--font-size-xxs)', color: 'var(--text-faint)' }}>
        Click a listing row to load that regional instrument into linked panes. Session state is the venue&apos;s local regular session.
      </div>
    </div>
  );
}
