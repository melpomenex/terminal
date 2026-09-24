import { NextResponse } from 'next/server';
import { godelGet } from '@/lib/godel';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ seriesId: string }> },
) {
	const { seriesId } = await params;
	try {
		const data = await godelGet('/api/v1/earnings-estimates', { seriesId });
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
