import { NextResponse } from 'next/server';

interface RssItem {
	title: string;
	link: string;
	description: string;
	pubDate: string;
	source: string;
	tickers: string[];
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const TIMEOUT = 10000;

async function fetchRss(url: string, source: string, extractTickers?: boolean): Promise<RssItem[]> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': UA, Accept: 'application/rss+xml, text/xml, */*' },
			signal: ctrl.signal,
		});
		if (!res.ok) return [];
		const text = await res.text();
		const items: RssItem[] = [];
		// Simple regex-based RSS parser — avoids heavy XML deps
		const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
		let match;
		while ((match = itemRegex.exec(text)) !== null) {
			const block = match[1];
			const title = (block.match(/<title(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] ?? '').trim();
			const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? '').trim();
			const desc = (block.match(/<description(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] ?? '').trim()
				.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
			const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? '').trim();
			// Extract tickers from Seeking Alpha <category> tags
			const tickers: string[] = [];
			if (extractTickers) {
				const catRegex = /<category[^>]*domain="[^"]*symbol[^"]*"[^>]*>([\s\S]*?)<\/category>/gi;
				let catMatch;
				while ((catMatch = catRegex.exec(block)) !== null) {
					const sym = catMatch[1].trim().toUpperCase();
					if (sym && /^[A-Z]{1,6}[:.]?[A-Z]?$/.test(sym) && !tickers.includes(sym)) {
						tickers.push(sym);
					}
				}
			}
			if (title) items.push({ title, link, description: desc, pubDate, source, tickers });
		}
		return items;
	} catch {
		return [];
	} finally {
		clearTimeout(timer);
	}
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const mode = searchParams.get('mode') ?? 'top'; // 'top' or 'breaking'

	const [cnbc, mw, nyt, sa, zh] = await Promise.all([
		fetchRss('https://www.cnbc.com/id/100003114/device/rss/rss.html', 'CNBC'),
		fetchRss('https://www.marketwatch.com/rss/topstories', 'MarketWatch'),
		fetchRss('https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'NYT'),
		fetchRss('https://seekingalpha.com/market_currents.xml', 'SeekingAlpha', true),
		fetchRss('https://feeds.feedburner.com/zerohedge/feed', 'ZeroHedge'),
	]);

	const all = [...sa, ...zh, ...cnbc, ...mw, ...nyt];

	if (mode === 'breaking') {
		// Breaking: Seeking Alpha first (fastest, ticker-tagged), deduplicate by title
		const seen = new Set<string>();
		const deduped = all.filter(item => {
			const key = item.title.slice(0, 60).toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		return NextResponse.json(deduped.slice(0, 50));
	}

	// Top: deduplicate, interleave sources, show descriptions
	const seen = new Set<string>();
	const deduped = all.filter(item => {
		const key = item.title.slice(0, 60).toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	return NextResponse.json(deduped.slice(0, 50));
}
