import { NextResponse } from 'next/server';
import { godelPost } from '@/lib/godel';

export async function POST(
	_req: Request,
	{ params }: { params: Promise<{ seriesId: string }> },
) {
	const { seriesId } = await params;
	try {
		const data = await godelPost('api', '/api/v1/shortinterest', {
			seriesId: Number(seriesId),
		});
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
