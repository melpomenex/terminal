import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta } from '@/lib/yahoo';

export async function GET(_req: Request) {
	const symbols = new URL(_req.url).searchParams
		.get('symbols')
		?.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (!symbols?.length) return NextResponse.json({ items: [] });

	const results: Array<Record<string, unknown>> = [];

	for (const sym of symbols) {
		try {
			const raw = curl(yfChartUrl(sym, '5d', '1d')) as Record<string, unknown>;
			const meta = extractMeta(raw);
			const price = Number(meta.price ?? 0);
			const prev = Number(meta.previousClose ?? 0);
			results.push({
				symbol: sym,
				price,
				previousClose: prev,
				change: price - prev,
				changePercent: prev > 0 ? ((price - prev) / prev) * 100 : 0,
				high52w: meta.high52w,
				low52w: meta.low52w,
			});
		} catch {
			results.push({ symbol: sym, price: null, previousClose: null, change: null, changePercent: null });
		}
	}

	return NextResponse.json({ items: results });
}
