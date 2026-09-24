import { NextResponse } from 'next/server';
import { transcriptsProvider } from '@/lib/providers/transcripts-provider';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase();
  const id = url.searchParams.get('id');

  try {
    if (id) {
      const transcript = await transcriptsProvider.getTranscript(id);
      return NextResponse.json(transcript);
    }
    if (!symbol) return NextResponse.json({ error: 'symbol or id required' }, { status: 400 });
    const list = await transcriptsProvider.getTranscriptsList({
      id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY',
    });
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'transcript fetch failed', quality: 'UNAVAILABLE' },
      { status: 502 },
    );
  }
}
