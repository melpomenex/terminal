import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

export async function GET() {
	try {
		const raw = execSync(
			`curl -s --max-time 10 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'`,
			{ encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 },
		);
		const data = JSON.parse(raw);
		return NextResponse.json({ items: data });
	} catch {
		return NextResponse.json({ items: [] });
	}
}
