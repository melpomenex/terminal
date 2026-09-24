import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

function extractArticle(html: string, url: string) {
	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	let title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';

	// Remove script, style, nav, header, footer, aside elements
	let clean = html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<nav[\s\S]*?<\/nav>/gi, '')
		.replace(/<header[\s\S]*?<\/header>/gi, '')
		.replace(/<footer[\s\S]*?<\/footer>/gi, '')
		.replace(/<aside[\s\S]*?<\/aside>/gi, '')
		.replace(/<svg[\s\S]*?<\/svg>/gi, '');

	// Try common article content selectors
	const articlePatterns = [
		/<article[\s\S]*?<\/article>/i,
		/<div[^>]*class="[^"]*article-body[^"]*"[\s\S]*?<\/div>/i,
		/<div[^>]*class="[^"]*article-content[^"]*"[\s\S]*?<\/div>/i,
		/<div[^>]*class="[^"]*post-content[^"]*"[\s\S]*?<\/div>/i,
		/<div[^>]*class="[^"]*entry-content[^"]*"[\s\S]*?<\/div>/i,
		/<div[^>]*class="[^"]*story-body[^"]*"[\s\S]*?<\/div>/i,
		/<div[^>]*data-testid="article-body"[^>]*>[\s\S]*?<\/div>/i,
		/<div[^>]*id="article-body"[^>]*>[\s\S]*?<\/div>/i,
		/<main[\s\S]*?<\/main>/i,
	];

	let bodyHtml = '';
	for (const pattern of articlePatterns) {
		const m = clean.match(pattern);
		if (m && m[0].length > 200) {
			bodyHtml = m[0];
			break;
		}
	}

	if (!bodyHtml) bodyHtml = clean;

	// Convert to plaintext paragraphs
	bodyHtml = bodyHtml
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<\/li>/gi, '\n')
		.replace(/<h[1-6][^>]*>/gi, '\n\n')
		.replace(/<\/h[1-6]>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		// Decode common HTML entities
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&mdash;/g, '—')
		.replace(/&ndash;/g, '–')
		.replace(/&lsquo;/g, "'")
		.replace(/&rsquo;/g, "'")
		.replace(/&ldquo;/g, '"')
		.replace(/&rdquo;/g, '"')
		.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

	// Split into paragraphs, filter empty/short ones
	const paragraphs = bodyHtml
		.split('\n')
		.map((p) => p.trim())
		.filter((p) => p.length > 20)
		.map((p) => p.replace(/\s+/g, ' '));

	// Extract publication date
	let pubDate = '';
	const datePatterns = [
		/(\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2})/,
		/"datePublished"\s*:\s*"([^"]+)"/,
		/"publishedAt"\s*:\s*"([^"]+)"/,
		/<time[^>]*datetime="([^"]+)"/,
		/<abbr[^>]*class="[^"]*published[^"]*"[^>]*title="([^"]+)"/,
	];
	for (const pattern of datePatterns) {
		const m = html.match(pattern);
		if (m) { pubDate = m[1]; break; }
	}

	// Extract source from URL or meta
	let source = 'News';
	try {
		const u = new URL(url);
		source = u.hostname.replace('www.', '');
	} catch {}

	const authorMatch = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)
		|| html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i);
	const author = authorMatch?.[1] ?? '';

	return { title, paragraphs, pubDate, source, author };
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const url = searchParams.get('url');

	if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

	try {
		const raw = execSync(
			`curl -sL --max-time 15 -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" '${url.replace(/'/g, "'\\''")}'`,
			{ encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
		);

		const article = extractArticle(raw, url);
		return NextResponse.json(article);
	} catch {
		return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
	}
}
