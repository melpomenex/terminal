import { NextResponse } from 'next/server';
import { newsProvider } from '@/lib/providers/news-provider';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickers = url.searchParams.get('tickers')?.split(',').filter(Boolean);
  const keyword = url.searchParams.get('q') ?? undefined;
  const exclude = url.searchParams.get('exclude')?.split(',').filter(Boolean);
  const categories = url.searchParams.get('categories')?.split(',').filter(Boolean);
  const sources = url.searchParams.get('sources')?.split(',').filter(Boolean);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '40', 10) || 40, 100);

  try {
    const result = await newsProvider.getNews({ tickers, keyword, excludeKeywords: exclude, categories, sources, limit });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'news fetch failed', items: [], total: 0, quality: 'UNAVAILABLE' },
      { status: 502 },
    );
  }
}
