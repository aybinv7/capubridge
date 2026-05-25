import { invoke } from "@tauri-apps/api/core";
import { IDBDomain } from "utils";
import type { CDPClient, IDBDatabaseInfo, IDBRecord, StoreInfo } from "utils";

type SnapshotReason = "initial" | "change" | "final";

interface IndexedDBContentUpdatedEvent {
  origin?: string;
  databaseName?: string;
  objectStoreName?: string;
}

interface IndexedDBListUpdatedEvent {
  origin?: string;
}

interface RecordingDatabaseSourceInput {
  id: string;
  kind: "indexedDB";
  origin: string;
  databaseName: string;
  storeName: string;
  label: string;
  recordCount: number;
  metadataJson: string;
}

interface RecordingDatabaseSnapshotRowInput {
  keyJson: string;
  valueJson: string;
}

interface CdpRemoteObject {
  value?: unknown;
  description?: string;
}

interface CdpDataEntry {
  key: CdpRemoteObject;
  primaryKey: CdpRemoteObject;
  value: CdpRemoteObject;
}

const pageSize = 500;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isTypedArray(value: unknown): value is ArrayBufferView {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: "Date", value: value.toISOString() };
  }

  if (value instanceof ArrayBuffer) {
    return { __type: "ArrayBuffer", byteLength: value.byteLength };
  }

  if (isTypedArray(value)) {
    return {
      __type: value.constructor.name,
      values: Array.from(value as unknown as ArrayLike<number>),
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value instanceof Map) {
    return {
      __type: "Map",
      entries: Array.from(value.entries())
        .map(([key, entryValue]) => [normalizeValue(key), normalizeValue(entryValue)])
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    };
  }

  if (value instanceof Set) {
    return {
      __type: "Set",
      values: Array.from(value.values()).map((entry) => normalizeValue(entry)),
    };
  }

  if (isPlainObject(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeValue(value[key]);
    }
    return normalized;
  }

  if (typeof value === "bigint") {
    return { __type: "BigInt", value: value.toString() };
  }

  return value;
}

function safeJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(normalizeValue(value));
    return serialized === undefined ? "null" : serialized;
  } catch {
    return JSON.stringify(String(value));
  }
}

function extractRemoteValue(obj: CdpRemoteObject): unknown {
  if (obj.value !== undefined) return obj.value;
  if (obj.description !== undefined) return obj.description;
  return null;
}

function sourceId(origin: string, databaseName: string, storeName: string) {
  return `indexedDB:${origin}:${databaseName}:${storeName}`;
}

function sourceKey(origin: string, databaseName: string, storeName: string) {
  return `${origin}::${databaseName}::${storeName}`;
}

function fallbackStoreInfo(name: string): StoreInfo {
  return {
    name,
    keyPath: null,
    autoIncrement: false,
    recordCount: 0,
    indexCount: 0,
    indexes: [],
    estimatedSize: 0,
  };
}

export function useIndexedDBRecorder(client: CDPClient, sessionId: string, startedAt: number) {
  const domain = new IDBDomain(client);
  const disposers: Array<() => void> = [];
  const trackedOrigins = new Set<string>();
  const storeInfoCache = new Map<string, StoreInfo>();
  const databaseVersionCache = new Map<string, number>();
  const timers = new Map<string, number>();
  const sourceRuns = new Map<string, Promise<void>>();
  let active = false;

  function elapsed(reason: SnapshotReason) {
    if (reason === "initial") return 0;
    return Math.max(0, Date.now() - startedAt);
  }

  async function currentOrigin(): Promise<string | null> {
    try {
      const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
        expression: "location.origin",
        returnByValue: true,
      });
      return typeof result.result.value === "string" ? result.result.value : null;
    } catch {
      return null;
    }
  }

  async function trackOrigin(origin: string) {
    if (!origin || trackedOrigins.has(origin)) return;
    await client.send("Storage.trackIndexedDBForOrigin", { origin });
    trackedOrigins.add(origin);
  }

  async function untrackOrigins() {
    await Promise.allSettled(
      Array.from(trackedOrigins).map((origin) =>
        client.send("Storage.untrackIndexedDBForOrigin", { origin }),
      ),
    );
    trackedOrigins.clear();
  }

  async function getStoreInfos(database: IDBDatabaseInfo): Promise<StoreInfo[]> {
    try {
      const stores = await domain.getStoreInfo(database.name, database.origin);
      databaseVersionCache.set(`${database.origin}::${database.name}`, database.version);
      for (const store of stores) {
        storeInfoCache.set(sourceKey(database.origin, database.name, store.name), store);
      }
      return stores;
    } catch {
      return database.objectStoreNames.map(fallbackStoreInfo);
    }
  }

  function makeSource(
    origin: string,
    databaseName: string,
    store: StoreInfo,
  ): RecordingDatabaseSourceInput {
    const version = databaseVersionCache.get(`${origin}::${databaseName}`) ?? null;
    return {
      id: sourceId(origin, databaseName, store.name),
      kind: "indexedDB",
      origin,
      databaseName,
      storeName: store.name,
      label: `${databaseName}.${store.name}`,
      recordCount: store.recordCount,
      metadataJson: safeJson({
        version,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: store.indexes,
        estimatedSize: store.estimatedSize,
      }),
    };
  }

  async function requestPage(
    origin: string,
    databaseName: string,
    storeName: string,
    skipCount: number,
  ): Promise<{ records: IDBRecord[]; hasMore: boolean }> {
    try {
      const response = await client.send<{
        objectStoreDataEntries: CdpDataEntry[];
        hasMore: boolean;
      }>("IndexedDB.requestData", {
        securityOrigin: origin,
        databaseName,
        objectStoreName: storeName,
        indexName: "",
        skipCount,
        pageSize,
      });

      return {
        records: response.objectStoreDataEntries.map((entry) => ({
          key: extractRemoteValue(entry.key) as IDBValidKey,
          value: extractRemoteValue(entry.value),
        })),
        hasMore: response.hasMore,
      };
    } catch {
      return requestPageViaEval(databaseName, storeName, skipCount);
    }
  }

  async function requestPageViaEval(
    databaseName: string,
    storeName: string,
    skipCount: number,
  ): Promise<{ records: IDBRecord[]; hasMore: boolean }> {
    const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            function safeSerialize(value) {
              if (value === undefined) return null;
              if (value === null) return null;
              if (value instanceof Date) return { __type: "Date", value: value.toISOString() };
              if (value instanceof Blob) return { __type: "Blob", size: value.size, type: value.type };
              if (typeof value === "bigint") return { __type: "BigInt", value: value.toString() };
              if (value instanceof ArrayBuffer) return { __type: "ArrayBuffer", byteLength: value.byteLength };
              if (ArrayBuffer.isView(value)) return { __type: value.constructor.name, values: Array.from(value) };
              if (value instanceof Set) return { __type: "Set", values: Array.from(value.values()).map(safeSerialize) };
              if (value instanceof Map) return { __type: "Map", entries: Array.from(value.entries()).map(([key, entry]) => [safeSerialize(key), safeSerialize(entry)]) };
              if (Array.isArray(value)) return value.map(safeSerialize);
              if (Object.prototype.toString.call(value) === "[object Object]") {
                const out = {};
                for (const key of Object.keys(value).sort()) out[key] = safeSerialize(value[key]);
                return out;
              }
              return value;
            }

            const openReq = indexedDB.open(${JSON.stringify(databaseName)});
            const db = await new Promise((resolve, reject) => {
              openReq.onsuccess = () => resolve(openReq.result);
              openReq.onerror = () => reject(openReq.error?.message ?? "open failed");
            });
            const store = db.transaction(${JSON.stringify(storeName)}, "readonly").objectStore(${JSON.stringify(storeName)});
            const records = [];
            let skipped = 0;
            let hasMore = false;
            const cursorReq = store.openCursor();
            await new Promise((resolve, reject) => {
              cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (!cursor) return resolve(true);
                if (skipped < ${skipCount}) {
                  skipped++;
                  cursor.continue();
                  return;
                }
                if (records.length >= ${pageSize}) {
                  hasMore = true;
                  return resolve(true);
                }
                records.push({ key: safeSerialize(cursor.primaryKey), value: safeSerialize(cursor.value) });
                cursor.continue();
              };
              cursorReq.onerror = () => reject(cursorReq.error?.message ?? "cursor failed");
            });
            db.close();
            return JSON.stringify({ records, hasMore });
          } catch (error) {
            return JSON.stringify({ error: String(error?.message ?? error) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    const value = typeof result.result.value === "string" ? result.result.value : "{}";
    const parsed = JSON.parse(value) as {
      records?: IDBRecord[];
      hasMore?: boolean;
      error?: string;
    };
    if (parsed.error) throw new Error(parsed.error);
    return { records: parsed.records ?? [], hasMore: parsed.hasMore ?? false };
  }

  async function writeSnapshot(
    source: RecordingDatabaseSourceInput,
    reason: SnapshotReason,
  ): Promise<void> {
    const tMs = elapsed(reason);
    const snapshotId = `${sessionId}:${source.id}:${reason}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    await invoke<void>("recording_database_snapshot_begin", {
      sessionId,
      source,
      snapshotId,
      tMs,
    });

    let skipCount = 0;
    for (;;) {
      const page = await requestPage(
        source.origin,
        source.databaseName,
        source.storeName,
        skipCount,
      );
      const records: RecordingDatabaseSnapshotRowInput[] = page.records.map((record) => ({
        keyJson: safeJson(record.key),
        valueJson: safeJson(record.value),
      }));

      await invoke<void>("recording_database_snapshot_page", {
        sessionId,
        snapshotId,
        sourceId: source.id,
        records,
      });

      skipCount += page.records.length;

      if (!page.hasMore || page.records.length === 0) break;
    }

    await invoke<void>("recording_database_snapshot_finish", {
      sessionId,
      snapshotId,
      sourceId: source.id,
      tMs,
      reason,
    });
  }

  function runForSource(source: RecordingDatabaseSourceInput, reason: SnapshotReason) {
    const key = source.id;
    const previous = sourceRuns.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        if (!active && reason !== "final") return;
        await writeSnapshot(source, reason);
      })
      .catch((err) => {
        console.warn("[indexeddb-recorder] snapshot failed", source.label, err);
      })
      .finally(() => {
        if (sourceRuns.get(key) === next) sourceRuns.delete(key);
      });

    sourceRuns.set(key, next);
    return next;
  }

  async function captureStore(
    origin: string,
    databaseName: string,
    storeName: string,
    reason: SnapshotReason,
  ) {
    if (!active && reason !== "final") return;
    let store = storeInfoCache.get(sourceKey(origin, databaseName, storeName));

    if (!store) {
      try {
        const stores = await domain.getStoreInfo(databaseName, origin);
        for (const item of stores) {
          storeInfoCache.set(sourceKey(origin, databaseName, item.name), item);
        }
        store = storeInfoCache.get(sourceKey(origin, databaseName, storeName));
      } catch {
        store = fallbackStoreInfo(storeName);
      }
    }

    await runForSource(
      makeSource(origin, databaseName, store ?? fallbackStoreInfo(storeName)),
      reason,
    );
  }

  async function captureAll(reason: SnapshotReason) {
    if (!active && reason !== "final") return;

    const databases = await domain.discoverDatabases();
    const origin = await currentOrigin();
    if (origin) await trackOrigin(origin);

    for (const database of databases) {
      await trackOrigin(database.origin);
      const stores = await getStoreInfos(database);

      for (const store of stores) {
        await runForSource(makeSource(database.origin, database.name, store), reason);
      }
    }
  }

  function scheduleStoreCapture(origin: string, databaseName: string, storeName: string) {
    const key = sourceKey(origin, databaseName, storeName);
    const existing = timers.get(key);
    if (existing !== undefined) window.clearTimeout(existing);
    timers.set(
      key,
      window.setTimeout(() => {
        timers.delete(key);
        void captureStore(origin, databaseName, storeName, "change");
      }, 250),
    );
  }

  function scheduleCatalogCapture(origin: string) {
    const key = `${origin}::catalog`;
    const existing = timers.get(key);
    if (existing !== undefined) window.clearTimeout(existing);
    timers.set(
      key,
      window.setTimeout(() => {
        timers.delete(key);
        void captureAll("change");
      }, 350),
    );
  }

  function clearTimers() {
    for (const timer of timers.values()) {
      window.clearTimeout(timer);
    }
    timers.clear();
  }

  async function start() {
    active = true;
    try {
      await domain.enable();
      await captureAll("initial");

      disposers.push(
        client.on("Storage.indexedDBContentUpdated", (payload) => {
          const event = payload as IndexedDBContentUpdatedEvent;
          if (!event.origin || !event.databaseName || !event.objectStoreName) return;
          scheduleStoreCapture(event.origin, event.databaseName, event.objectStoreName);
        }),
        client.on("Storage.indexedDBListUpdated", (payload) => {
          const event = payload as IndexedDBListUpdatedEvent;
          if (!event.origin) return;
          scheduleCatalogCapture(event.origin);
        }),
      );
    } catch (err) {
      active = false;
      clearTimers();
      for (const dispose of disposers.splice(0)) dispose();
      await untrackOrigins();
      throw err;
    }
  }

  async function stop() {
    clearTimers();
    active = false;

    for (const dispose of disposers.splice(0)) dispose();

    await Promise.allSettled(Array.from(sourceRuns.values()));
    await captureAll("final");
    await Promise.allSettled(Array.from(sourceRuns.values()));
    await untrackOrigins();
  }

  return { start, stop };
}
