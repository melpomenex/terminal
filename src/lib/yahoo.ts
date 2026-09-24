import { execSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (compatible; Terminal/1.0)';

const ARGS = ['-H', `User-Agent: ${UA}`, '-H', 'Accept: application/json', '--compressed', '-s', '--max-time', '20'];

function curl(url: string, extra: string[] = []): unknown {
	const args = [...ARGS, '-w', '\n%{http_code}', ...extra, url];
	const cmd = `curl ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`;
	const raw = execSync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 25000, encoding: 'utf-8' });
	const nl = raw.lastIndexOf('\n');
	const body = raw.substring(0, nl);
	const code = raw.substring(nl + 1);
	if (code === '429') throw new Error('Rate limited');
	if (code !== '200') throw new Error(`HTTP ${code}`);
	return JSON.parse(body);
}

export function yfChartUrl(symbol: string, range = '6mo', interval = '1d'): string {
	return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
}

export function extractMeta(raw: Record<string, unknown>): Record<string, unknown> {
	const result = raw as { chart?: { result?: Array<Record<string, unknown>> } };
	const item = result.chart?.result?.[0];
	if (!item) return {};
	const meta = item.meta as Record<string, unknown> | undefined;
	if (!meta) return {};
	return {
		symbol: meta.symbol,
		currency: meta.currency,
		exchange: meta.exchangeName,
		price: meta.regularMarketPrice,
		previousClose: meta.chartPreviousClose ?? meta.previousClose,
		high52w: meta.fiftyTwoWeekHigh,
		low52w: meta.fiftyTwoWeekLow,
	};
}

export function extractOHLCV(raw: Record<string, unknown>): Record<string, unknown> {
	const result = raw as { chart?: { result?: Array<Record<string, unknown>> } };
	const item = result.chart?.result?.[0];
	if (!item || !item.timestamp) return {};
	const ts = item.timestamp as number[];
	const indicators = item.indicators as { quote?: Array<Record<string, unknown>> } | undefined;
	const q = indicators?.quote?.[0] ?? {};
	return {
		timestamps: ts,
		open: (q.open as number[])?.map((v: number | null) => v ?? 0),
		high: (q.high as number[])?.map((v: number | null) => v ?? 0),
		low: (q.low as number[])?.map((v: number | null) => v ?? 0),
		close: (q.close as number[])?.map((v: number | null) => v ?? 0),
		volume: (q.volume as number[])?.map((v: number | null) => v ?? 0),
	};
}

export function parseRSS(xml: string): Array<{ title: string; link: string; pubDate: string }> {
	const items: Array<{ title: string; link: string; pubDate: string }> = [];
	const re = /<item>([\s\S]*?)<\/item>/g;
	for (const m of xml.matchAll(re)) {
		const chunk = m[1];
		const title =
			chunk.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
			chunk.match(/<title>(.*?)<\/title>/)?.[1] ??
			'';
		const link = chunk.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
		const pubDate = chunk.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
		if (title) items.push({ title, link, pubDate });
	}
	return items;
}

export { curl };
