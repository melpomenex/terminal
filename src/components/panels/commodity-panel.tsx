'use client';

import { useEffect, useState } from 'react';
import type { WatchlistItem } from '@/lib/types';

const SYMBOLS = [
  'GC=F', 'CL=F', 'SI=F', 'NG=F',
  'ZC=F', 'ZW=F', 'ZS=F', 'HG=F',
  'PL=F', 'PA=F',
];

const NAMES: Record<string, string> = {
  'GC=F': 'GOLD',
  'CL=F': 'CRUDE OIL',
  'SI=F': 'SILVER',
  'NG=F': 'NAT GAS',
  'ZC=F': 'CORN',
  'ZW=F': 'WHEAT',
  'ZS=F': 'SOYBEANS',
  'HG=F': 'COPPER',
  'PL=F': 'PLATINUM',
  'PA=F': 'PALLADIUM',
};

const UNITS: Record<string, string> = {
  'GC=F': '$/oz',
  'CL=F': '$/bbl',
  'SI=F': '$/oz',
  'NG=F': '$/MMBtu',
  'ZC=F': '$/bu',
  'ZW=F': '$/bu',
  'ZS=F': '$/bu',
  'HG=F': '$/lb',
  'PL=F': '$/oz',
  'PA=F': '$/oz',
};

const COLS = '1fr 72px 64px 64px 72px';

export default function CommodityPanel({ panelId }: { panelId?: string }) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchCommodities() {
      try {
        const res = await fetch(`/api/yfin/watchlist?symbols=${SYMBOLS.join(',')}`);
        const json = await res.json();
        if (!cancelled) {
          setItems(json.items ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCommodities();
    const id = setInterval(fetchCommodities, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) return <div style={{ padding: 8, color: 'var(--amber-dim)', fontFamily: 'var(--font)', fontSize: 12 }}>LOADING...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)' }}>
      <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--amber-dim)', display: 'grid', gridTemplateColumns: COLS }}>
        <span>CONTRACT</span>
        <span style={{ textAlign: 'right' }}>LAST</span>
        <span style={{ textAlign: 'right' }}>CHG</span>
        <span style={{ textAlign: 'right' }}>CHG %</span>
        <span style={{ textAlign: 'right' }}>UNIT</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {SYMBOLS.map((sym) => {
          const item = items.find((i) => i.symbol === sym);
          const price = item?.price;
          const change = item?.change;
          const changePercent = item?.changePercent;
          const isUp = changePercent != null && changePercent >= 0;
          const name = NAMES[sym] ?? sym;
          const unit = UNITS[sym] ?? '';

          return (
            <div key={sym} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '3px 8px', fontSize: 13, color: 'var(--amber)' }}>
              <span style={{ fontWeight: 700 }}>{name}</span>
              <span style={{ textAlign: 'right' }}>{price != null ? price.toFixed(2) : '---'}</span>
              <span style={{ textAlign: 'right', color: change == null ? 'var(--amber-dim)' : isUp ? 'var(--green)' : 'var(--red)' }}>
                {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}` : '---'}
              </span>
              <span style={{ textAlign: 'right', color: changePercent == null ? 'var(--amber-dim)' : isUp ? 'var(--green)' : 'var(--red)' }}>
                {changePercent != null ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '---'}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--amber-dim)', fontSize: 11 }}>{unit}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
