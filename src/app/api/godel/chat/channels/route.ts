import { NextResponse } from 'next/server';
import { godelGet } from '@/lib/godel';

export async function GET() {
	try {
		const data = await godelGet('/api/chat/channels');
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
