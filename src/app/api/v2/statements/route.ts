import { NextResponse } from 'next/server';
import { secEdgarStatementsProvider } from '@/lib/providers/financial-statements-provider';
import type { StatementPeriod, StatementType } from '@/lib/providers/contracts';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase();
  const type = (url.searchParams.get('type') ?? 'INCOME_STATEMENT').toUpperCase() as StatementType;
  const period = (url.searchParams.get('period') ?? 'ANNUAL').toUpperCase() as StatementPeriod;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '5', 10) || 5, 8);

  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  if (!['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW'].includes(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
  }
  if (!['ANNUAL', 'QUARTERLY', 'TTM'].includes(period)) {
    return NextResponse.json({ error: 'invalid period' }, { status: 400 });
  }

  try {
    const result = await secEdgarStatementsProvider.getStatements(
      { id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' },
      type, period, limit,
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'statements fetch failed', quality: 'UNAVAILABLE' },
      { status: 502 },
    );
  }
}
