import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

interface IndexDef {
  symbol: string;
  name: string;
  region: string;
}

const INDICES: IndexDef[] = [
  // Americas
  { symbol: '^GSPC',    name: 'S&P 500',       region: 'AMERICAS' },
  { symbol: '^DJI',     name: 'DOW 30',        region: 'AMERICAS' },
  { symbol: '^IXIC',    name: 'NASDAQ',         region: 'AMERICAS' },
  { symbol: '^GSPTSE',  name: 'S&P/TSX',        region: 'AMERICAS' },
  { symbol: '^MXX',     name: 'IPC MEXICO',     region: 'AMERICAS' },
  { symbol: '^BVSP',    name: 'BOVESPA',        region: 'AMERICAS' },
  // Europe
  { symbol: '^FTSE',    name: 'FTSE 100',       region: 'EUROPE' },
  { symbol: '^GDAXI',   name: 'DAX',            region: 'EUROPE' },
  { symbol: '^FCHI',    name: 'CAC 40',         region: 'EUROPE' },
  { symbol: '^STOXX50E', name: 'EURO STOXX 50', region: 'EUROPE' },
  { symbol: '^FTMIB',   name: 'FTSE MIB',       region: 'EUROPE' },
  { symbol: '^IBEX',    name: 'IBEX 35',        region: 'EUROPE' },
  // Asia / Pacific
  { symbol: '^N225',    name: 'NIKKEI 225',     region: 'ASIA/PACIFIC' },
  { symbol: '^HSI',     name: 'HANG SENG',      region: 'ASIA/PACIFIC' },
  { symbol: '000001.SS', name: 'SHANGHAI',      region: 'ASIA/PACIFIC' },
  { symbol: '^BSESN',   name: 'BSE SENSEX',     region: 'ASIA/PACIFIC' },
  { symbol: '^AXJO',    name: 'ASX 200',        region: 'ASIA/PACIFIC' },
  { symbol: '^KS11',    name: 'KOSPI',          region: 'ASIA/PACIFIC' },
];

export async function GET() {
  const results = await Promise.all(
    INDICES.map(async (idx) => {
      try {
        const raw = curl(yfChartUrl(idx.symbol, '5d', '1d')) as Record<string, unknown>;
        const meta = extractMeta(raw);
        const price = Number(meta.price ?? 0);
        const prev = Number(meta.previousClose ?? 0);
        return {
          symbol: idx.symbol,
          name: idx.name,
          region: idx.region,
          price,
          change: price - prev,
          changePercent: prev > 0 ? ((price - prev) / prev) * 100 : 0,
          exchange: String(meta.exchange ?? ''),
        };
      } catch {
        return {
          symbol: idx.symbol,
          name: idx.name,
          region: idx.region,
          price: null as number | null,
          change: null as number | null,
          changePercent: null as number | null,
          exchange: '',
        };
      }
    }),
  );

  return NextResponse.json(results);
}
