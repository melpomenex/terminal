import type { WatchlistItem, ChartData } from '@/lib/types';

function esc(v: string): string {
  if (v.includes('"') || v.includes(',') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function exportWatchlistCSV(items: WatchlistItem[]): string {
  const rows = [
    '#,Symbol,Last,Change,Change%,52w High,52w Low',
    ...items.map((item, i) =>
      [
        i + 1,
        esc(item.symbol),
        item.price != null ? item.price.toFixed(2) : '',
        item.change != null ? item.change.toFixed(2) : '',
        item.changePercent != null ? item.changePercent.toFixed(4) : '',
        item.high52w != null ? item.high52w.toFixed(2) : '',
        item.low52w != null ? item.low52w.toFixed(2) : '',
      ].join(',')
    ),
  ];
  return rows.join('\n');
}

export function exportChartCSV(symbol: string, data: ChartData): string {
  const rows = [
    'Date,Open,High,Low,Close,Volume',
    ...data.timestamps.map((ts, i) =>
      [
        new Date(ts).toISOString().slice(0, 10),
        data.open[i] != null ? data.open[i].toFixed(2) : '',
        data.high[i] != null ? data.high[i].toFixed(2) : '',
        data.low[i] != null ? data.low[i].toFixed(2) : '',
        data.close[i] != null ? data.close[i].toFixed(2) : '',
        data.volume[i] != null ? String(data.volume[i]) : '',
      ].join(',')
    ),
  ];
  return rows.join('\n');
}
