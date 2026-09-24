import { NextResponse } from 'next/server';
import { godelPost } from '@/lib/godel';

export async function GET(request: Request) {
	const url = new URL(request.url);
	const size = url.searchParams.get('size') ?? '30';
	const afterCursor = url.searchParams.get('afterCursor');
	const beforeCursor = url.searchParams.get('beforeCursor');

	const pageable: Record<string, unknown> = { size: Number(size) };
	if (afterCursor) pageable.afterCursor = afterCursor;
	if (beforeCursor) pageable.beforeCursor = beforeCursor;

	try {
		const raw = (await godelPost('api', '/api/news/items', {
			pageable,
			languages: ['en'],
		})) as Record<string, unknown>;

		const items = (raw.items ?? raw.content ?? raw.newsItems ?? []) as Array<Record<string, unknown>>;
		const mapped = items.map((item) => ({
			title: String(item.title ?? ''),
			link: String(item.link ?? item.url ?? ''),
			pubDate: item.publishedAt ?? item.pubDate ?? item.date ?? '',
			source: String(item.source ?? ''),
		}));

		return NextResponse.json({
			items: mapped,
			cursors: {
				afterCursor: raw.afterCursor ?? null,
				beforeCursor: raw.beforeCursor ?? null,
			},
		});
	} catch (e) {
		return NextResponse.json({ error: String(e) }, { status: 502 });
	}
}
