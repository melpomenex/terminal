import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import { parseRSS } from '@/lib/yahoo';

export async function GET() {
	const items: Array<Record<string, unknown>> = [];
	try {
		const bbcRaw = execSync(
			`curl -s --max-time 10 'https://feeds.bbci.co.uk/news/business/rss.xml'`,
			{ encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 },
		);
		for (const item of parseRSS(bbcRaw)) items.push({ ...item, source: 'BBC' });
	} catch {}

	try {
		const cnbcRaw = execSync(
			`curl -s --max-time 10 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&Id=100003114'`,
			{ encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 },
		);
		for (const item of parseRSS(cnbcRaw)) items.push({ ...item, source: 'CNBC' });
	} catch {}

	items.sort((a, b) => {
		const da = new Date(a.pubDate as string).getTime();
		const db = new Date(b.pubDate as string).getTime();
		return db - da;
	});

	return NextResponse.json({ items: items.slice(0, 30) });
}
