import { NextResponse } from 'next/server';
import { godelGet, GODEL_APP_BASE } from '@/lib/godel';

export async function GET() {
	try {
		const data = await godelGet('/api/fetchBreaking', undefined, GODEL_APP_BASE);
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
