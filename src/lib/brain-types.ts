export type BrainProvider = 'openai' | 'anthropic' | 'openrouter';

export interface BrainSettings {
  provider: BrainProvider;
  model: string;
  apiKey: string;
  perplexityKey: string;
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const PROVIDER_MODELS: Record<BrainProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'],
  anthropic: ['claude-sonnet-4-6-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-7'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-6-20250514', 'anthropic/claude-opus-4-7', 'google/gemini-2.5-pro-preview', 'meta-llama/llama-4-maverick', 'deepseek/deepseek-r1'],
};

export const PROVIDERS_WITH_CUSTOM_MODEL: Set<BrainProvider> = new Set(['openrouter']);

export const DEFAULT_BRAIN_SETTINGS: BrainSettings = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: '',
  perplexityKey: '',
};

export function loadBrainSettings(): BrainSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_BRAIN_SETTINGS };
  try {
    const raw = localStorage.getItem('blm_brain_settings');
    if (!raw) return { ...DEFAULT_BRAIN_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_BRAIN_SETTINGS };
    return {
      provider: parsed.provider === 'openai' || parsed.provider === 'anthropic' || parsed.provider === 'openrouter' ? parsed.provider : DEFAULT_BRAIN_SETTINGS.provider,
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_BRAIN_SETTINGS.model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      perplexityKey: typeof parsed.perplexityKey === 'string' ? parsed.perplexityKey : '',
    };
  } catch {
    try { localStorage.removeItem('blm_brain_settings'); } catch {}
    return { ...DEFAULT_BRAIN_SETTINGS };
  }
}

export function saveBrainSettings(settings: BrainSettings): void {
  try { localStorage.setItem('blm_brain_settings', JSON.stringify(settings)); } catch {}
}

export interface BrainMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: BrainToolCall[];
  dataCard?: BrainDataCard | null;
}

export interface BrainToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'done' | 'error';
  result?: string;
}

export type BrainDataCard =
  | { type: 'fundamentals'; data: Record<string, unknown> }
  | { type: 'news'; data: Array<{ title: string; link: string; pubDate: string; source: string }> }
  | { type: 'research'; data: { answer: string; citations: Array<{ title: string; url: string }> } }
  | { type: 'earnings'; data: Array<Record<string, unknown>> }
  | { type: 'options'; data: Record<string, unknown> }
  | { type: 'insider'; data: Array<Record<string, unknown>> };

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + '****';
}
