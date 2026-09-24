'use client';

import { useState, useMemo } from 'react';

interface HistoricalData {
  timestamps: (string | number)[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

interface Row {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  isUp: boolean | null;
}

type SortCol = 'date' | 'open' | 'high' | 'low' | 'close' | 'volume';

export default function HistoricalDataTable({ data }: { data: HistoricalData }) {
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rows: Row[] = useMemo(() => {
    if (!data || !data.timestamps.length) return [];
    return data.timestamps.map((ts, i) => {
      const o = data.open[i] ?? null;
      const c = data.close[i] ?? null;
      return {
        date: typeof ts === 'number'
          ? new Date(ts * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
          : ts,
        open: o,
        high: data.high[i] ?? null,
        low: data.low[i] ?? null,
        close: c,
        volume: data.volume[i] ?? null,
        isUp: o != null && c != null ? c >= o : null,
      };
    });
  }, [data]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let va: string | number | null = a[sortCol];
      let vb: string | number | null = b[sortCol];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (sortCol === 'date') {
        const da = typeof va === 'number' ? va * 1000 : new Date(va as string).getTime();
        const db = typeof vb === 'number' ? vb * 1000 : new Date(vb as string).getTime();
        return sortDir === 'asc' ? da - db : db - da;
      }
      return sortDir === 'asc'
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return copy;
  }, [rows, sortCol, sortDir]);

  const handleHeaderClick = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'desc');
    }
  };

  const fmtNum = (v: number | null) => (v == null ? '---' : v.toFixed(2));
  const fmtVol = (v: number | null) => {
    if (v == null) return '---';
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  const sortArrow = (col: SortCol): string => {
    if (sortCol !== col) return ' ';
    return sortDir === 'asc' ? '^' : 'v';
  };

  const headerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '90px 1fr 1fr 1fr 1fr 80px',
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font)',
    color: 'var(--amber-dim)',
    background: 'var(--panel-bg)',
    borderBottom: '1px solid var(--border)',
    userSelect: 'none',
    cursor: 'pointer',
    letterSpacing: '0.5px',
  };

  const numCellStyle: React.CSSProperties = {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  };

  if (!rows.length) {
    return (
      <div style={{ padding: 8, color: 'var(--amber-dim)', fontSize: 11 }}>
        NO HISTORICAL DATA
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={headerStyle}>
        {(['date', 'open', 'high', 'low', 'close', 'volume'] as SortCol[]).map((col) => (
          <span
            key={col}
            onClick={() => handleHeaderClick(col)}
            style={{
              ...(col !== 'date' ? numCellStyle : {}),
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span>{col === 'volume' ? 'VOL' : col.toUpperCase()}</span>
            <span style={{ fontSize: 9, color: sortCol === col ? 'var(--amber)' : 'var(--amber-dim)', opacity: sortCol === col ? 1 : 0.4 }}>
              {sortArrow(col)}
            </span>
          </span>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((row, i) => {
        const rowColor = row.isUp === null ? 'var(--amber)' : row.isUp ? 'var(--green)' : 'var(--red)';
        return (
          <div
            key={`${row.date}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 1fr 1fr 1fr 80px',
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'var(--font)',
              borderBottom: '1px solid rgba(51, 34, 0, 0.3)',
              color: 'var(--amber)',
            }}
          >
            <span style={{ color: 'var(--amber-dim)' }}>{row.date}</span>
            <span style={{ ...numCellStyle, color: 'var(--amber)' }}>{fmtNum(row.open)}</span>
            <span style={{ ...numCellStyle, color: 'var(--amber)' }}>{fmtNum(row.high)}</span>
            <span style={{ ...numCellStyle, color: 'var(--amber)' }}>{fmtNum(row.low)}</span>
            <span style={{ ...numCellStyle, color: rowColor, fontWeight: 600 }}>{fmtNum(row.close)}</span>
            <span style={{ ...numCellStyle, color: 'var(--amber-dim)' }}>{fmtVol(row.volume)}</span>
          </div>
        );
      })}
    </div>
  );
}
