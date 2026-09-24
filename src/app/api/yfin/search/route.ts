import { NextResponse } from 'next/server';
import { curl } from '@/lib/yahoo';

export async function GET(_req: Request) {
	const q = new URL(_req.url).searchParams.get('q') ?? '';
	if (!q) return NextResponse.json({ quotes: [] }, { status: 400 });
	try {
		const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
		const raw = curl(url) as Record<string, unknown>;
		const quotes = ((raw.quotes as Array<Record<string, unknown>>) ?? []).map((item) => ({
			symbol: item.symbol,
			name: item.longname ?? item.shortname,
			exchange: item.exchange,
			type: item.quoteType,
			score: item.score,
		}));
		return NextResponse.json({ quotes });
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
