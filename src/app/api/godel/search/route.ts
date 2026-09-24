import { NextResponse } from 'next/server';
import { godelGet } from '@/lib/godel';

export async function GET(request: Request) {
	const q = new URL(request.url).searchParams.get('q') ?? '';
	if (!q) return NextResponse.json({ quotes: [] }, { status: 400 });
	try {
		const raw = (await godelGet('/api/v1/search', { query: q })) as Record<string, unknown>;
		const items = (raw.items ?? raw.quotes ?? raw.results ?? []) as Array<Record<string, unknown>>;
		const quotes = items.map((item) => ({
			symbol: String(item.symbol ?? item.ticker ?? ''),
			name: item.longname ?? item.shortname ?? item.name ?? null,
			exchange: item.exchange ?? item.primaryExchange ?? null,
			type: item.quoteType ?? item.instrumentType ?? item.type ?? null,
			score: item.score ?? null,
			seriesId: item.seriesId ?? item.series_id ?? null,
		}));
		return NextResponse.json({ quotes });
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
