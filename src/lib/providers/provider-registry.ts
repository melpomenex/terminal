/**
 * Provider registry & fallback dispatcher.
 *
 * Providers register per capability slot with a priority rank. Dispatch walks
 * the ranked chain, skipping providers in a cooldown (rate-limit / error
 * backoff), and degrades quality labels accordingly:
 *
 *   primary healthy + entitled          -> quality stays as provider reported
 *   primary downgraded / fallback used  -> quality may become 'DELAYED'
 *   all upstream providers fail         -> cached payload with 'STALE'
 *   nothing available                   -> structured 'UNAVAILABLE' result
 *
 * The registry is transport agnostic: concrete providers (YQL-backed, SEC
 * EDGAR, Gödel, future Polygon/Finnhub adapters) implement the contracts and
 * register themselves here.
 */

import type { DataProvenance } from '@/lib/types/provenance';
import type {
  AnyProvider,
  ProviderCapability,
} from '@/lib/providers/contracts';

export interface ProviderHealth {
  providerId: string;
  state: 'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'DOWN';
  /** Epoch ms when cooldown ends; 0 = no cooldown. */
  cooldownUntil: number;
  consecutiveFailures: number;
  lastError?: string;
  lastSuccessAt?: number;
}

export interface ProviderEntry<P extends AnyProvider = AnyProvider> {
  provider: P;
  /** Lower runs first. */
  priority: number;
  /** Label applied when this tier is used, e.g. 'DELAYED' for public fallbacks. */
  qualityTier?: DataProvenance['quality'];
}

export class ProviderUnavailableError extends Error {
  readonly provenance: DataProvenance;
  constructor(message: string, provenance: DataProvenance) {
    super(message);
    this.name = 'ProviderUnavailableError';
    this.provenance = provenance;
  }
}

const RATE_LIMIT_SIGNALS = [/rate.?limit/i, /429/, /too many requests/i];
const COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 60_000;

export class ProviderRegistry {
  private slots = new Map<ProviderCapability, ProviderEntry[]>();
  private health = new Map<string, ProviderHealth>();

  register<P extends AnyProvider>(capability: ProviderCapability, entry: ProviderEntry<P>): void {
    const list = this.slots.get(capability) ?? [];
    // Replace same-id provider, then keep chain sorted by priority.
    const next = list.filter((e) => e.provider.id !== entry.provider.id);
    next.push(entry as ProviderEntry);
    next.sort((a, b) => a.priority - b.priority);
    this.slots.set(capability, next);
  }

  unregister(capability: ProviderCapability, providerId: string): void {
    const list = this.slots.get(capability);
    if (list) this.slots.set(capability, list.filter((e) => e.provider.id !== providerId));
  }

  list(capability: ProviderCapability): ProviderEntry[] {
    return [...(this.slots.get(capability) ?? [])];
  }

  getHealth(providerId: string): ProviderHealth {
    return (
      this.health.get(providerId) ?? {
        providerId,
        state: 'HEALTHY',
        cooldownUntil: 0,
        consecutiveFailures: 0,
      }
    );
  }

  healthSnapshot(): ProviderHealth[] {
    return [...this.health.values()];
  }

  private markFailure(providerId: string, error: unknown): void {
    const prev = this.getHealth(providerId);
    const message = error instanceof Error ? error.message : String(error);
    const rateLimited = RATE_LIMIT_SIGNALS.some((re) => re.test(message));
    const cooldown = rateLimited ? RATE_LIMIT_COOLDOWN_MS : COOLDOWN_MS * Math.min(prev.consecutiveFailures + 1, 4);
    this.health.set(providerId, {
      providerId,
      state: rateLimited ? 'RATE_LIMITED' : 'DOWN',
      cooldownUntil: Date.now() + cooldown,
      consecutiveFailures: prev.consecutiveFailures + 1,
      lastError: message,
    });
  }

  private markSuccess(providerId: string): void {
    this.health.set(providerId, {
      providerId,
      state: 'HEALTHY',
      cooldownUntil: 0,
      consecutiveFailures: 0,
      lastSuccessAt: Date.now(),
    });
  }

  private availableChain(capability: ProviderCapability): ProviderEntry[] {
    const now = Date.now();
    return this.list(capability).filter((entry) => {
      const h = this.getHealth(entry.provider.id);
      return h.cooldownUntil <= now;
    });
  }

  /**
   * Dispatch a call across the fallback chain for a capability. The `invoke`
   * callback receives a typed provider; results are re-labeled with the
   * tier's quality when the provider did not report a stricter one.
   */
  async dispatch<P extends AnyProvider, R>(
    capability: ProviderCapability,
    invoke: (provider: P) => Promise<R>,
    opts?: { onProvenance?: (result: R) => DataProvenance | undefined },
  ): Promise<R> {
    const chain = this.availableChain(capability);
    const failures: string[] = [];
    for (const entry of chain) {
      try {
        const result = await invoke(entry.provider as P);
        this.markSuccess(entry.provider.id);
        if (opts?.onProvenance && entry.qualityTier) {
          const prov = opts.onProvenance(result);
          // Only downgrade: never overwrite a stricter label (e.g. UNAVAILABLE) with DERIVED.
          if (prov && severity(entry.qualityTier) > severity(prov.quality)) {
            prov.quality = entry.qualityTier;
          }
        }
        return result;
      } catch (error) {
        this.markFailure(entry.provider.id, error);
        failures.push(`${entry.provider.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new ProviderUnavailableError(
      `All ${capability} providers failed — ${failures.join(' | ')}`,
      {
        sourceProvider: 'none',
        retrievalTimestamp: new Date().toISOString(),
        quality: 'UNAVAILABLE',
        currency: 'USD',
      },
    );
  }
}

function severity(q: DataProvenance['quality']): number {
  // LIVE(0) best … UNAVAILABLE(5) worst
  return { LIVE: 0, DELAYED: 1, DERIVED: 1, STALE: 2, SIMULATED: 2, UNAVAILABLE: 3 }[q];
}

// ---------------------------------------------------------------------------
// Shared cache used for STALE fallback payloads
// ---------------------------------------------------------------------------

interface CacheEntry<T> { value: T; provenance: DataProvenance; storedAt: number }

export class ProvenanceCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxAgeMs: number;

  constructor(maxAgeMs = 15 * 60_000) {
    this.maxAgeMs = maxAgeMs;
  }

  set<T>(key: string, value: T, provenance: DataProvenance): void {
    this.store.set(key, { value, provenance, storedAt: Date.now() });
  }

  get<T>(key: string): { value: T; provenance: DataProvenance } | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() - hit.storedAt > this.maxAgeMs) {
      this.store.delete(key);
      return null;
    }
    return { value: hit.value as T, provenance: { ...hit.provenance, quality: 'STALE' } };
  }
}

/** Process-wide singleton (client & server safe). */
export const providerRegistry = new ProviderRegistry();
export const providerCache = new ProvenanceCache();
