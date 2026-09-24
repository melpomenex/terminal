import { NextResponse } from 'next/server';
import { godelGet } from '@/lib/godel';

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const url = new URL(request.url);
	const size = url.searchParams.get('size') ?? '50';
	const cursor = url.searchParams.get('cursor');

	const paramsObj: Record<string, string> = { size };
	if (cursor) paramsObj.cursor = cursor;

	try {
		const data = await godelGet(`/api/chat/channels/${id}/messages`, paramsObj);
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
