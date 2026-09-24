'use client';

import { useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { PROVIDER_MODELS, PROVIDERS_WITH_CUSTOM_MODEL, maskApiKey } from '@/lib/brain-types';
import type { BrainProvider } from '@/lib/brain-types';

export default function BrainSettingsPanel({ panelId }: { panelId: string }) {
  const { brainSettings, setBrainSettings } = useTerminalContext();
  const [localSettings, setLocalSettings] = useState({ ...brainSettings });
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);

  const handleSave = () => {
    setBrainSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleProviderChange = (provider: BrainProvider) => {
    const models = PROVIDER_MODELS[provider];
    setLocalSettings((prev) => ({ ...prev, provider, model: models[0] }));
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
        BRAIN SETTINGS
      </div>

      {/* Provider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 10, color: 'var(--amber-dim)', textTransform: 'uppercase' }}>LLM Provider</label>
        <select
          value={localSettings.provider}
          onChange={(e) => handleProviderChange(e.target.value as BrainProvider)}
          style={{ background: '#111', color: 'var(--amber)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font)', borderRadius: 2 }}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>

      {/* Model */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 10, color: 'var(--amber-dim)', textTransform: 'uppercase' }}>Model</label>
        {PROVIDERS_WITH_CUSTOM_MODEL.has(localSettings.provider) ? (
          <input
            type="text"
            value={localSettings.model}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="e.g. openai/gpt-4o"
            list="openrouter-models"
            style={{ background: '#111', color: 'var(--amber)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font)', borderRadius: 2, outline: 'none' }}
          />
        ) : (
          <select
            value={localSettings.model}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, model: e.target.value }))}
            style={{ background: '#111', color: 'var(--amber)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font)', borderRadius: 2 }}
          >
            {PROVIDER_MODELS[localSettings.provider].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        {PROVIDERS_WITH_CUSTOM_MODEL.has(localSettings.provider) && (
          <datalist id="openrouter-models">
            {PROVIDER_MODELS.openrouter.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        )}
      </div>

      {/* API Key */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 10, color: 'var(--amber-dim)', textTransform: 'uppercase' }}>API Key</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type={showApiKey ? 'text' : 'password'}
            value={localSettings.apiKey}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="sk-..."
            style={{ flex: 1, background: '#111', color: 'var(--amber)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font)', borderRadius: 2, outline: 'none' }}
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            style={{ background: 'var(--border)', color: 'var(--amber)', border: 'none', padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            {showApiKey ? 'HIDE' : 'SHOW'}
          </button>
        </div>
        {brainSettings.apiKey && !showApiKey && (
          <span style={{ fontSize: 10, color: 'var(--amber-dim)' }}>Current: {maskApiKey(brainSettings.apiKey)}</span>
        )}
      </div>

      {/* Perplexity Key */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 10, color: 'var(--amber-dim)', textTransform: 'uppercase' }}>Perplexity API Key (optional)</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type={showPerplexityKey ? 'text' : 'password'}
            value={localSettings.perplexityKey}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, perplexityKey: e.target.value }))}
            placeholder="pplx-..."
            style={{ flex: 1, background: '#111', color: 'var(--amber)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font)', borderRadius: 2, outline: 'none' }}
          />
          <button
            onClick={() => setShowPerplexityKey(!showPerplexityKey)}
            style={{ background: 'var(--border)', color: 'var(--amber)', border: 'none', padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            {showPerplexityKey ? 'HIDE' : 'SHOW'}
          </button>
        </div>
        {brainSettings.perplexityKey && !showPerplexityKey && (
          <span style={{ fontSize: 10, color: 'var(--amber-dim)' }}>Current: {maskApiKey(brainSettings.perplexityKey)}</span>
        )}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        style={{
          background: saved ? '#003300' : 'var(--border)',
          color: saved ? '#00ff66' : 'var(--amber)',
          border: `1px solid ${saved ? '#00ff66' : 'var(--amber-dim)'}`,
          padding: '8px 16px', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'var(--font)', borderRadius: 2,
          transition: 'all 0.2s',
        }}
      >
        {saved ? 'SAVED' : 'SAVE SETTINGS'}
      </button>
    </div>
  );
}
