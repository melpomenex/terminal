import { NextResponse } from 'next/server';
import { godelPost } from '@/lib/godel';

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ seriesId: string }> },
) {
	const { seriesId } = await params;
	const url = new URL(request.url);
	const strikesAbove = Number(url.searchParams.get('strikesAbove') ?? 10);
	const strikesBelow = Number(url.searchParams.get('strikesBelow') ?? 10);
	const now = new Date();
	const twoYears = new Date(now);
	twoYears.setFullYear(twoYears.getFullYear() + 2);

	try {
		const data = await godelPost('api', '/api/v1/optionsv2', {
			series_id: Number(seriesId),
			seriesId: Number(seriesId),
			number_of_strikes_above: strikesAbove,
			number_of_strikes_below: strikesBelow,
			start_expiry: now.toISOString(),
			end_expiry: twoYears.toISOString(),
		});
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
