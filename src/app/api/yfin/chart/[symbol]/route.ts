import { NextResponse } from 'next/server';
import { curl, yfChartUrl, extractMeta, extractOHLCV } from '@/lib/yahoo';

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
	const { symbol } = await params;
	const u = new URL(_req.url);
	const range = u.searchParams.get('range') ?? '6mo';
	const interval = u.searchParams.get('interval') ?? '1d';
	try {
		const raw = curl(yfChartUrl(symbol, range, interval)) as Record<string, unknown>;
		return NextResponse.json({ ...extractMeta(raw), ...extractOHLCV(raw) });
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
