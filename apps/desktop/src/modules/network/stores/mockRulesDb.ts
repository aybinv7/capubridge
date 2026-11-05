import type { MockTargetConfig } from "@/types/mock.types";

/** Where mock rules are kept between runs. */
export interface MockRulesPersistence {
  /** Every saved scope, or null when nothing was ever saved here (so a migration can run). */
  load(): Promise<Record<string, MockTargetConfig> | null>;
  /** Writes changed scopes in one transaction; null deletes a scope. Rejects on quota errors. */
  save(changes: ReadonlyMap<string, MockTargetConfig | null>): Promise<void>;
}

const DB_NAME = "capubridge-mock-rules";
const DB_VERSION = 1;
const SCOPES = "scopes";
const META = "meta";
const INITIALIZED = "initialized";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction was aborted"));
  });
}

function open(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(SCOPES)) db.createObjectStore(SCOPES);
    if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
  };
  return request(req);
}

/** Mock rules in this window's IndexedDB: one record per scope, so a save writes only what changed. */
export function indexedDbMockPersistence(): MockRulesPersistence {
  let connection: Promise<IDBDatabase> | null = null;

  function db(): Promise<IDBDatabase> {
    connection ??= open().catch((error: unknown) => {
      connection = null;
      throw error;
    });
    return connection;
  }

  return {
    async load() {
      const database = await db();
      const tx = database.transaction([SCOPES, META], "readonly");
      const [initialized, keys, values] = await Promise.all([
        request(tx.objectStore(META).get(INITIALIZED)),
        request(tx.objectStore(SCOPES).getAllKeys()),
        request(tx.objectStore(SCOPES).getAll()),
      ]);
      if (initialized !== true) return null;
      const configs: Record<string, MockTargetConfig> = {};
      keys.forEach((key, index) => {
        const value = values[index] as MockTargetConfig | undefined;
        if (typeof key === "string" && value) configs[key] = value;
      });
      return configs;
    },
    async save(changes) {
      const database = await db();
      const tx = database.transaction([SCOPES, META], "readwrite");
      const scopes = tx.objectStore(SCOPES);
      for (const [scope, config] of changes) {
        if (config) scopes.put(config, scope);
        else scopes.delete(scope);
      }
      tx.objectStore(META).put(true, INITIALIZED);
      await done(tx);
    },
  };
}

/** Rules kept in memory only, for tests. */
export function memoryMockPersistence(
  initial: Record<string, MockTargetConfig> | null = null,
): MockRulesPersistence & { saved: Record<string, MockTargetConfig> | null; fail?: Error } {
  const state: MockRulesPersistence & {
    saved: Record<string, MockTargetConfig> | null;
    fail?: Error;
  } = {
    saved: initial ? structuredClone(initial) : null,
    load: () => Promise.resolve(state.saved ? structuredClone(state.saved) : null),
    save: (changes) => {
      if (state.fail) return Promise.reject(state.fail);
      const next = { ...state.saved };
      for (const [scope, config] of changes) {
        if (config) next[scope] = structuredClone(config);
        else delete next[scope];
      }
      state.saved = next;
      return Promise.resolve();
    },
  };
  return state;
}
