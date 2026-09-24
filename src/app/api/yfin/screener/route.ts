import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

const PRESETS = [
  'most_actives', 'day_gainers', 'day_losers',
  'undervalued_large_caps', 'small_cap_gainers',
  'aggressive_small_caps', 'growth_technology_stocks',
] as const;

const SP500_TICKERS = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK-B','LLY','AVGO',
  'JPM','V','UNH','XOM','MA','JNJ','PG','COST','ABBV','HD',
  'MRK','CVX','AMD','PEP','KO','ADBE','WMT','MCD','CSCO','INTC',
  'CRM','NFLX','DIS','CMCSA','PFE','TMO','ABT','NKE','DHR','VZ',
  'ORCL','ACN','TXN','WFC','COP','BMY','UPS','RTX','QCOM','LOW',
  'NEE','LIN','PM','SPGI','HON','INTU','GS','AMGN','BLK','ISRG',
  'AXP','ELV','CME','DE','BKNG','MDLZ','SYK','ADP','GILD','REGN',
  'VRTX','LRCX','MU','CI','PGR','MMC','ZTS','CB','BDX','EOG',
  'SLB','SO','DUK','PLD','SHW','CL','CSX','MET','ATVI','F',
  'ITW','APD','ICE','TJX','FIS','NSC','PNC','PYPL','AIG','C',
];

const SECTOR_ETF: Record<string, string[]> = {
  'Technology': ['XLK','AAPL','MSFT','GOOGL','AMZN','NVDA','META','AVGO','AMD','ADBE','CRM','INTC','CSCO','ORCL','ACN','TXN','QCOM','INTU','MU','LRCX'],
  'Healthcare': ['XLV','UNH','LLY','JNJ','ABBV','MRK','PFE','ABT','TMO','MRNA','DHR','SYK','GILD','REGN','VRTX','CI','BDX','ZTS','ISRG','BIIB'],
  'Financials': ['XLF','JPM','V','MA','BAC','WFC','GS','BLK','CME','AXP','SPGI','ICE','PNC','C','MET','AIG','CB','SCHW','USB','PGR'],
  'Energy': ['XLE','XOM','CVX','COP','SLB','EOG','OXY','PXD','MPC','VLO','WMB','OKE','KMI','HAL','DVN','FANG','CVE','SU','EQT','HES'],
  'Consumer Disc.': ['XLY','TSLA','AMZN','HD','MCD','NKE','LOW','BKNG','TJX','SBUX','CMG','TGT','LULU','RCL','MAR','YUM','DLTR','ROST'],
  'Consumer Staples': ['XLP','PG','KO','PEP','COST','WMT','MDLZ','CL','EL','STZ','MO','PM','KMB','CLX','GIS','HSY','CPB','SJM','CAG','KR'],
  'Industrials': ['XLI','RTX','UPS','HON','DE','CAT','UNP','NSC','CSX','BA','LMT','NOC','GD','GE','MMM','ITW','EMR','ETN','CMI','PH'],
  'Materials': ['XLB','LIN','APD','SHW','DD','ECL','FCX','NEM','NUE','DOW','PPG','IFF','ALB','CE','FMC','EMN','VMC','MLM','IP','BALL'],
  'Utilities': ['XLU','NEE','DUK','SO','D','AEP','EXC','SRE','XEL','PEG','WEC','ES','ED','AWK','DTE','AEE','ETR','FE','PPL'],
  'Real Estate': ['XLRE','PLD','AMT','CCI','EQIX','PSA','SPG','O','DLR','WELL','VICI','AVB','EQR','INVH','CSGP','ARE','WY','ESS','UDR','MAA'],
  'Communication': ['XLC','NFLX','DIS','CMCSA','T','VZ','TMUS','GOOGL','META','EA','TTWO','WBD','OMC','IPG','LYV','PARA','FOX','FOXA','NWSA','CHTR'],
};

function asyncCurl(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const args = ['-H', `User-Agent: Mozilla/5.0 (compatible; Qube/1.0)`, '-H', 'Accept: application/json', '--compressed', '-s', '--max-time', '15', url];
    const cmd = `curl ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`;
    exec(cmd, { maxBuffer: 5 * 1024 * 1024, timeout: 20000, encoding: 'utf-8' }, (err, stdout) => {
      if (err) { resolve({}); return; }
      try { resolve(JSON.parse(stdout)); } catch { resolve({}); }
    });
  });
}

async function fetchChartBatch(symbols: string[]): Promise<Array<{ symbol: string; price: number; changePercent: number }>> {
  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const raw = await asyncCurl(yfChartUrl(sym, '5d', '1d'));
        const meta = extractMeta(raw);
        const price = Number(meta.price ?? 0);
        const prev = Number(meta.previousClose ?? 0);
        return { symbol: sym, price, changePercent: prev > 0 ? ((price - prev) / prev) * 100 : 0 };
      } catch {
        return { symbol: sym, price: 0, changePercent: 0 };
      }
    }),
  );
  return results;
}

// Approximate market caps for major tickers (used when no marketCap from API)
const APPROX_MCAP: Record<string, number> = {
  'AAPL': 3.0e12, 'MSFT': 2.8e12, 'GOOGL': 2.0e12, 'AMZN': 1.9e12, 'NVDA': 2.5e12,
  'META': 1.3e12, 'TSLA': 0.8e12, 'BRK-B': 0.9e12, 'LLY': 0.75e12, 'AVGO': 0.7e12,
  'JPM': 0.55e12, 'V': 0.55e12, 'UNH': 0.5e12, 'XOM': 0.45e12, 'MA': 0.4e12,
  'JNJ': 0.38e12, 'PG': 0.35e12, 'COST': 0.35e12, 'ABBV': 0.3e12, 'HD': 0.35e12,
};
const DEFAULT_MCAP = 100e9; // 100B default for S&P 500 companies

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const preset = sp.get('preset') ?? 'most_actives';
  const mode = sp.get('mode') ?? 'preset';

  try {
    if (mode === 'sp500') return await fetchSp500Parallel();
    if (mode === 'sectors') return await fetchSectors();
    if (mode === 'world') return await fetchWorld();
    return await fetchPreset(preset);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

async function fetchPreset(preset: string) {
  if (!PRESETS.includes(preset as typeof PRESETS[number])) {
    return NextResponse.json({ error: 'Invalid preset' }, { status: 400 });
  }

  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${encodeURIComponent(preset)}&count=100`;
  const raw = curl(url) as Record<string, unknown>;
  const finance = raw.finance as Array<Record<string, unknown>> | undefined;
  const result = finance?.[0];
  const quotes = (result?.quotes as Array<Record<string, unknown>>) ?? [];

  const items = quotes.map((q) => ({
    symbol: String(q.symbol ?? ''),
    name: String(q.shortName ?? q.longName ?? ''),
    price: Number(q.regularMarketPrice ?? 0),
    changePercent: Number(q.regularMarketChangePercent ?? 0),
    marketCap: Number(q.marketCap ?? 0),
    sector: String(q.sector ?? ''),
    pe: Number(q.trailingPE ?? q.forwardPE ?? 0) || null,
    dividendYield: Number(q.dividendYield ?? 0) || null,
    volume: Number(q.regularMarketVolume ?? 0),
  }));

  return NextResponse.json({ items });
}

async function fetchSp500Parallel() {
  const batchResults = await fetchChartBatch(SP500_TICKERS);
  const items = batchResults.map((r) => ({
    symbol: r.symbol,
    name: r.symbol,
    price: r.price,
    changePercent: r.changePercent,
    marketCap: APPROX_MCAP[r.symbol] ?? DEFAULT_MCAP,
    sector: '',
    pe: null,
    dividendYield: null,
    volume: 0,
  }));
  return NextResponse.json({ items });
}

async function fetchSectors() {
  const etfSymbols = Object.values(SECTOR_ETF).map(t => t[0]);
  const batchResults = await fetchChartBatch(etfSymbols);
  const resultMap = new Map(batchResults.map(r => [r.symbol, r]));

  const items = [];
  for (const [sector, tickers] of Object.entries(SECTOR_ETF)) {
    const etfSym = tickers[0];
    const r = resultMap.get(etfSym) ?? { symbol: etfSym, price: 0, changePercent: 0 };
    const approxMcap = r.price > 0 ? r.price * 500e6 : 1e12;
    items.push({
      symbol: etfSym,
      name: sector.toUpperCase(),
      price: r.price,
      changePercent: r.changePercent,
      marketCap: approxMcap,
      sector,
      pe: null,
      dividendYield: null,
      volume: 0,
    });
  }
  return NextResponse.json({ items });
}

async function fetchWorld() {
  const WORLD: Array<{ symbol: string; name: string; marketCap: number }> = [
    { symbol: '^GSPC', name: 'S&P 500', marketCap: 40e12 },
    { symbol: '^DJI', name: 'DOW 30', marketCap: 15e12 },
    { symbol: '^IXIC', name: 'NASDAQ', marketCap: 25e12 },
    { symbol: '^FTSE', name: 'FTSE 100', marketCap: 4e12 },
    { symbol: '^N225', name: 'NIKKEI 225', marketCap: 7e12 },
    { symbol: '^HSI', name: 'HANG SENG', marketCap: 5e12 },
    { symbol: '^FCHI', name: 'CAC 40', marketCap: 3e12 },
    { symbol: '^GDAXI', name: 'DAX', marketCap: 2.5e12 },
    { symbol: '^AXJO', name: 'ASX 200', marketCap: 1.5e12 },
    { symbol: '^GSPTSE', name: 'S&P TSX', marketCap: 3e12 },
    { symbol: '^BVSP', name: 'BOVESPA', marketCap: 1e12 },
    { symbol: '^NSEI', name: 'NIFTY 50', marketCap: 4e12 },
    { symbol: '^KS11', name: 'KOSPI', marketCap: 2e12 },
    { symbol: '000001.SS', name: 'SSE COMP', marketCap: 8e12 },
    { symbol: '^STOXX50E', name: 'EURO STOXX', marketCap: 5e12 },
    { symbol: '^TWII', name: 'TAIEX', marketCap: 1.8e12 },
    { symbol: '^BSESN', name: 'SENSEX', marketCap: 3.5e12 },
    { symbol: 'IMOEX.ME', name: 'MOEX', marketCap: 0.5e12 },
    { symbol: '^JKSE', name: 'JAKARTA', marketCap: 0.6e12 },
    { symbol: '^MXX', name: 'IPC MEXICO', marketCap: 0.5e12 },
  ];

  const batchResults = await fetchChartBatch(WORLD.map(w => w.symbol));
  const resultMap = new Map(batchResults.map(r => [r.symbol, r]));

  const items = WORLD.map((entry) => {
    const r = resultMap.get(entry.symbol) ?? { price: 0, changePercent: 0 };
    return {
      symbol: entry.symbol,
      name: entry.name,
      price: r.price,
      changePercent: r.changePercent,
      marketCap: entry.marketCap,
      sector: '',
      pe: null,
      dividendYield: null,
      volume: 0,
    };
  });
  return NextResponse.json({ items });
}
