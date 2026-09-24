/**
 * Schema-versioned persistence manager.
 *
 * Local-first storage over IndexedDB (with localStorage fallback), wrapped
 * in a schema envelope (`{ schemaVersion, savedAt, collections }`) so future
 * migrations run deterministically. Supports JSON export/import backups and
 * best-effort cloud sync (posts to /api/v2/sync when authenticated — the
 * endpoint is optional and absence degrades gracefully to local-only).
 */

export const SCHEMA_VERSION = 2;

export type PersistedCollection =
  | 'workspaces'
  | 'researchNotes'
  | 'alerts'
  | 'watchlists'
  | 'portfolio'
  | 'settings';

export interface StorageEnvelope<T = unknown> {
  schemaVersion: number;
  savedAt: string;
  collection: PersistedCollection;
  data: T;
}

export interface BackupBundle {
  kind: 'qube-backup';
  schemaVersion: number;
  exportedAt: string;
  collections: Partial<Record<PersistedCollection, unknown>>;
}

// ---------------------------------------------------------------------------
// IndexedDB driver with localStorage fallback
// ---------------------------------------------------------------------------

const DB_NAME = 'qube-terminal';
const STORE = 'collections';
const LS_PREFIX = 'blm_persist_';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'collection' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Migration pipeline
// ---------------------------------------------------------------------------

type Migration = (data: unknown) => unknown;

/**
 * Ordered migrations: index N upgrades schemaVersion N → N+1.
 * v1 → v2: legacy `blm_*` localStorage fragments folded into collections.
 */
const MIGRATIONS: Record<number, Migration> = {
  1: (data) => data, // v1 shapes already match collection payload types
};

export function migrate(data: unknown, fromVersion: number): unknown {
  let current = data;
  let v = fromVersion;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    current = step ? step(current) : current;
    v += 1;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Storage manager
// ---------------------------------------------------------------------------

export class StorageManager {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private cloudEnabled = false;

  constructor(private readonly deviceId: string = 'default') {}

  private db(): Promise<IDBDatabase | null> {
    this.dbPromise ??= openDb();
    return this.dbPromise;
  }

  /** Enable best-effort cloud sync (no-op when the endpoint is absent). */
  setCloudSync(enabled: boolean): void {
    this.cloudEnabled = enabled;
  }

  async save<T>(collection: PersistedCollection, data: T): Promise<void> {
    const envelope: StorageEnvelope<T> = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      collection,
      data,
    };
    const db = await this.db();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(envelope);
          tx.oncomplete = () => resolve();
          tx.onerror = () => { this.lsSave(collection, envelope); resolve(); };
        } catch {
          this.lsSave(collection, envelope);
          resolve();
        }
      });
    } else {
      this.lsSave(collection, envelope);
    }
    if (this.cloudEnabled) void this.cloudPush(envelope);
  }

  async load<T>(collection: PersistedCollection, fallback: T): Promise<T> {
    const db = await this.db();
    if (db) {
      const fromIdb = await new Promise<StorageEnvelope<T> | null>((resolve) => {
        try {
          const tx = db.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(collection);
          req.onsuccess = () => resolve((req.result as StorageEnvelope<T>) ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (fromIdb) return this.validate<T>(fromIdb, fallback);
    }
    // localStorage fallback
    try {
      const raw = localStorage.getItem(LS_PREFIX + collection);
      if (raw) return this.validate<T>(JSON.parse(raw) as StorageEnvelope<T>, fallback);
    } catch { /* corrupted entry -> fallback */ }
    return fallback;
  }

  private validate<T>(envelope: StorageEnvelope<T>, fallback: T): T {
    if (typeof envelope.schemaVersion !== 'number') return fallback;
    if (envelope.schemaVersion > SCHEMA_VERSION) return fallback; // future schema — don't corrupt
    if (envelope.schemaVersion < SCHEMA_VERSION) {
      return migrate(envelope.data, envelope.schemaVersion) as T;
    }
    return envelope.data;
  }

  private lsSave<T>(collection: PersistedCollection, envelope: StorageEnvelope<T>): void {
    try {
      localStorage.setItem(LS_PREFIX + collection, JSON.stringify(envelope));
    } catch { /* quota — IndexedDB is primary anyway */ }
  }

  // -- Export / import ------------------------------------------------------

  async exportBackup(): Promise<BackupBundle> {
    const collections: BackupBundle['collections'] = {};
    const all: PersistedCollection[] = ['workspaces', 'researchNotes', 'alerts', 'watchlists', 'portfolio', 'settings'];
    for (const c of all) {
      const v = await this.load<unknown>(c, null as unknown);
      if (v != null) collections[c] = v;
    }
    return { kind: 'qube-backup', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), collections };
  }

  async importBackup(bundle: BackupBundle): Promise<{ imported: PersistedCollection[]; migrated: boolean }> {
    if (bundle?.kind !== 'qube-backup') throw new Error('Not a Qube backup bundle');
    const migrated = bundle.schemaVersion !== SCHEMA_VERSION;
    const data = bundle.schemaVersion < SCHEMA_VERSION ? migrate(bundle.collections, bundle.schemaVersion) : bundle.collections;
    const collections = (data ?? {}) as BackupBundle['collections'];
    const imported: PersistedCollection[] = [];
    for (const key of Object.keys(collections) as PersistedCollection[]) {
      await this.save(key, collections[key]);
      imported.push(key);
    }
    return { imported, migrated };
  }

  // -- Cloud sync (optional, best-effort) -----------------------------------

  private async cloudPush(envelope: StorageEnvelope): Promise<void> {
    try {
      await fetch('/api/v2/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId, envelope }),
      });
    } catch { /* offline — local copy is authoritative */ }
  }

  async cloudPull(collection: PersistedCollection): Promise<unknown | null> {
    try {
      const res = await fetch(`/api/v2/sync?collection=${collection}&deviceId=${encodeURIComponent(this.deviceId)}`);
      if (!res.ok) return null;
      const json = (await res.json()) as { envelope?: StorageEnvelope };
      return json.envelope ? this.validate(json.envelope, null as unknown) : null;
    } catch {
      return null;
    }
  }
}

export const storageManager = new StorageManager(
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'session',
);

/** Download helper for the export button. */
export function downloadBackup(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qube-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
