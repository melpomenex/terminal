import { NextResponse } from 'next/server';
import { godelGet } from '@/lib/godel';

export async function GET() {
	try {
		const raw = (await godelGet('/api/v1/watchlists')) as Record<string, unknown>;
		const lists = (raw.watchlists ?? raw.items ?? raw.results ?? []) as Array<Record<string, unknown>>;
		const items: Array<Record<string, unknown>> = [];
		const seriesIdMap: Record<string, number> = {};

		for (const list of lists) {
			const instruments = (list.instruments ?? list.items ?? []) as Array<Record<string, unknown>>;
			for (const inst of instruments) {
				const symbol = String(inst.symbol ?? inst.ticker ?? '');
				const price = Number(inst.lastPrice ?? inst.price ?? inst.close ?? 0);
				const prev = Number(inst.previousClose ?? inst.prevClose ?? 0);
				items.push({
					symbol,
					price: price || null,
					previousClose: prev || null,
					change: price && prev ? price - prev : null,
					changePercent: prev > 0 && price ? ((price - prev) / prev) * 100 : null,
					high52w: inst.high52w ? Number(inst.high52w) : null,
					low52w: inst.low52w ? Number(inst.low52w) : null,
					seriesId: inst.seriesId ?? inst.series_id ?? null,
				});
				const sid = inst.seriesId ?? inst.series_id;
				if (sid && symbol) seriesIdMap[symbol] = Number(sid);
			}
		}

		return NextResponse.json({ items, seriesIdMap });
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
