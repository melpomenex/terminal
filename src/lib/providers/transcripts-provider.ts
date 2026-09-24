/**
 * Structured Transcripts Provider.
 *
 * Earnings-call transcripts are not published by the SEC; the free public
 * source of record is Motley Fool's transcript pages. This provider fetches
 * their public quote/earnings-call-transcript pages and partitions them into
 * speaker segments (prepared remarks vs Q&A). When the source cannot be
 * reached or a quarter has no transcript, it returns an explicit
 * UNAVAILABLE result — transcripts are never synthesized.
 *
 * Server-side only (node fetch via curl helper).
 */

import type { InstrumentRef } from '@/lib/types/instrument';
import { makeProvenance } from '@/lib/types/provenance';
import type {
  ITranscriptsProvider,
  StructuredTranscript,
  TranscriptMetadata,
  TranscriptSegment,
} from '@/lib/providers/contracts';
import { execSync } from 'node:child_process';

function httpGet(url: string): string | null {
  try {
    return execSync(
      `curl -s --max-time 20 -L -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' '${url.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024, timeout: 25_000 },
    );
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const EXECUTIVE_TITLES = /\b(CEO|CFO|COO|CTO|Chief|President|Chairman|VP|Vice President|Director|Head of|Founder)\b/i;
const ANALYST_TITLES = /\b(Analyst|Research|Equity Research)\b/i;

function classifySpeaker(name: string, role: string): TranscriptSegment['speakerRole'] {
  if (ANALYST_TITLES.test(role) || ANALYST_TITLES.test(name)) return 'ANALYST';
  if (EXECUTIVE_TITLES.test(role) || EXECUTIVE_TITLES.test(name)) return 'EXECUTIVE';
  if (/operator/i.test(name) || /operator/i.test(role)) return 'OPERATOR';
  return 'EXECUTIVE';
}

/** Parse Motley Fool "Prepared Remarks" / "Question & Answer" transcript HTML. */
export function parseTranscriptHtml(html: string, symbol: string, url: string): StructuredTranscript | null {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : `${symbol} Earnings Call Transcript`;

  const dateMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/) ?? html.match(/(\w+ \d{1,2}, \d{4})/);
  const callDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
  const quarterMatch = title.match(/(Q[1-4]\s*\d{4})/i) ?? title.match(/(Q[1-4])/i);
  const quarterLabel = quarterMatch ? quarterMatch[1].toUpperCase().replace(/\s+/g, ' ') : 'Latest';

  // Isolate the transcript body (article content region).
  const bodyStart = html.search(/Prepared Remarks:|prepared-remarks/i);
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html;

  // Speaker lines on MF transcripts are <p><strong>Name</strong> -- role</p> or similar.
  const segments: TranscriptSegment[] = [];
  const speakerRe = /<p[^>]*>\s*(?:<strong>|<b>)?\s*([A-Z][A-Za-z .'\-]{2,40})\s*(?:--[–-]\s*([^<]{0,80}))?\s*(?:<\/strong>|<\/b>)?\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  let inQandA = false;
  let paragraphIndex = 0;
  let rawIdx = 0;

  while ((match = speakerRe.exec(body)) !== null) {
    const name = match[1].trim();
    const role = (match[2] ?? '').trim();
    const text = stripHtml(match[3]);

    // Skip nav/boilerplate speakers
    if (/^(summary|call participants|full conference call transcript|advertisement|copyright)/i.test(name)) continue;
    if (text.length < 20) continue;

    if (/question.{0,10}answer|q\s*&\s*a/i.test(name + role + text.slice(0, 60))) inQandA = true;

    segments.push({
      id: `seg-${rawIdx++}`,
      speakerName: name,
      speakerRole: classifySpeaker(name, role),
      section: inQandA ? 'Q_AND_A' : 'PREPARED_REMARKS',
      text,
      paragraphIndex: paragraphIndex++,
    });
  }

  if (segments.length < 3) return null;

  const wordCount = segments.reduce((s, seg) => s + seg.text.split(/\s+/).length, 0);
  const metadata: TranscriptMetadata = {
    id: `mf:${symbol}:${quarterLabel}`,
    instrument: { id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' },
    quarterLabel,
    callDate,
    title,
    participantCount: new Set(segments.map((s) => s.speakerName)).size,
    wordCount,
    sourceUrl: url,
  };

  return {
    metadata,
    segments,
    provenance: makeProvenance('Motley Fool (public transcript)', 'LIVE', 'USD'),
  };
}

export class MotleyFoolTranscriptsProvider implements ITranscriptsProvider {
  readonly id = 'motley-fool';
  readonly displayName = 'Motley Fool Transcripts';

  async getTranscriptsList(instrument: InstrumentRef): Promise<{ transcripts: TranscriptMetadata[]; provenance: import('@/lib/types/provenance').DataProvenance }> {
    // The Fool transcript index is keyed by ticker slug.
    const html = httpGet(`https://www.fool.com/quote/nasdaq/${instrument.symbol.toLowerCase()}/`);
    if (!html) {
      return { transcripts: [], provenance: makeProvenance('Motley Fool', 'UNAVAILABLE', 'USD', { entitlementRequired: 'Transcript source unreachable' }) };
    }
    const links = [...html.matchAll(/href="(\/earnings\/call-transcripts\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/g)].map((m) => m[1]);
    const quarters = [...new Set(links)].slice(0, 12);
    const transcripts: TranscriptMetadata[] = quarters.map((path, i) => {
      const slug = path.split('/').pop() ?? '';
      const q = slug.match(/q\d-\d{4}/i)?.[0]?.toUpperCase() ?? `T-${i}`;
      return {
        id: `mf:${path}`,
        instrument,
        quarterLabel: q.replace(/(\d{4})(Q)(\d)/, 'Q$3 $1'),
        callDate: path.match(/(\d{4}\/\d{2}\/\d{2})/)?.[1].replace(/\//g, '-') ?? '',
        title: slug.replace(/-/g, ' '),
        sourceUrl: `https://www.fool.com${path}`,
      };
    });
    return { transcripts, provenance: makeProvenance('Motley Fool index', 'LIVE', 'USD') };
  }

  async getTranscript(transcriptId: string): Promise<StructuredTranscript> {
    const url = transcriptId.startsWith('mf:') ? transcriptId.slice(3) : transcriptId;
    const fullUrl = url.startsWith('http') ? url : `https://www.fool.com${url}`;
    const html = httpGet(fullUrl);
    const symbol = fullUrl.match(/([a-z]{1,6})-\d{4}-\d{2}-\d{2}\.aspx/i)?.[1]?.toUpperCase() ?? '';
    const parsed = html ? parseTranscriptHtml(html, symbol || 'N/A', fullUrl) : null;
    if (!parsed) {
      throw new Error('Transcript UNAVAILABLE — source unreachable or structure changed. Qube does not synthesize transcripts.');
    }
    return parsed;
  }
}

export const transcriptsProvider = new MotleyFoolTranscriptsProvider();
