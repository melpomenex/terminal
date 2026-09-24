import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs } from 'ai';
import { clientToolDefinitions, serverToolDefinitions, CLIENT_TOOL_NAMES } from '@/lib/brain-tools';
import { buildSystemPrompt } from '@/lib/brain-prompt';
import { curl, yfChartUrl, extractMeta, extractOHLCV } from '@/lib/yahoo';
import { secEdgarStatementsProvider } from '@/lib/providers/financial-statements-provider';
import { transcriptsProvider } from '@/lib/providers/transcripts-provider';
import { tickerToCik, getCompanyFilings } from '@/lib/sec-edgar';
import { blackScholesGreeks, impliedVolatility, yearsToExpiry } from '@/lib/math/options-pricing';
import type { BrainProvider } from '@/lib/brain-types';
import { OPENROUTER_BASE_URL } from '@/lib/brain-types';

export const maxDuration = 300;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  settings: {
    provider: BrainProvider;
    model: string;
    apiKey: string;
    perplexityKey?: string;
  };
  terminalState: {
    activeSymbol: string;
    openPanels: string[];
    watchlists: string[];
    /** v2 enriched workspace state */
    workspace?: {
      panels: Array<{ id: string; type: string; label: string; instrument: string | null; linkGroup: string }>;
      watchlistSymbols: string[];
      portfolioSymbols: string[];
      activeFiling?: string | null;
      activeTranscript?: string | null;
    };
  };
}

async function executeServerTool(name: string, args: Record<string, unknown>, perplexityKey?: string): Promise<string> {
  try {
    switch (name) {
      case 'get_quote': {
        const symbols = (Array.isArray(args.symbols) ? args.symbols : [args.symbol]).map((s) => String(s).toUpperCase()).slice(0, 10);
        const out = [];
        for (const symbol of symbols) {
          try {
            const raw = curl(yfChartUrl(symbol, '5d', '1d')) as Record<string, unknown>;
            const meta = extractMeta(raw);
            out.push({
              symbol,
              price: meta.price ?? null,
              previousClose: meta.previousClose ?? null,
              change: meta.price != null && meta.previousClose != null ? Number(meta.price) - Number(meta.previousClose) : null,
              currency: meta.currency ?? null,
              exchange: meta.exchange ?? null,
              high52w: meta.high52w ?? null,
              low52w: meta.low52w ?? null,
              provenance: 'Yahoo composite (delayed)',
            });
          } catch { out.push({ symbol, error: 'unavailable' }); }
        }
        return JSON.stringify(out);
      }
      case 'get_bars': {
        const symbol = String(args.symbol).toUpperCase();
        const range = String(args.range || '3mo');
        const raw = curl(yfChartUrl(symbol, range, range === '1d' ? '5m' : '1d')) as Record<string, unknown>;
        const meta = extractMeta(raw);
        const ohlcv = extractOHLCV(raw) as Record<string, unknown>;
        const closes = (ohlcv.close as number[]) || [];
        const volumes = (ohlcv.volume as number[]) || [];
        const highs = (ohlcv.high as number[]) || [];
        const lows = (ohlcv.low as number[]) || [];
        return JSON.stringify({
          symbol, price: meta.price ?? null,
          periodHigh: highs.length ? Math.max(...highs.filter(Boolean)) : null,
          periodLow: lows.length ? Math.min(...lows.filter(Boolean)) : null,
          avgVolume: volumes.length ? Math.round(volumes.reduce((a, b) => a + (b ?? 0), 0) / volumes.length) : null,
          trend: closes.length > 1 ? (closes[closes.length - 1] > closes[0] ? 'up' : 'down') : 'flat',
          changePct: closes.length > 1 && closes[0] ? (((closes[closes.length - 1] - closes[0]) / closes[0]) * 100).toFixed(2) + '%' : null,
          dataPoints: closes.length,
        });
      }
      case 'get_options_chain': {
        const symbol = String(args.symbol).toUpperCase();
        const raw = curl(`https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`) as Record<string, unknown>;
        const result = (raw as { optionChain?: { result?: Array<Record<string, unknown>> } }).optionChain?.result?.[0];
        if (!result) throw new Error('No options data');
        const first = (result.options as Array<Record<string, unknown>>)[0] ?? {};
        const calls = (first.calls as Array<Record<string, unknown>>) ?? [];
        const puts = (first.puts as Array<Record<string, unknown>>) ?? [];
        const maxOI = (arr: Array<Record<string, unknown>>) => arr.reduce((m, c) => Math.max(m, Number(c.openInterest ?? 0)), 0);
        const maxOIStrike = (arr: Array<Record<string, unknown>>) => arr.reduce((best, c) => Number(c.openInterest ?? 0) > Number(best.openInterest ?? 0) ? c : best, arr[0] ?? {});
        return JSON.stringify({
          symbol,
          expirations: ((result.expirationDates as number[]) ?? []).slice(0, 12).map((t) => new Date(t * 1000).toISOString().slice(0, 10)),
          nearestExpiration: first.expirationDate ? new Date(Number(first.expirationDate) * 1000).toISOString().slice(0, 10) : null,
          underlyingPrice: (result.quote as Record<string, unknown>)?.regularMarketPrice ?? null,
          totalCalls: calls.length, totalPuts: puts.length,
          maxCallOI: maxOI(calls), maxPutOI: maxOI(puts),
          maxCallOIStrike: maxOIStrike(calls)?.strike ?? null,
          maxPutOIStrike: maxOIStrike(puts)?.strike ?? null,
          provenance: 'Yahoo options (delayed)',
        });
      }
      case 'get_greeks': {
        const symbol = String(args.symbol).toUpperCase();
        const strike = Number(args.strike);
        const expiration = String(args.expiration);
        const optionType = (String(args.option_type).toUpperCase() === 'PUT' ? 'PUT' : 'CALL') as 'CALL' | 'PUT';
        let spot = args.spot != null ? Number(args.spot) : null;
        let vol = args.volatility != null ? Number(args.volatility) : null;
        if (spot == null) {
          const raw = curl(yfChartUrl(symbol, '5d', '1d')) as Record<string, unknown>;
          spot = Number(extractMeta(raw).price ?? 0);
        }
        if (spot <= 0) throw new Error('No spot price');
        const T = yearsToExpiry(expiration);
        if (T <= 0) throw new Error('Expiration in the past');
        if (vol == null) {
          // Try solving IV from the nearest listed contract at this strike
          try {
            const raw = curl(`https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`) as Record<string, unknown>;
            const result = (raw as { optionChain?: { result?: Array<Record<string, unknown>> } }).optionChain?.result?.[0];
            const first = (result?.options as Array<Record<string, unknown>>)?.[0] ?? {};
            const side = optionType === 'CALL' ? (first.calls as Array<Record<string, unknown>>) : (first.puts as Array<Record<string, unknown>>);
            const contract = (side ?? []).find((c) => Math.abs(Number(c.strike) - strike) < 0.01);
            if (contract) {
              const bid = Number(contract.bid ?? 0), ask = Number(contract.ask ?? 0), last = Number(contract.lastPrice ?? 0);
              const mid = ask > bid ? (ask + bid) / 2 : last;
              if (mid > 0) {
                vol = impliedVolatility({ marketPrice: mid, spot, strike, timeToExpiry: T, riskFreeRate: 0.043, dividendYield: 0, optionType });
              }
            }
          } catch { /* fall through with vol null */ }
        }
        const sigma = vol ?? 0.35;
        const greeks = blackScholesGreeks({ spot, strike, timeToExpiry: T, volatility: sigma, riskFreeRate: 0.043, dividendYield: 0, optionType });
        return JSON.stringify({
          symbol, strike, expiration, optionType, spot,
          timeToExpiryYears: Number(T.toFixed(4)),
          volatilityUsed: sigma,
          volatilitySource: vol != null ? (args.volatility != null ? 'user-provided' : 'implied-vol-solver') : 'default-fallback-0.35',
          ...greeks,
        });
      }
      case 'get_financial_statements': {
        const symbol = String(args.symbol).toUpperCase();
        const statement = String(args.statement ?? 'INCOME_STATEMENT') as 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';
        const period = String(args.period ?? 'ANNUAL') as 'ANNUAL' | 'QUARTERLY' | 'TTM';
        const { statements } = await secEdgarStatementsProvider.getStatements(
          { id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' },
          statement, period, 5,
        );
        return JSON.stringify(statements[0] ?? { error: 'no data' });
      }
      case 'get_ratios': {
        const symbol = String(args.symbol).toUpperCase();
        const ref = { id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' as const };
        const [inc, bal] = await Promise.all([
          secEdgarStatementsProvider.getStatements(ref, 'INCOME_STATEMENT', 'ANNUAL', 2),
          secEdgarStatementsProvider.getStatements(ref, 'BALANCE_SHEET', 'ANNUAL', 1),
        ]);
        const income = inc.statements[0];
        const balance = bal.statements[0];
        if (!income) return JSON.stringify({ error: 'no XBRL facts' });
        const latest = income.periods[income.periods.length - 1];
        const pick = (s: typeof income | undefined, key: string) => s?.lines.find((l) => l.key === key)?.values[latest] ?? null;
        const div = (a: number | null, b: number | null) => a != null && b != null && b !== 0 ? a / b : null;
        return JSON.stringify({
          symbol, period: latest,
          grossMargin: div(pick(income, 'grossProfit'), pick(income, 'revenue')),
          operatingMargin: div(pick(income, 'operatingIncome'), pick(income, 'revenue')),
          netMargin: div(pick(income, 'netIncome'), pick(income, 'revenue')),
          roe: div(pick(income, 'netIncome'), pick(balance, 'equity')),
          roa: div(pick(income, 'netIncome'), pick(balance, 'totalAssets')),
          debtToEquity: div((pick(balance, 'longTermDebt') ?? 0) + (pick(balance, 'shortTermDebt') ?? 0), pick(balance, 'equity')),
          currentRatio: div(pick(balance, 'currentAssets'), pick(balance, 'currentLiabilities')),
          provenance: 'SEC EDGAR XBRL (derived)',
        });
      }
      case 'get_consensus_estimates': {
        const symbol = String(args.symbol).toUpperCase();
        const ref = { id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' as const };
        const { statements } = await secEdgarStatementsProvider.getStatements(ref, 'INCOME_STATEMENT', 'QUARTERLY', 8);
        const s = statements[0];
        if (!s) return JSON.stringify({ error: 'no XBRL facts' });
        const eps = s.lines.find((l) => l.key === 'epsDiluted')?.values ?? {};
        const rev = s.lines.find((l) => l.key === 'revenue')?.values ?? {};
        return JSON.stringify({
          symbol,
          note: 'Actuals from SEC XBRL. Forward consensus requires a licensed provider (UNAVAILABLE) — do not estimate.',
          quarters: s.periods.map((p) => ({ period: p, epsActual: eps[p] ?? null, revenueActual: rev[p] ?? null })),
        });
      }
      case 'get_filings': {
        const symbol = String(args.symbol).toUpperCase();
        const cik = await tickerToCik(symbol);
        if (!cik) return JSON.stringify({ error: `No CIK for ${symbol}` });
        const forms = Array.isArray(args.forms) ? (args.forms as string[]) : undefined;
        const filings = await getCompanyFilings(cik, forms);
        return JSON.stringify(filings.slice(0, 12).map((f) => ({
          form: f.form, filedAt: f.filingDate, reportDate: f.reportDate,
          accessionNumber: f.accessionNumber, primaryDocument: f.primaryDocument,
          url: `https://www.sec.gov/Archives/edgar/data/${f.cik}/${f.accessionNumber.replace(/-/g, '')}/${f.primaryDocument}`,
        })));
      }
      case 'get_transcripts': {
        const symbol = String(args.symbol).toUpperCase();
        if (args.transcript_id) {
          const t = await transcriptsProvider.getTranscript(String(args.transcript_id));
          return JSON.stringify({ ...t, segments: t.segments.slice(0, 40) });
        }
        const list = await transcriptsProvider.getTranscriptsList({ id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' });
        return JSON.stringify(list);
      }
      case 'get_dividends': {
        const symbol = String(args.symbol).toUpperCase();
        const raw = curl(`${yfChartUrl(symbol, '10y', '3mo')}&events=div`) as Record<string, unknown>;
        const result = (raw as { chart?: { result?: Array<{ events?: { dividends?: Record<string, { date: number; amount: number }> } }> } }).chart?.result?.[0];
        const divs = Object.values(result?.events?.dividends ?? {}).sort((a, b) => a.date - b.date);
        const ttm = divs.slice(-4).reduce((s, d) => s + d.amount, 0);
        const meta = extractMeta(raw);
        const price = meta.price != null ? Number(meta.price) : null;
        return JSON.stringify({
          symbol,
          paymentCount: divs.length,
          trailingTwelveMonths: ttm,
          currentQuarterly: divs[divs.length - 1]?.amount ?? null,
          yieldPct: price != null && price > 0 ? Number(((ttm / price) * 100).toFixed(2)) : null,
          recent: divs.slice(-8).map((d) => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), amount: d.amount })),
          provenance: 'Yahoo dividend events (real)',
        });
      }
      case 'compare_instruments': {
        const symbols = (Array.isArray(args.symbols) ? args.symbols : []).map((s) => String(s).toUpperCase()).slice(0, 4);
        const rows = [];
        for (const symbol of symbols) {
          try {
            const quoteRaw = curl(yfChartUrl(symbol, '5d', '1d')) as Record<string, unknown>;
            const meta = extractMeta(quoteRaw);
            let stmtLine: Record<string, number | null> | null = null;
            let period = null as string | null;
            try {
              const ref = { id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' as const };
              const { statements } = await secEdgarStatementsProvider.getStatements(ref, 'INCOME_STATEMENT', 'ANNUAL', 2);
              const s = statements[0];
              if (s) {
                const latestPeriod: string | undefined = s.periods[s.periods.length - 1];
                if (latestPeriod) {
                  period = latestPeriod;
                  stmtLine = Object.fromEntries(s.lines.map((l) => [l.key, l.values[latestPeriod] ?? null]));
                }
              }
            } catch { /* statements optional for non-US listings */ }
            const prev = meta.previousClose != null ? Number(meta.previousClose) : null;
            const price = meta.price != null ? Number(meta.price) : null;
            rows.push({
              symbol,
              price,
              changePct: price != null && prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : null,
              revenue: stmtLine?.revenue ?? null,
              netIncome: stmtLine?.netIncome ?? null,
              operatingMargin: stmtLine?.revenue && stmtLine?.operatingIncome != null ? Number((stmtLine.operatingIncome / (stmtLine.revenue || 1) * 100).toFixed(1)) : null,
              netMargin: stmtLine?.revenue && stmtLine?.netIncome != null ? Number((stmtLine.netIncome / (stmtLine.revenue || 1) * 100).toFixed(1)) : null,
              fiscalPeriod: period,
            });
          } catch { rows.push({ symbol, error: 'unavailable' }); }
        }
        return JSON.stringify({ symbols, focus: args.focus ?? 'all', rows, provenance: 'Yahoo quotes + SEC XBRL' });
      }
      case 'search_transcripts': {
        const symbol = String(args.symbol).toUpperCase();
        const list = await transcriptsProvider.getTranscriptsList({ id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' });
        const latest = list.transcripts[0];
        if (!latest) return JSON.stringify({ error: 'no transcripts available' });
        const t = await transcriptsProvider.getTranscript(latest.id);
        const kw = String(args.keyword).toLowerCase();
        const hits = t.segments.filter((s) => s.text.toLowerCase().includes(kw) || s.speakerName.toLowerCase().includes(kw)).slice(0, 12);
        return JSON.stringify({
          transcript: { id: latest.id, quarter: latest.quarterLabel, date: latest.callDate, title: latest.title },
          keyword: args.keyword,
          matches: hits.map((h) => ({ segmentId: h.id, speaker: h.speakerName, role: h.speakerRole, section: h.section, text: h.text.slice(0, 400) })),
        });
      }
      case 'extract_guidance': {
        const symbol = String(args.symbol).toUpperCase();
        const list = await transcriptsProvider.getTranscriptsList({ id: `EQUITY:XNAS:${symbol}`, symbol, displaySymbol: symbol, assetClass: 'EQUITY' });
        const latest = list.transcripts[0];
        if (!latest) return JSON.stringify({ error: 'no transcripts available' });
        const t = await transcriptsProvider.getTranscript(latest.id);
        const guidanceRe = /(guidance|outlook|expect|forecast|anticipate|we see|we project|targeting|full[- ]year|next quarter|fiscal year)/i;
        const guidance = t.segments
          .filter((s) => s.speakerRole === 'EXECUTIVE' && guidanceRe.test(s.text))
          .slice(0, 10)
          .map((s) => ({ segmentId: s.id, speaker: s.speakerName, quote: s.text.slice(0, 500), citation: `${latest.quarterLabel} call — ${s.speakerName} (segment ${s.id})` }));
        return JSON.stringify({ symbol, transcript: latest.quarterLabel, guidanceStatements: guidance, note: 'Extracted verbatim from the transcript — cite the segment ids.' });
      }
      case 'summarize_filing': {
        const symbol = String(args.symbol).toUpperCase();
        const form = String(args.form ?? '10-K');
        const cik = await tickerToCik(symbol);
        if (!cik) return JSON.stringify({ error: `No CIK for ${symbol}` });
        const filings = (await getCompanyFilings(cik, [form])).slice(0, 1);
        const filing = filings[0];
        if (!filing) return JSON.stringify({ error: `No ${form} on file` });
        const acc = filing.accessionNumber.replace(/-/g, '');
        const url = `https://www.sec.gov/Archives/edgar/data/${filing.cik}/${acc}/${filing.primaryDocument}`;
        return JSON.stringify({
          symbol, form, filedAt: filing.filingDate, reportDate: filing.reportDate,
          accessionNumber: filing.accessionNumber,
          url,
          note: 'Filing metadata retrieved. Full-document summarization streams via the in-terminal FLNG reader; cite accession number and item (e.g. Item 7 MD&A) in answers.',
        });
      }
      case 'research': {
        const query = String(args.query);
        if (!perplexityKey) return JSON.stringify({ error: 'No Perplexity API key' });
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
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
          if (response.status === 429) return JSON.stringify({ error: 'Perplexity rate limit exceeded' });
          return JSON.stringify({ error: `Perplexity API error: ${response.status}` });
        }
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; citations?: string[] };
        return JSON.stringify({
          answer: data.choices?.[0]?.message?.content ?? '',
          citations: (data.citations ?? []).map((url, i) => ({ title: `Source ${i + 1}`, url })),
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
  } catch (e) {
    return JSON.stringify({ error: `${name} failed: ${e instanceof Error ? e.message : String(e)}` });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ChatRequestBody;
    const { messages, settings, terminalState } = body;

    if (!settings?.apiKey) {
      return NextResponse.json({ error: 'API key not configured. Open BRAIN SETTINGS to configure.' }, { status: 400 });
    }
    if (!settings?.provider || !settings?.model) {
      return NextResponse.json({ error: 'Provider and model must be specified.' }, { status: 400 });
    }

    const hasPerplexity = !!settings.perplexityKey;
    const systemPrompt = buildSystemPrompt({
      activeSymbol: terminalState.activeSymbol || '',
      openPanels: terminalState.openPanels || [],
      watchlists: terminalState.watchlists || ['DEFAULT', 'SECTORS', 'INDEXES'],
      hasPerplexity,
      workspace: terminalState.workspace,
    });

    let model;
    if (settings.provider === 'anthropic') {
      model = createAnthropic({ apiKey: settings.apiKey })(settings.model);
    } else if (settings.provider === 'openrouter') {
      model = createOpenAI({ apiKey: settings.apiKey, baseURL: OPENROUTER_BASE_URL })(settings.model);
    } else {
      model = createOpenAI({ apiKey: settings.apiKey })(settings.model);
    }

    // Build tools: server-side tools get execute, client-side tools don't
    const allTools: Record<string, any> = {};
    for (const [name, def] of Object.entries(clientToolDefinitions)) {
      allTools[name] = { description: def.description, parameters: def.parameters };
    }
    for (const [name, def] of Object.entries(serverToolDefinitions)) {
      if (name === 'research' && !hasPerplexity) continue;
      allTools[name] = {
        description: def.description,
        parameters: def.parameters,
        execute: async (args: Record<string, unknown>) => executeServerTool(name, args, settings.perplexityKey),
      };
    }

    const result = await generateText({
      model,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: allTools,
      stopWhen: stepCountIs(10),
    });

    // Extract client-side tool calls from steps (these need to be executed on the client)
    const clientActions: Array<{ toolName: string; args: Record<string, unknown> }> = [];
    for (const step of result.steps) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          if (CLIENT_TOOL_NAMES.has(tc.toolName)) {
            clientActions.push({ toolName: tc.toolName, args: (tc as any).input as Record<string, unknown> });
          }
        }
      }
    }

    return NextResponse.json({
      text: result.text,
      actions: clientActions,
      usage: result.usage ? {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      } : null,
    });
  } catch (e: any) {
    const message = e?.message ?? String(e);
    if (message.includes('401') || message.includes('auth') || message.includes('API key') || message.includes('Incorrect API key')) {
      return NextResponse.json({ error: 'Invalid API key. Check your settings.' }, { status: 401 });
    }
    return NextResponse.json({ error: `Brain error: ${message}` }, { status: 500 });
  }
}
