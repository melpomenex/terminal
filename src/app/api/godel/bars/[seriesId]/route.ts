import { NextResponse } from 'next/server';
import { godelPost } from '@/lib/godel';

const RESOLUTION_MAP: Record<string, string> = {
	'1D': '1',
	'5D': '5',
	'1M': '15',
	'3M': '60',
	'6M': 'D',
	'1Y': 'W',
};

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ seriesId: string }> },
) {
	const { seriesId } = await params;
	const url = new URL(request.url);
	const range = url.searchParams.get('range') ?? '6M';
	const countBack = Number(url.searchParams.get('countBack') ?? 200);
	const from = Number(url.searchParams.get('from') ?? 0);
	const to = Number(url.searchParams.get('to') ?? Math.floor(Date.now() / 1000));
	const resolution = RESOLUTION_MAP[range] ?? 'D';

	try {
		const raw = (await godelPost('api', '/api/tv-advanced/bars', {
			seriesId: Number(seriesId),
			resolution,
			countBack,
			from,
			to,
			firstDataRequest: true,
			hideAnomalies: true,
		})) as Record<string, unknown>;

		const bars = (raw.bars ?? raw.t ?? []) as Array<Record<string, unknown>>;
		const meta = (raw.meta ?? raw.s ?? raw.symbol_info ?? {}) as Record<string, unknown>;

		const timestamps = bars.map((b) => Number(b.time ?? b.t ?? 0));
		const open = bars.map((b) => Number(b.open ?? b.o ?? 0));
		const high = bars.map((b) => Number(b.high ?? b.h ?? 0));
		const low = bars.map((b) => Number(b.low ?? b.l ?? 0));
		const close = bars.map((b) => Number(b.close ?? b.c ?? 0));
		const volume = bars.map((b) => Number(b.volume ?? b.v ?? 0));

		const price = close.length > 0 ? close[close.length - 1] : null;
		const prevClose = close.length > 1 ? close[close.length - 2] : null;

		return NextResponse.json({
			symbol: String(meta.symbol ?? meta.ticker ?? ''),
			price,
			previousClose: meta.previousClose ?? meta.prev_close ?? prevClose ?? null,
			high52w: meta.high52w ? Number(meta.high52w) : null,
			low52w: meta.low52w ? Number(meta.low52w) : null,
			currency: String(meta.currency ?? meta.currency_code ?? ''),
			exchange: String(meta.exchange ?? meta.exchange_name ?? ''),
			timestamps,
			open,
			high,
			low,
			close,
			volume,
		});
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
