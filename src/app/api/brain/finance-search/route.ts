import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

interface FinanceRequestBody {
  query: string;
  settings: { perplexityKey: string };
  config?: 'fast' | 'balanced' | 'deep';
}

type FinanceResultItem = {
  category: string;
  tickers: string[];
  content: string;
  sources: string[];
};

const CONFIG_PRESETS = {
  fast: {
    model: 'perplexity/sonar',
    tools: [{ type: 'finance_search' }],
    max_steps: 1,
    max_output_tokens: 1024,
    timeoutMs: 30_000,
  },
  balanced: {
    model: 'openai/gpt-5.4-mini',
    tools: [{ type: 'web_search' }, { type: 'finance_search' }, { type: 'fetch_url' }],
    max_steps: 5,
    max_output_tokens: 2048,
    reasoning: { effort: 'low' },
    timeoutMs: 45_000,
  },
  deep: {
    model: 'anthropic/claude-opus-4-7',
    tools: [{ type: 'web_search' }, { type: 'finance_search' }, { type: 'fetch_url' }],
    max_steps: 10,
    max_output_tokens: 4096,
    timeoutMs: 60_000,
  },
} as const;

function parseFinanceResults(output: any[]): FinanceResultItem[] {
  const results: FinanceResultItem[] = [];

  for (const item of output) {
    if (item.type === 'finance_results') {
      const tickers = item.tickers || [];
      for (const r of item.results || []) {
        results.push({
          category: r.category || item.categories?.[0] || 'data',
          tickers: r.tickers || tickers,
          content: r.content || '',
          sources: (r.sources || []).map((s: any) =>
            typeof s === 'string' ? s : s.url || s.title || '',
          ).filter(Boolean),
        });
      }
    }
  }

  // Deduplicate by category+content hash
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.category}:${r.content.slice(0, 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSummaryText(output: any[]): string {
  // Last message item is the AI summary
  for (let i = output.length - 1; i >= 0; i--) {
    if (output[i].type === 'message') {
      const content = output[i].content;
      // content can be a string or an array of {text, type} objects
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content
          .filter((c: any) => c.type === 'output_text' && c.text)
          .map((c: any) => c.text)
          .join('');
      }
      return '';
    }
  }
  return '';
}

function extractSources(output: any[]): string[] {
  const sources = new Set<string>();
  for (const item of output) {
    if (item.type === 'finance_results') {
      for (const r of item.results || []) {
        for (const s of r.sources || []) {
          const url = typeof s === 'string' ? s : s.url || s.title || '';
          if (url) sources.add(url);
        }
      }
    }
  }
  return [...sources];
}

export async function POST(request: NextRequest) {
  try {
    const body: FinanceRequestBody = await request.json();
    const { query, settings, config = 'balanced' } = body;

    if (!settings?.perplexityKey) {
      return NextResponse.json(
        { error: 'Perplexity API key not configured. Set it in Brain Settings.' },
        { status: 400 },
      );
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 });
    }

    const preset = CONFIG_PRESETS[config];
    if (!preset) {
      return NextResponse.json({ error: `Unknown config: ${config}` }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), preset.timeoutMs);

    const apiBody: Record<string, any> = {
      model: preset.model,
      input: query,
      tools: preset.tools,
      max_steps: preset.max_steps,
      max_output_tokens: preset.max_output_tokens,
    };

    // Only include reasoning for models that support it (openai/gpt-5.x family)
    if ('reasoning' in preset && preset.model.startsWith('openai/gpt-5')) {
      apiBody.reasoning = preset.reasoning;
    }

    let response: Response;
    try {
      response = await fetch('https://api.perplexity.ai/v1/agent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiBody),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return NextResponse.json(
          { error: `Request timed out after ${preset.timeoutMs / 1000}s. Try LIVE mode for faster results.` },
          { status: 504 },
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let errorMessage = `Perplexity API error (${response.status})`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage = parsed.error?.message || parsed.message || errorMessage;
      } catch {}
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    const output = data.output || [];

    const financeResults = parseFinanceResults(output);
    const text = extractSummaryText(output);
    const sources = extractSources(output);

    return NextResponse.json({
      text,
      financeResults,
      usage: data.usage || null,
    });
  } catch (err: any) {
    console.error('[finance-search] Error:', err);
    return NextResponse.json(
      { error: `Internal error: ${err.message || 'Unknown error'}` },
      { status: 500 },
    );
  }
}
