import type { IDBDomain } from "@capubridge/cdp-protocol";
import type {
  IndexedDBChangeEntry,
  IndexedDBStoreCatalogEntry,
  IndexedDBStoreSnapshot,
} from "@/types/storageChanges.types";
import type { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import {
  captureStoreSnapshot,
  diffStoreSnapshots,
  fetchOriginCatalog,
} from "./indexeddbChanges.service";

/** Stores watched at once; more would keep the phone busy re-reading on every change. */
export const IDB_CHANGE_MAX_WATCHED_STORES = 40;

type ChangesStore = Pick<
  ReturnType<typeof useIndexedDBChangesStore>,
  | "catalogEntries"
  | "snapshots"
  | "setCatalog"
  | "removeSnapshots"
  | "addSystemChange"
  | "getSnapshot"
  | "upsertSnapshot"
  | "drainPendingStoreKeys"
  | "getCatalogEntry"
  | "addChanges"
  | "markEventObserved"
>;

export interface ChangeTrackerOptions {
  domain: IDBDomain;
  origin: string;
  store: ChangesStore;
  isOwnWrite: (storeKey: string, key: IDBValidKey) => boolean;
}

export interface ChangeTracker {
  readonly stopped: boolean;
  prime(): Promise<void>;
  flush(): Promise<void>;
  /** Starts watching a store left out by the store cap (the person asked for it). */
  watchStore(storeKey: string): Promise<void>;
  stop(): void;
}

function parseStoreKey(storeKey: string) {
  const [origin, databaseName, objectStoreName] = storeKey.split("::");
  return {
    origin: origin ?? "",
    databaseName: databaseName ?? "",
    objectStoreName: objectStoreName ?? "",
  };
}

function unwatched(descriptor: IndexedDBStoreCatalogEntry): IndexedDBStoreSnapshot {
  return {
    storeKey: descriptor.storeKey,
    origin: descriptor.origin,
    databaseName: descriptor.databaseName,
    objectStoreName: descriptor.objectStoreName,
    tracked: false,
    truncated: false,
    reason: `Not watched: only the first ${IDB_CHANGE_MAX_WATCHED_STORES} stores are watched for changes`,
    recordCount: descriptor.recordCount,
    lastSyncedAt: new Date().toISOString(),
    records: {},
  };
}

/**
 * The change watcher for one origin: primes a snapshot of each watched store, then re-reads a
 * store when the device says it changed and records the difference. One flush runs at a time;
 * a request during a flush runs once more after it. Changes Capubridge made are tagged as such.
 */
export function createChangeTracker(options: ChangeTrackerOptions): ChangeTracker {
  const { domain, origin, store } = options;
  let stopped = false;
  let flushing: Promise<void> | null = null;
  let flushAgain = false;
  const unwatchedKeys = new Set<string>();

  async function prime() {
    const previousEntries = store.catalogEntries;
    const previousSnapshots = store.snapshots;
    const catalog = await fetchOriginCatalog(domain, origin);
    if (stopped) return;

    const nextKeys = new Set(catalog.map((entry) => entry.storeKey));
    const removed = previousEntries
      .map((entry) => entry.storeKey)
      .filter((key) => !nextKeys.has(key));
    store.setCatalog(catalog);
    if (removed.length > 0) {
      store.removeSnapshots(removed);
      for (const storeKey of removed) {
        const gone = parseStoreKey(storeKey);
        store.addSystemChange({
          observedAt: new Date().toISOString(),
          ...gone,
          message: `Stopped watching ${gone.databaseName}.${gone.objectStoreName}: it is no longer on the device`,
        });
      }
    }

    for (const [index, descriptor] of catalog.entries()) {
      if (previousSnapshots[descriptor.storeKey] ?? store.getSnapshot(descriptor.storeKey))
        continue;
      if (index >= IDB_CHANGE_MAX_WATCHED_STORES) {
        unwatchedKeys.add(descriptor.storeKey);
        store.upsertSnapshot(unwatched(descriptor));
        continue;
      }
      const snapshot = await captureStoreSnapshot(domain, descriptor);
      if (stopped) return;
      store.upsertSnapshot(snapshot);
      if (!snapshot.tracked && snapshot.reason) {
        store.addSystemChange({
          observedAt: snapshot.lastSyncedAt,
          origin: snapshot.origin,
          databaseName: snapshot.databaseName,
          objectStoreName: snapshot.objectStoreName,
          message: snapshot.reason,
        });
      }
    }
  }

  function tagSources(entries: IndexedDBChangeEntry[]): IndexedDBChangeEntry[] {
    return entries.map((entry) => {
      if (entry.kind !== "record") return entry;
      const storeKey = `${entry.origin}::${entry.databaseName}::${entry.objectStoreName}`;
      return options.isOwnWrite(storeKey, entry.key) ? { ...entry, source: "capubridge" } : entry;
    });
  }

  async function flushOnce() {
    const dirty = store.drainPendingStoreKeys();
    if (dirty.length === 0) return;
    const observedAt = new Date().toISOString();
    let external = false;

    for (const storeKey of dirty) {
      if (stopped) return;
      let descriptor = store.getCatalogEntry(storeKey);
      if (!descriptor) {
        await prime();
        if (stopped) return;
        descriptor = store.getCatalogEntry(storeKey);
      }
      if (!descriptor) continue;
      if (unwatchedKeys.has(storeKey)) continue;
      const previous = store.getSnapshot(storeKey);
      const next = await captureStoreSnapshot(domain, descriptor);
      if (stopped) return;
      store.upsertSnapshot(next);
      if (!previous || !previous.tracked || !next.tracked) {
        if (previous?.tracked && !next.tracked && next.reason) {
          store.addSystemChange({
            observedAt,
            origin: next.origin,
            databaseName: next.databaseName,
            objectStoreName: next.objectStoreName,
            message: next.reason,
          });
        }
        continue;
      }
      const entries = tagSources(diffStoreSnapshots(previous, next, observedAt));
      if (entries.length === 0) continue;
      store.addChanges(entries);
      if (entries.some((entry) => entry.source === "external")) external = true;
    }

    if (external) store.markEventObserved(observedAt);
  }

  function flush(): Promise<void> {
    if (flushing) {
      flushAgain = true;
      return flushing;
    }
    flushing = (async () => {
      try {
        do {
          flushAgain = false;
          await flushOnce();
        } while (flushAgain && !stopped);
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  async function watchStore(storeKey: string) {
    const descriptor = store.getCatalogEntry(storeKey);
    if (!descriptor || stopped) return;
    unwatchedKeys.delete(storeKey);
    const snapshot = await captureStoreSnapshot(domain, descriptor);
    if (!stopped) store.upsertSnapshot(snapshot);
  }

  return {
    get stopped() {
      return stopped;
    },
    prime,
    flush,
    watchStore,
    stop() {
      stopped = true;
    },
  };
}
