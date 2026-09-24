import { NextResponse } from 'next/server';
import { godelPost } from '@/lib/godel';

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const data = await godelPost('api', '/api/news/sub_categories', body);
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
