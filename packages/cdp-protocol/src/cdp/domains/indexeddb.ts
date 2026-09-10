import type { CDPClient } from "../client.js";

export interface IDBDatabaseInfo {
  name: string;
  version: number;
  objectStoreNames: string[];
  origin: string;
}

export interface IDBObjectStoreInfo {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IDBIndexInfo[];
}

export interface IDBIndexInfo {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

export interface IDBRecord {
  key: IDBValidKey;
  primaryKey?: IDBValidKey;
  value: unknown;
  editable?: boolean;
  readOnlyReason?: string;
}

export interface GetDataParams {
  securityOrigin: string;
  databaseName: string;
  objectStoreName: string;
  indexName?: string;
  skipCount: number;
  pageSize: number;
  keyRange?: unknown;
}

export interface GetDataResult {
  records: IDBRecord[];
  hasMore: boolean;
}

export interface StoreInfo {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  recordCount: number;
  keyGeneratorValue?: number;
  indexCount: number;
  indexes: IDBIndexInfo[];
  estimatedSize: number;
}

// CDP types for the IndexedDB domain
interface CdpKeyPath {
  type: "null" | "string" | "array";
  string?: string;
  array?: string[];
}

interface CdpObjectStoreIndex {
  name: string;
  keyPath: CdpKeyPath;
  unique: boolean;
  multiEntry: boolean;
}

interface CdpObjectStore {
  name: string;
  keyPath: CdpKeyPath;
  autoIncrement: boolean;
  indexes: CdpObjectStoreIndex[];
}

interface CdpDatabaseWithObjectStores {
  name: string;
  version: number;
  objectStores: CdpObjectStore[];
}

interface CdpRemoteObject {
  type: string;
  subtype?: string;
  value?: unknown;
  description?: string;
  objectId?: string;
  unserializableValue?: string;
}

interface CdpDataEntry {
  key: CdpRemoteObject;
  primaryKey: CdpRemoteObject;
  value: CdpRemoteObject;
}

function cdpKeyPathToValue(keyPath: CdpKeyPath): string | string[] | null {
  if (keyPath.type === "null") return null;
  if (keyPath.type === "string") return keyPath.string ?? null;
  if (keyPath.type === "array") return keyPath.array ?? [];
  return null;
}

function extractRemoteValue(obj: CdpRemoteObject): unknown {
  if (obj.value !== undefined) return obj.value;
  if (obj.description !== undefined) return obj.description;
  return null;
}

interface MaterializedValue {
  value: unknown;
  editable: boolean;
  reason?: string;
}

function supportsIndexedDbFallback(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return (
    message.includes("method not found") ||
    message.includes("wasn't found") ||
    message.includes("not supported") ||
    message.includes("-32601")
  );
}

function containsReadOnlyMarker(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsReadOnlyMarker);
  const object = value as Record<string, unknown>;
  if (typeof object.__type === "string") return true;
  return Object.values(object).some(containsReadOnlyMarker);
}

export class IDBDomain {
  constructor(private client: CDPClient) {}

  enable(): Promise<unknown> {
    return this.client.send("IndexedDB.enable");
  }

  async discoverDatabases(): Promise<IDBDatabaseInfo[]> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
          (async () => {
            try {
              const dbs = await indexedDB.databases();
              const details = await Promise.all(dbs.map(async (dbInfo) => {
                return new Promise((resolve, reject) => {
                  const req = indexedDB.open(dbInfo.name);
                  req.onsuccess = () => {
                    const db = req.result;
                    const info = {
                      name: db.name,
                      version: db.version,
                      origin: location.origin,
                      objectStoreNames: Array.from(db.objectStoreNames)
                    };
                    db.close();
                    resolve(info);
                  };
                  req.onerror = () => reject(req.error);
                });
              }));
              return JSON.stringify(details);
            } catch (e) {
              return JSON.stringify({ error: e.message });
            }
          })()
        `,
      awaitPromise: true,
      returnByValue: true,
    });

    const value = (result.result as Record<string, unknown>).value as string;

    const parsed = JSON.parse(value as string);
    if (parsed.error) {
      return [];
    }

    return parsed as IDBDatabaseInfo[];
  }

  async getStoreInfo(databaseName: string, securityOrigin: string): Promise<StoreInfo[]> {
    await this.enable();

    const { databaseWithObjectStores } = await this.client.send<{
      databaseWithObjectStores: CdpDatabaseWithObjectStores;
    }>("IndexedDB.requestDatabase", { securityOrigin, databaseName });

    const stores = await Promise.all(
      databaseWithObjectStores.objectStores.map(async (store) => {
        const [{ entriesCount, keyGeneratorValue }, sample] = await Promise.all([
          this.client.send<{ entriesCount: number; keyGeneratorValue: number }>(
            "IndexedDB.getMetadata",
            { securityOrigin, databaseName, objectStoreName: store.name },
          ),
          this.sampleStoreSize(securityOrigin, databaseName, store.name),
        ]);

        // Extrapolate total size from sample
        const estimatedSize =
          sample.count > 0 && entriesCount > 0
            ? Math.round((sample.bytes / sample.count) * entriesCount)
            : 0;

        return {
          name: store.name,
          keyPath: cdpKeyPathToValue(store.keyPath),
          autoIncrement: store.autoIncrement,
          recordCount: entriesCount,
          keyGeneratorValue,
          indexCount: store.indexes.length,
          indexes: store.indexes.map((idx) => ({
            name: idx.name,
            keyPath: cdpKeyPathToValue(idx.keyPath) as string | string[],
            unique: idx.unique,
            multiEntry: idx.multiEntry,
          })),
          estimatedSize,
        } satisfies StoreInfo;
      }),
    );

    return stores;
  }

  /**
   * Fetches a small sample of records to estimate per-record byte size.
   * Runs in parallel with getMetadata — adds zero sequential latency.
   */
  private async sampleStoreSize(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    sampleSize = 12,
  ): Promise<{ bytes: number; count: number }> {
    try {
      const { objectStoreDataEntries } = await this.client.send<{
        objectStoreDataEntries: CdpDataEntry[];
        hasMore: boolean;
      }>("IndexedDB.requestData", {
        securityOrigin,
        databaseName,
        objectStoreName,
        indexName: "",
        skipCount: 0,
        pageSize: sampleSize,
      });

      if (objectStoreDataEntries.length === 0) return { bytes: 0, count: 0 };

      const bytes = objectStoreDataEntries.reduce((sum, entry) => {
        const v = extractRemoteValue(entry.value);
        const k = extractRemoteValue(entry.key);
        return sum + JSON.stringify(v).length + JSON.stringify(k).length;
      }, 0);

      return { bytes, count: objectStoreDataEntries.length };
    } catch {
      return this.sampleStoreSizeViaEval(databaseName, objectStoreName, sampleSize);
    }
  }

  private async sampleStoreSizeViaEval(
    databaseName: string,
    objectStoreName: string,
    sampleSize: number,
  ): Promise<{ bytes: number; count: number }> {
    try {
      const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
        expression: `
          (async () => {
            try {
              const req = indexedDB.open(${JSON.stringify(databaseName)});
              const db = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
              });

              const store = db.transaction(${JSON.stringify(objectStoreName)}, 'readonly').objectStore(${JSON.stringify(objectStoreName)});
              const records = [];
              const cursorReq = store.openCursor();
              await new Promise((resolve, reject) => {
                cursorReq.onsuccess = () => {
                  const cursor = cursorReq.result;
                  if (!cursor || records.length >= ${sampleSize}) return resolve();
                  records.push({ key: cursor.primaryKey, value: cursor.value });
                  cursor.continue();
                };
                cursorReq.onerror = () => reject(cursorReq.error);
              });

              db.close();

              let totalBytes = 0;
              for (const r of records) {
                totalBytes += JSON.stringify(r.key).length + JSON.stringify(r.value).length;
              }
              return JSON.stringify({ bytes: totalBytes, count: records.length });
            } catch (e) {
              return JSON.stringify({ error: e.message });
            }
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });

      const value = (result.result as Record<string, unknown>).value as string;
      const parsed = JSON.parse(value);
      if (parsed.error) return { bytes: 0, count: 0 };
      return { bytes: parsed.bytes, count: parsed.count };
    } catch {
      return { bytes: 0, count: 0 };
    }
  }

  async getStorageEstimate(): Promise<{ usage: number; idbUsage: number; quota: number }> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const est = await navigator.storage.estimate();
            return JSON.stringify({
              usage: est.usage ?? 0,
              quota: est.quota ?? 0,
              idbUsage: (est.usageDetails && est.usageDetails.indexedDB) ? est.usageDetails.indexedDB : (est.usage ?? 0)
            });
          } catch (e) {
            return JSON.stringify({ usage: 0, quota: 0, idbUsage: 0 });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    try {
      return JSON.parse(value) as { usage: number; idbUsage: number; quota: number };
    } catch {
      return { usage: 0, idbUsage: 0, quota: 0 };
    }
  }

  async getDatabases(securityOrigin: string): Promise<IDBDatabaseInfo[]> {
    const { databaseNames } = await this.client.send<{ databaseNames: string[] }>(
      "IndexedDB.requestDatabaseNames",
      { securityOrigin },
    );
    return Promise.all(databaseNames.map((name: string) => this.getDatabase(securityOrigin, name)));
  }

  async getDatabase(securityOrigin: string, databaseName: string): Promise<IDBDatabaseInfo> {
    const { databaseWithObjectStores } = await this.client.send<{
      databaseWithObjectStores: CdpDatabaseWithObjectStores;
    }>("IndexedDB.requestDatabase", { securityOrigin, databaseName });

    return {
      name: databaseWithObjectStores.name,
      version: databaseWithObjectStores.version,
      origin: securityOrigin,
      objectStoreNames: databaseWithObjectStores.objectStores.map((s) => s.name),
    };
  }

  async putRecord(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    value: unknown,
    primaryKey?: IDBValidKey,
  ): Promise<void> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            if (location.origin !== ${JSON.stringify(securityOrigin)}) throw new Error('IndexedDB origin mismatch');
            const req = indexedDB.open(${JSON.stringify(databaseName)});
            const db = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? 'open failed');
            });
            const tx = db.transaction(${JSON.stringify(objectStoreName)}, 'readwrite');
            const store = tx.objectStore(${JSON.stringify(objectStoreName)});
            const key = ${primaryKey === undefined ? "undefined" : JSON.stringify(primaryKey)};
            if (store.keyPath === null && key === undefined) throw new Error('Out-of-line key required');
            if (key === undefined || store.keyPath !== null) store.put(${JSON.stringify(value)});
            else store.put(${JSON.stringify(value)}, key);
            await new Promise((resolve, reject) => {
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => reject(tx.error?.message ?? 'put failed');
            });
            db.close();
            return JSON.stringify({ ok: true });
          } catch (e) {
            return JSON.stringify({ error: String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const raw = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (parsed.error) throw new Error(parsed.error);
  }

  async deleteRecord(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    key: IDBValidKey,
  ): Promise<void> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            if (location.origin !== ${JSON.stringify(securityOrigin)}) throw new Error('IndexedDB origin mismatch');
            const req = indexedDB.open(${JSON.stringify(databaseName)});
            const db = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? 'open failed');
            });
            const tx = db.transaction(${JSON.stringify(objectStoreName)}, 'readwrite');
            tx.objectStore(${JSON.stringify(objectStoreName)}).delete(${JSON.stringify(key)});
            await new Promise((resolve, reject) => {
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => reject(tx.error?.message ?? 'delete failed');
            });
            db.close();
            return JSON.stringify({ ok: true });
          } catch (e) {
            return JSON.stringify({ error: String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const raw = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (parsed.error) throw new Error(parsed.error);
  }

  async clearObjectStore(
    _securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
  ): Promise<void> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const req = indexedDB.open(${JSON.stringify(databaseName)});
            const db = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? 'open failed');
            });
            const tx = db.transaction(${JSON.stringify(objectStoreName)}, 'readwrite');
            tx.objectStore(${JSON.stringify(objectStoreName)}).clear();
            await new Promise((resolve, reject) => {
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => reject(tx.error?.message ?? 'clear failed');
            });
            db.close();
            return JSON.stringify({ ok: true });
          } catch (e) {
            return JSON.stringify({ error: String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const raw = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (parsed.error) throw new Error(parsed.error);
  }

  async deleteObjectStore(
    _securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
  ): Promise<void> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const openReq = indexedDB.open(${JSON.stringify(databaseName)});
            const currentVersion = await new Promise((resolve, reject) => {
              openReq.onsuccess = () => { const v = openReq.result.version; openReq.result.close(); resolve(v); };
              openReq.onerror = () => reject(openReq.error?.message ?? 'open failed');
            });
            const upgradeReq = indexedDB.open(${JSON.stringify(databaseName)}, currentVersion + 1);
            await new Promise((resolve, reject) => {
              upgradeReq.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains(${JSON.stringify(objectStoreName)})) {
                  db.deleteObjectStore(${JSON.stringify(objectStoreName)});
                }
              };
              upgradeReq.onsuccess = () => { upgradeReq.result.close(); resolve(true); };
              upgradeReq.onerror = () => reject(upgradeReq.error?.message ?? 'upgrade failed');
            });
            return JSON.stringify({ ok: true });
          } catch (e) {
            return JSON.stringify({ error: String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const raw = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (parsed.error) throw new Error(parsed.error);
  }

  async deleteDatabase(_securityOrigin: string, databaseName: string): Promise<void> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        new Promise((resolve, reject) => {
          const req = indexedDB.deleteDatabase(${JSON.stringify(databaseName)});
          req.onsuccess = () => resolve(JSON.stringify({ ok: true }));
          req.onerror = () => reject(JSON.stringify({ error: req.error?.message ?? 'delete failed' }));
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const raw = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (parsed.error) throw new Error(parsed.error);
  }

  async getData(params: GetDataParams): Promise<GetDataResult> {
    const isLocalForage = params.databaseName === "localforage";

    if (isLocalForage) {
      return this.getDataViaEval(params);
    }

    await this.enable();

    try {
      const response = await this.client.send<{
        objectStoreDataEntries: CdpDataEntry[];
        hasMore: boolean;
      }>("IndexedDB.requestData", {
        securityOrigin: params.securityOrigin,
        databaseName: params.databaseName,
        objectStoreName: params.objectStoreName,
        indexName: params.indexName ?? "",
        skipCount: params.skipCount,
        pageSize: params.pageSize,
        ...(params.keyRange ? { keyRange: params.keyRange } : {}),
      });

      console.log(
        "[IDB] requestData hasMore:",
        response.hasMore,
        "count:",
        response.objectStoreDataEntries.length,
      );

      const records = await Promise.all(
        response.objectStoreDataEntries.map(async (entry) => {
          const [key, primaryKey, value] = await Promise.all([
            this.materializeRemoteValue(entry.key),
            this.materializeRemoteValue(entry.primaryKey),
            this.materializeRemoteValue(entry.value),
          ]);
          const readOnlyReason = [key, primaryKey, value]
            .map((item) => item.reason)
            .find((reason): reason is string => Boolean(reason));
          return {
            key: key.value as IDBValidKey,
            primaryKey: primaryKey.value as IDBValidKey,
            value: value.value,
            editable: !readOnlyReason,
            ...(readOnlyReason ? { readOnlyReason } : {}),
          } satisfies IDBRecord;
        }),
      );

      return { records, hasMore: response.hasMore };
    } catch (err) {
      if (!supportsIndexedDbFallback(err)) throw err;
      console.warn("[IDB] CDP requestData failed, falling back to Runtime.evaluate:", err);
      return this.getDataViaEval(params);
    }
  }

  private async materializeRemoteValue(obj: CdpRemoteObject): Promise<MaterializedValue> {
    if (obj.value !== undefined) return { value: obj.value, editable: true };
    if (obj.unserializableValue !== undefined) {
      return {
        value: obj.unserializableValue,
        editable: false,
        reason: "Unsupported serialized value",
      };
    }
    if (!obj.objectId) {
      return { value: extractRemoteValue(obj), editable: true };
    }
    try {
      const response = await this.client.send<{
        result: { result: { value?: { value?: unknown; editable?: boolean; reason?: string } } };
      }>("Runtime.callFunctionOn", {
        objectId: obj.objectId,
        functionDeclaration: `function() {
          const maxDepth = 8;
          const maxNodes = 10000;
          const maxBytes = 1024 * 1024;
          const seen = new WeakSet();
          let nodes = 0;
          let unsupported = false;
          function clone(value, depth) {
            if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
            if (typeof value === 'bigint') { unsupported = true; return { __type: 'BigInt', value: value.toString() }; }
            if (depth >= maxDepth) { unsupported = true; return { __type: 'MaxDepth' }; }
            if (value instanceof Date) { unsupported = true; return { __type: 'Date', value: value.toISOString() }; }
            if (value instanceof Blob) { unsupported = true; return { __type: 'Blob', size: value.size, type: value.type }; }
            if (value instanceof ArrayBuffer) { unsupported = true; return { __type: 'ArrayBuffer', byteLength: value.byteLength }; }
            if (value instanceof Uint8Array) { unsupported = true; return { __type: 'Uint8Array', data: Array.from(value).slice(0, maxBytes) }; }
            if (typeof value !== 'object') { unsupported = true; return String(value); }
            if (seen.has(value)) { unsupported = true; return { __type: 'Circular' }; }
            seen.add(value);
            nodes += 1;
            if (nodes > maxNodes) { unsupported = true; return { __type: 'MaxNodes' }; }
            if (Array.isArray(value)) return value.map(item => clone(item, depth + 1));
            const result = {};
            for (const key of Object.keys(value)) result[key] = clone(value[key], depth + 1);
            return result;
          }
          const value = clone(this, 0);
          const serialized = JSON.stringify(value);
          if (serialized.length > maxBytes) return { value: { __type: 'MaxBytes' }, editable: false, reason: 'Value exceeds 1 MiB limit' };
          return { value, editable: !unsupported, reason: unsupported ? 'Structured-clone value is read-only' : undefined };
        }`,
        returnByValue: true,
        awaitPromise: true,
      });
      const value = response.result.result.value;
      if (value)
        return { value: value.value, editable: value.editable !== false, reason: value.reason };
      return {
        value: extractRemoteValue(obj),
        editable: false,
        reason: "Remote value could not be materialized",
      };
    } finally {
      await this.client
        .send("Runtime.releaseObject", { objectId: obj.objectId })
        .catch(() => undefined);
    }
  }

  private async getDataViaEval(params: GetDataParams): Promise<GetDataResult> {
    const indexName = params.indexName ?? "";
    const expression = `
      (async () => {
        try {
          const req = indexedDB.open('${params.databaseName}');
          const db = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          try {
            const store = db.transaction(${JSON.stringify(params.objectStoreName)}, 'readonly').objectStore(${JSON.stringify(params.objectStoreName)});
            const cursorSource = ${indexName ? `store.index(${JSON.stringify(indexName)})` : "store"};
            const rangeSpec = ${params.keyRange ? JSON.stringify(params.keyRange) : "null"};
            const range = rangeSpec ? (rangeSpec.lower !== undefined && rangeSpec.upper !== undefined ? IDBKeyRange.bound(rangeSpec.lower, rangeSpec.upper, Boolean(rangeSpec.lowerOpen), Boolean(rangeSpec.upperOpen)) : rangeSpec.lower !== undefined ? IDBKeyRange.lowerBound(rangeSpec.lower, Boolean(rangeSpec.lowerOpen)) : IDBKeyRange.upperBound(rangeSpec.upper, Boolean(rangeSpec.upperOpen))) : undefined;
            const records = [];
            const seen = new WeakSet();
            let nodes = 0;
            function safeSerialize(value, depth = 0) {
            if (value === undefined || value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
            if (depth >= 8 || nodes++ >= 10000) return { __type: 'MaxDepth' };
            if (value instanceof Date) return { __type: 'Date', value: value.toISOString() };
            if (value instanceof ArrayBuffer) return { __type: 'ArrayBuffer', byteLength: value.byteLength };
            if (value instanceof Uint8Array) return { __type: 'Uint8Array', data: Array.from(value).slice(0, 1048576) };
            if (seen.has(value)) return { __type: 'Circular' };
            seen.add(value);
            if (Array.isArray(value)) return value.map(item => safeSerialize(item, depth + 1));
            const output = {};
            for (const key of Object.keys(value)) output[key] = safeSerialize(value[key], depth + 1);
            return output;
            }
            let skipped = false;
            const skip = Math.max(0, ${params.skipCount});
            const take = Math.max(1, Math.min(10000, ${params.pageSize}));
            const cursorReq = cursorSource.openCursor(range);
            await new Promise((resolve, reject) => {
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (!cursor) return resolve();
              if (!skipped && skip > 0) {
                skipped = true;
                cursor.advance(skip);
                return;
              }
              if (records.length >= take + 1) return resolve();
              records.push({ key: safeSerialize(cursor.key), primaryKey: safeSerialize(cursor.primaryKey), value: safeSerialize(cursor.value) });
              cursor.continue();
            };
            cursorReq.onerror = () => reject(cursorReq.error);
            });
            return JSON.stringify({ records: records.slice(0, take), hasMore: records.length > take });
          } finally {
            db.close();
          }
        } catch (e) {
          return JSON.stringify({ error: e.message });
        }
      })()
    `;

    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    const value = (result.result as Record<string, unknown>).value as string;
    console.log("[IDB] getDataViaEval result (first 500 chars):", value?.substring(0, 500));

    const parsed = JSON.parse(value as string);
    if (parsed.error) {
      throw new Error(parsed.error);
    }

    const records = (parsed.records as IDBRecord[]).map((record) => ({
      ...record,
      editable:
        !containsReadOnlyMarker(record.value) &&
        !containsReadOnlyMarker(record.primaryKey) &&
        !containsReadOnlyMarker(record.key),
      ...(containsReadOnlyMarker(record.value) ||
      containsReadOnlyMarker(record.primaryKey) ||
      containsReadOnlyMarker(record.key)
        ? { readOnlyReason: "Structured-clone value is read-only" }
        : {}),
    }));
    return {
      records,
      hasMore: parsed.hasMore as boolean,
    };
  }

  async getDatabaseSize(databaseName: string, securityOrigin: string): Promise<number> {
    const stores = await this.getStoreInfo(databaseName, securityOrigin);
    return stores.reduce((sum, store) => sum + (store.estimatedSize ?? 0), 0);
  }
}
