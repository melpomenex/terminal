import { describe, it, expect } from 'vitest';
import {
  ProviderRegistry, ProvenanceCache, ProviderUnavailableError,
  type ProviderEntry,
} from '@/lib/providers/provider-registry';
import type { IQuoteProvider, QuoteResult } from '@/lib/providers/contracts';
import type { InstrumentRef } from '@/lib/types/instrument';
import { makeProvenance, downgradeToStale } from '@/lib/types/provenance';

const ref: InstrumentRef = { id: 'EQUITY:XNAS:TEST', symbol: 'TEST', displaySymbol: 'TEST', assetClass: 'EQUITY' };

function quoteProvider(id: string, behavior: {
  failTimes?: number; error?: Error; quality?: QuoteResult['provenance']['quality']; latencyMs?: number;
} = {}): IQuoteProvider & { calls: number } {
  let calls = 0;
  const failTimes = behavior.failTimes ?? 0;
  const p: IQuoteProvider & { calls: number } = {
    id,
    displayName: id,
    calls: 0,
    async getQuote(_instrument: InstrumentRef): Promise<QuoteResult> {
      void _instrument;
      const current = ++calls;
      p.calls = current;
      if (current <= failTimes) throw behavior.error ?? new Error('upstream down');
      if (behavior.latencyMs) await new Promise((r) => setTimeout(r, behavior.latencyMs));
      return {
        instrument: ref, lastPrice: 100, change: 1, changePercent: 1, volume: 1,
        open: 99, high: 101, low: 98, previousClose: 99,
        provenance: makeProvenance(id, behavior.quality ?? 'LIVE'),
      };
    },
    async getQuotes(instruments: InstrumentRef[]): Promise<QuoteResult[]> {
      return Promise.all(instruments.map((i) => p.getQuote(i)));
    },
  };
  return p;
}

function entry<P extends IQuoteProvider>(provider: P, priority: number, qualityTier?: ProviderEntry<P>['qualityTier']): ProviderEntry<P> {
  return { provider, priority, qualityTier };
}

describe('provider registry fallback chain', () => {
  it('uses the primary provider when healthy', async () => {
    const registry = new ProviderRegistry();
    registry.register('quotes', entry(quoteProvider('primary'), 0, 'LIVE'));
    registry.register('quotes', entry(quoteProvider('secondary'), 1, 'DELAYED'));

    const result = await registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref), {
      onProvenance: (r) => r.provenance,
    });
    expect(result.provenance.sourceProvider).toBe('primary');
    expect(result.provenance.quality).toBe('LIVE');
  });

  it('falls back to the secondary provider when the primary fails', async () => {
    const registry = new ProviderRegistry();
    registry.register('quotes', entry(quoteProvider('primary', { failTimes: 1 }), 0, 'LIVE'));
    registry.register('quotes', entry(quoteProvider('secondary'), 1, 'DELAYED'));

    const result = await registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref), {
      onProvenance: (r) => r.provenance,
    });
    expect(result.provenance.sourceProvider).toBe('secondary');
    // Tier downgrade applies: secondary tier labels data DELAYED
    expect(result.provenance.quality).toBe('DELAYED');
  });

  it('throws ProviderUnavailableError when every provider fails', async () => {
    const registry = new ProviderRegistry();
    registry.register('quotes', entry(quoteProvider('a', { failTimes: 99, error: new Error('HTTP 503') }), 0));
    registry.register('quotes', entry(quoteProvider('b', { failTimes: 99, error: new Error('HTTP 503') }), 1));

    await expect(
      registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref)),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('recovers after cooldown expires (rate-limit backoff)', async () => {
    const registry = new ProviderRegistry();
    const flaky = quoteProvider('flaky', { failTimes: 1 });
    const secondary = quoteProvider('secondary');
    registry.register('quotes', entry(flaky, 0, 'LIVE'));
    registry.register('quotes', entry(secondary, 1, 'DELAYED'));

    // First call: primary fails, chain falls to secondary; primary enters cooldown.
    const viaSecondary = await registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref), {
      onProvenance: (r) => r.provenance,
    });
    expect(viaSecondary.provenance.sourceProvider).toBe('secondary');

    const health = registry.getHealth('flaky');
    expect(health.state).toMatch(/DOWN|RATE_LIMITED/);
    expect(health.cooldownUntil).toBeGreaterThan(Date.now());

    // Cooldown gates the chain: a healthy re-registered primary (new id,
    // e.g. after process restart) reclaims the top slot immediately.
    const recovered = quoteProvider('flaky-restarted');
    registry.register('quotes', entry(recovered, 0, 'LIVE'));
    const ok = await registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref), {
      onProvenance: (r) => r.provenance,
    });
    expect(ok.provenance.sourceProvider).toBe('flaky-restarted');
    expect(registry.getHealth('flaky-restarted').state).toBe('HEALTHY');
  });

  it('rate-limit errors get their own health state', async () => {
    const registry = new ProviderRegistry();
    registry.register('quotes', entry(quoteProvider('limited', { failTimes: 1, error: new Error('HTTP 429 too many requests') }), 0));
    await expect(registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref))).rejects.toThrow();
    const health = registry.getHealth('limited');
    expect(health.state).toBe('RATE_LIMITED');
    expect(health.consecutiveFailures).toBe(1);
  });

  it('never upgrades a stricter provenance label via tier re-labeling', async () => {
    const registry = new ProviderRegistry();
    // Secondary tier is DELAYED, but the provider itself reports UNAVAILABLE
    registry.register('quotes', entry(quoteProvider('limited-entitlement', { quality: 'UNAVAILABLE' }), 1, 'DELAYED'));
    const result = await registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref), {
      onProvenance: (r) => r.provenance,
    });
    expect(result.provenance.quality).toBe('UNAVAILABLE');
  });

  it('unregister removes a provider from the chain', async () => {
    const registry = new ProviderRegistry();
    registry.register('quotes', entry(quoteProvider('only'), 0));
    registry.unregister('quotes', 'only');
    expect(registry.list('quotes')).toHaveLength(0);
    await expect(registry.dispatch('quotes', (p: IQuoteProvider) => p.getQuote(ref))).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('provenance cache (STALE fallback payloads)', () => {
  it('returns cached payload with STALE quality after provider loss', () => {
    const cache = new ProvenanceCache(60_000);
    const payload = { symbol: 'TEST', price: 100 };
    cache.set('quotes:TEST', payload, makeProvenance('primary', 'LIVE'));

    const hit = cache.get<typeof payload>('quotes:TEST');
    expect(hit).not.toBeNull();
    expect(hit!.value).toEqual(payload);
    expect(hit!.provenance.quality).toBe('STALE');
    expect(hit!.provenance.sourceProvider).toBe('primary');
  });

  it('expires entries past max age', async () => {
    const cache = new ProvenanceCache(1);
    cache.set('k', 1, makeProvenance('p', 'LIVE'));
    await new Promise((r) => setTimeout(r, 5));
    expect(cache.get('k')).toBeNull();
  });

  it('misses on unknown keys', () => {
    const cache = new ProvenanceCache();
    expect(cache.get('nope')).toBeNull();
  });
});

describe('provenance quality downgrading', () => {
  it('downgrades old retrievals to STALE, keeps fresh ones', () => {
    const fresh = makeProvenance('p', 'LIVE');
    const old = makeProvenance('p', 'LIVE');
    old.retrievalTimestamp = new Date(Date.now() - 10 * 60_000).toISOString();

    expect(downgradeToStale(fresh).quality).toBe('LIVE');
    expect(downgradeToStale(old).quality).toBe('STALE');
  });
});
