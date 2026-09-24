import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

/**
 * Exchange trade halts — real-time feed from NasdaqTrader's public
 * tradehalts RSS (LULD/T1-T12 halt codes with resumption times).
 */

export const dynamic = 'force-dynamic';

interface Halt {
  id: string;
  symbol: string;
  marketCenter: string;
  haltDate: string;
  haltTime: string;
  reasonCode: string;
  reasonLabel: string;
  resumptionDate?: string;
  resumptionTime?: string;
  quoteOnly: boolean;
}

/** SEC / Nasdaq halt reason code table (public reference). */
const REASON_CODES: Record<string, string> = {
  T1: 'News Pending',
  T12: 'Trading Halted — Additional Information Requested',
  T2: 'News Dissemination',
  T5: 'Non-Compliance Filing Requirements',
  T6: 'Extraordinary Market Volatility (LULD)',
  T7: 'Not Available / Regulatory Concern',
  T8: 'ETF Related',
  T10: 'Mismatch',
  T11: 'Qualification Delay',
  T12U: 'Trading Suspended by SEC (U.S. Securities and Exchange Commission)',
  T15: 'One-Sided Market',
  H10: 'SEC Trading Suspension',
  H11: 'SEC Trading Suspension in Effect',
  LUDP: 'LULD Pause — Straddle State',
  LUD: 'LULD Down',
  LUU: 'LULD Up',
  M: 'LULD Market-Wide Circuit Breaker (Level 1/2/3)',
  M1: 'Level 1 Market-Wide Circuit Breaker (-7%)',
  M2: 'Level 2 Market-Wide Circuit Breaker (-13%)',
  M3: 'Level 3 Market-Wide Circuit Breaker (-20%) — Trading Halted for the Day',
  R4: 'Qualification/Resumption Delay',
  O1: 'Operations — Systems Failure',
  C1: 'Order Imbalance',
  C2: 'Circuit Breaker Halt',
  C3: 'Order Imbalance — Resumption Imminent',
  C4: 'Order Imbalance — Pre-Open',
  C9: 'Order Imbalance — Post-Close',
  Q1: 'Quotation Canceled',
  D1: 'Dark Pool Related',
  Z1: 'Corporate Action',
};

function decodeReason(code: string): string {
  return REASON_CODES[code.toUpperCase()] ?? 'Halt — see reason code';
}

export async function GET() {
  try {
    const xml = execSync(
      `curl -s --max-time 15 -H 'User-Agent: Mozilla/5.0' 'https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts'`,
      { encoding: 'utf-8', maxBuffer: 4 * 1024 * 1024, timeout: 18_000 },
    );

    const halts: Halt[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const tag = (name: string) => {
        const v = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '';
        return v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
      };
      const symbol = tag('tSymbol') || tag('symbol') || tag('title');
      if (!symbol) continue;
      const reasonCode = tag('reasonCode').toUpperCase();
      halts.push({
        id: `${symbol}-${tag('haltDate')}-${tag('haltTime')}-${reasonCode}`,
        symbol,
        marketCenter: tag('marketCenter'),
        haltDate: tag('haltDate'),
        haltTime: tag('haltTime'),
        reasonCode,
        reasonLabel: decodeReason(reasonCode),
        resumptionDate: tag('resumptionDate') || undefined,
        resumptionTime: tag('resumptionTime') || undefined,
        quoteOnly: /q/i.test(tag('pauseType') + tag('haltType')),
      });
    }
    halts.reverse(); // most recent first (feed is oldest-first)

    return NextResponse.json({
      halts,
      provenance: { sourceProvider: 'NasdaqTrader tradehalts RSS', retrievalTimestamp: new Date().toISOString(), quality: 'LIVE', currency: 'USD' },
    });
  } catch {
    return NextResponse.json(
      { halts: [], error: 'halt feed unreachable', provenance: { sourceProvider: 'NasdaqTrader', retrievalTimestamp: new Date().toISOString(), quality: 'UNAVAILABLE', currency: 'USD' } },
      { status: 200 },
    );
  }
}
