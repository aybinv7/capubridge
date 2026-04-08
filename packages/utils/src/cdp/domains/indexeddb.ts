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
  value: unknown;
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
              const req = indexedDB.open('${databaseName}');
              const db = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
              });

              const store = db.transaction('${objectStoreName}', 'readonly').objectStore('${objectStoreName}');
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
    _securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    value: unknown,
  ): Promise<void> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const req = indexedDB.open('${databaseName}');
            const db = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? 'open failed');
            });
            const tx = db.transaction('${objectStoreName}', 'readwrite');
            tx.objectStore('${objectStoreName}').put(${JSON.stringify(value)});
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
    _securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    key: IDBValidKey,
  ): Promise<void> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            const req = indexedDB.open('${databaseName}');
            const db = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? 'open failed');
            });
            const tx = db.transaction('${objectStoreName}', 'readwrite');
            tx.objectStore('${objectStoreName}').delete(${JSON.stringify(key)});
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

      const records: IDBRecord[] = response.objectStoreDataEntries.map((entry) => ({
        key: extractRemoteValue(entry.key) as IDBValidKey,
        value: extractRemoteValue(entry.value),
      }));

      return { records, hasMore: response.hasMore };
    } catch (err) {
      console.warn("[IDB] CDP requestData failed, falling back to Runtime.evaluate:", err);
      return this.getDataViaEval(params);
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

          const store = db.transaction('${params.objectStoreName}', 'readonly').objectStore('${params.objectStoreName}');
          const cursorSource = ${indexName ? `store.index('${indexName}')` : "store"};
          const allRecords = [];

          const cursorReq = cursorSource.openCursor();
          await new Promise((resolve, reject) => {
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (!cursor) return resolve();
              allRecords.push({ key: cursor.primaryKey, value: cursor.value });
              cursor.continue();
            };
            cursorReq.onerror = () => reject(cursorReq.error);
          });

          db.close();

          const skip = ${params.skipCount};
          const take = ${params.pageSize};
          const total = allRecords.length;
          const hasMore = skip + take < total;

          function safeSerialize(val) {
            if (val === undefined) return undefined;
            if (val === null) return null;
            if (val instanceof Date) return { __type: 'Date', value: val.toISOString() };
            if (val instanceof Blob) return { __type: 'Blob', size: val.size, type: val.type };
            if (typeof val === 'bigint') return { __type: 'BigInt', value: val.toString() };
            if (val instanceof ArrayBuffer) return { __type: 'ArrayBuffer', byteLength: val.byteLength };
            if (val instanceof Uint8Array) return { __type: 'Uint8Array', data: Array.from(val) };
            if (val instanceof Set) return { __type: 'Set', values: Array.from(val) };
            if (val instanceof Map) return { __type: 'Map', entries: Array.from(val.entries()) };
            return val;
          }

          const records = [];
          for (let i = skip; i < Math.min(skip + take, total); i++) {
            records.push({
              key: safeSerialize(allRecords[i].key),
              value: safeSerialize(allRecords[i].value)
            });
          }

          return JSON.stringify({ records, hasMore, total });
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

    return {
      records: parsed.records as IDBRecord[],
      hasMore: parsed.hasMore as boolean,
    };
  }

  async getDatabaseSize(databaseName: string, securityOrigin: string): Promise<number> {
    const stores = await this.getStoreInfo(databaseName, securityOrigin);
    return stores.reduce((sum, store) => sum + (store.estimatedSize ?? 0), 0);
  }
}
