import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

/**
 * Filing document reader backend: fetches a primary EDGAR document,
 * sanitizes it for in-terminal rendering, and extracts the section index
 * (Item 1A, Item 7, …) plus the filing's exhibit list.
 */

interface Section { id: string; title: string; anchor: string }

function httpGet(url: string): string | null {
  try {
    return execSync(
      `curl -s --max-time 25 -H 'User-Agent: Qube Terminal research@example.com' '${url.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024, timeout: 28_000 },
    );
  } catch {
    return null;
  }
}

/** Strip interactive/dangerous content; keep SEC inline styling minimal. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '')
    .replace(/ on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '#')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '');
}

const SECTION_RE = /item\s+(\d+[A-C]?)\.?\s+([^<]{0,90})/i;

function extractSections(html: string): Section[] {
  const sections: Section[] = [];
  const seen = new Set<string>();
  // Prefer anchor-tagged TOC entries first
  const anchorRe = /<a[^>]+href="#([^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*([Ii]tem\s+\d+[A-C]?[\s.:–-]*[^<]{0,80})/g;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const rawTitle = m[2].replace(/\s+/g, ' ').trim();
    const parsed = rawTitle.match(SECTION_RE);
    const id = parsed ? `item-${parsed[1].toLowerCase()}` : `sec-${sections.length}`;
    const title = rawTitle.length > 2 ? rawTitle.replace(/^item\s+/i, 'Item ').slice(0, 90) : rawTitle;
    if (title && !seen.has(id)) { seen.add(id); sections.push({ id, title, anchor: m[1] }); }
    if (sections.length >= 40) break;
  }
  // Fall back to heading text
  if (sections.length === 0) {
    const headRe = /<(h[1-4]|b|p)[^>]*>\s*([Ii]tem\s+\d+[A-C]?[\s.:–-][^<]{2,80})\s*<\/\1>/g;
    while ((m = headRe.exec(html)) !== null) {
      const rawTitle = m[2].replace(/\s+/g, ' ').trim();
      const parsed = rawTitle.match(SECTION_RE);
      if (!parsed) continue;
      const id = `item-${parsed[1].toLowerCase()}`;
      if (!seen.has(id)) { seen.add(id); sections.push({ id, title: rawTitle.slice(0, 90), anchor: '' }); }
      if (sections.length >= 40) break;
    }
  }
  return sections;
}

interface IndexEntry { name: string; description: string; type: string }

function extractExhibits(indexJson: string | null): IndexEntry[] {
  if (!indexJson) return [];
  try {
    const dir = JSON.parse(indexJson) as { directory?: { item?: Array<{ name: string; description?: string; type?: string }> } };
    return (dir.directory?.item ?? [])
      .filter((it) => /\.(htm|html|txt)$/i.test(it.name))
      .map((it) => ({ name: it.name, description: it.description ?? '', type: it.type ?? '' }))
      .slice(0, 40);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cik = url.searchParams.get('cik') ?? '';
  const accession = (url.searchParams.get('accession') ?? '').replace(/-/g, '');
  const doc = url.searchParams.get('doc') ?? '';
  if (!cik || !accession || !doc) {
    return NextResponse.json({ error: 'cik, accession, doc required' }, { status: 400 });
  }

  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}`;
  const docUrl = `${base}/${doc}`;
  const html = httpGet(docUrl);
  if (!html) {
    return NextResponse.json({ error: 'document fetch failed', quality: 'UNAVAILABLE' }, { status: 502 });
  }

  const indexJson = httpGet(`${base}/index.json`);
  const exhibits = extractExhibits(indexJson);
  const sections = extractSections(html);
  const sanitized = sanitizeHtml(html);

  return NextResponse.json({
    url: docUrl,
    html: sanitized,
    sections,
    exhibits,
    provenance: {
      sourceProvider: 'SEC EDGAR Archives',
      retrievalTimestamp: new Date().toISOString(),
      quality: 'LIVE',
      currency: 'USD',
    },
  });
}
