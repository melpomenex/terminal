import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query, perplexityKey } = await req.json() as { query: string; perplexityKey: string };

    if (!perplexityKey) {
      return NextResponse.json({ error: 'Perplexity API key not configured' }, { status: 400 });
    }
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Be precise and concise. Provide citations.' },
          { role: 'user', content: query },
        ],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json({ error: 'Perplexity rate limit exceeded' }, { status: 429 });
      }
      return NextResponse.json({ error: `Perplexity API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };

    return NextResponse.json({
      answer: data.choices?.[0]?.message?.content ?? '',
      citations: (data.citations ?? []).map((url, i) => ({ title: `Source ${i + 1}`, url })),
    });
  } catch (e: any) {
    if (e?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Research request timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: `Research error: ${String(e)}` }, { status: 500 });
  }
}
