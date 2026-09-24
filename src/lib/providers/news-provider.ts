/**
 * News v2 Provider — multi-source aggregation with category classification,
 * ticker tagging, keyword include/exclude and search queries.
 *
 * Sources are public RSS feeds (BBC Business, CNBC top news, CNBC markets,
 * Yahoo Finance, MarketWatch top stories, Reuters via CNBC partnerships).
 * Server-side only.
 */

import type { DataProvenance } from '@/lib/types/provenance';
import { makeProvenance } from '@/lib/types/provenance';
import type { INewsProvider, NewsArticle, NewsQuery } from '@/lib/providers/contracts';
import { execSync } from 'node:child_process';

const FEEDS: Array<{ url: string; source: string; category: string }> = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC', category: 'general' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&Id=100003114', source: 'CNBC', category: 'markets' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&Id=15839069', source: 'CNBC', category: 'earnings' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&Id=20910258', source: 'CNBC', category: 'economy' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch', category: 'markets' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance', category: 'general' },
];

function httpGet(url: string): string | null {
  try {
    return execSync(
      `curl -s --max-time 10 -H 'User-Agent: Mozilla/5.0 (compatible; QubeTerminal/2.0)' '${url.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf-8', maxBuffer: 4 * 1024 * 1024, timeout: 12_000 },
    );
  } catch {
    return null;
  }
}

function xmlEscape(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function parseFeed(xml: string, source: string, category: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = xmlEscape(block.match(/<title>(.*?)<\/title>/)?.[1] ?? '');
    const link = xmlEscape(block.match(/<link>(.*?)<\/link>/)?.[1] ?? '');
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? block.match(/<published>(.*?)<\/published>/)?.[1] ?? '';
    const description = xmlEscape(block.match(/<description>(.*?)<\/description>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
    if (!title || !link) continue;
    const tickers = [...block.matchAll(/<tickers?>(.*?)<\/tickers?>/gi)].flatMap((t) => t[1].split(',').map((s) => s.trim().toUpperCase())).filter(Boolean);

    // Urgency heuristics from publisher flags/title language
    const titleUpper = title.toUpperCase();
    const urgency: NewsArticle['urgency'] =
      /BREAKING|JUST IN/.test(titleUpper) ? 'high' : /(earnings|fed|inflation|rate|recession|crash|surge|plunge)/i.test(title) ? 'medium' : 'low';

    items.push({
      id: `${source}:${link.slice(-72)}`,
      title,
      url: link,
      source,
      publishedAt: pubDate,
      summary: description.slice(0, 320),
      tickers,
      category,
      urgency,
    });
  }
  return items;
}

/** Ticker symbol extraction from headline text (uppercase tokens 1-5 chars). */
function extractTickersFromText(text: string): string[] {
  const candidates = text.match(/\b([A-Z]{2,5})\b/g) ?? [];
  const knownNonTickers = new Set(['US', 'UK', 'EU', 'Fed', 'IPO', 'CEO', 'CFO', 'AI', 'ETF', 'GDP', 'CPI', 'USA', 'NYSE', 'FOMC', 'AM', 'PM', 'ET', 'THE', 'AND', 'FOR', 'NEW', 'HOW', 'WHY']);
  return [...new Set(candidates.filter((c) => !knownNonTickers.has(c)))].slice(0, 5);
}

export class MultiSourceNewsProvider implements INewsProvider {
  readonly id = 'rss-multi';
  readonly displayName = 'Multi-Source RSS (BBC/CNBC/MW/Yahoo)';

  async getNews(query: NewsQuery): Promise<{ items: NewsArticle[]; total: number; provenance: DataProvenance }> {
    const all: NewsArticle[] = [];
    await Promise.all(FEEDS.map(async (feed) => {
      const xml = httpGet(feed.url);
      if (xml) all.push(...parseFeed(xml, feed.source, feed.category));
    }));

    // Dedup by normalized title
    const seen = new Set<string>();
    let items = all.filter((a) => {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Enrich tickers from headline when the feed didn't tag any
    for (const item of items) {
      if (item.tickers.length === 0) item.tickers = extractTickersFromText(item.title);
    }

    // Filters
    if (query.tickers?.length) {
      const wanted = new Set(query.tickers.map((t) => t.toUpperCase()));
      items = items.filter((a) => a.tickers.some((t) => wanted.has(t)) || wanted.has('ALL'));
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      items = items.filter((a) => a.title.toLowerCase().includes(kw) || (a.summary ?? '').toLowerCase().includes(kw));
    }
    if (query.excludeKeywords?.length) {
      const exclude = query.excludeKeywords;
      items = items.filter((a) => !exclude.some((x) => a.title.toLowerCase().includes(x.toLowerCase())));
    }
    if (query.categories?.length && !query.categories.includes('all')) {
      const cats = new Set(query.categories);
      items = items.filter((a) => cats.has(a.category ?? 'general'));
    }
    if (query.sources?.length && !query.sources.includes('All')) {
      const srcs = new Set(query.sources);
      items = items.filter((a) => srcs.has(a.source));
    }

    items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.source.localeCompare(b.source));
    const total = items.length;
    const limit = query.limit ?? 40;
    return { items: items.slice(0, limit), total, provenance: makeProvenance('RSS aggregation (BBC, CNBC, MarketWatch, Yahoo)', 'LIVE', 'USD') };
  }
}

export const newsProvider = new MultiSourceNewsProvider();
