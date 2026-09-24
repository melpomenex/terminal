import { NextResponse } from 'next/server';
import { curl } from '@/lib/yahoo';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const symbol = searchParams.get('symbol') || 'AAPL';
	const date = searchParams.get('date') || '';
	try {
		// Use v8 chart endpoint which still works; extract options from key-statistics scrape
		// Yahoo Finance v7 options endpoint is now locked down
		// For now, return empty options data — the panel will show "No data"
		// The chart data still works via the v8 endpoint
		const raw = curl(
			`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
		) as Record<string, unknown>;
		const result = raw as { chart?: { result?: Array<Record<string, unknown>> } };
		const meta = result?.chart?.result?.[0] as Record<string, unknown> | undefined;
		if (!meta) return NextResponse.json({ optionChain: { result: [] } });

		// Extract option-related data from meta if available
		const hasOptions = meta?.hasPrePostMarketData !== undefined || meta?.tradeable !== false;
		return NextResponse.json({
			optionChain: {
				result: hasOptions ? [{
					underlyingSymbol: meta.symbol,
					expirationDates: [],
					strikes: [],
					hasMiniOptions: false,
					options: [],
				}] : [],
			},
		});
	} catch (e) {
		return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
	}
}
