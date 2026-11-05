import { evaluateChecked } from "../evaluate.js";
import type { CDPClient } from "../client.js";
import type { IDBRecord } from "./indexeddb-records.js";
import {
  readPageByEval,
  readPageByProtocol,
  readRecord,
  sampleStoreSizes,
  searchStoreOnDevice,
  type GetDataParams,
  type GetDataResult,
  type SearchStoreParams,
  type SearchStoreResult,
} from "./indexeddb-reads.js";
import {
  clearStoreOnDevice,
  deleteDatabaseOnDevice,
  deleteRecordOnDevice,
  deleteStoreOnDevice,
  patchRecordOnDevice,
  putRecordOnDevice,
} from "./indexeddb-writes.js";

export type { IDBRecord } from "./indexeddb-records.js";
export type {
  GetDataParams,
  GetDataResult,
  SearchStoreParams,
  SearchStoreResult,
} from "./indexeddb-reads.js";

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

function cdpKeyPathToValue(keyPath: CdpKeyPath): string | string[] | null {
  if (keyPath.type === "null") return null;
  if (keyPath.type === "string") return keyPath.string ?? null;
  if (keyPath.type === "array") return keyPath.array ?? [];
  return null;
}

export class IDBDomain {
  constructor(private client: CDPClient) {}

  enable(): Promise<unknown> {
    return this.client.send("IndexedDB.enable");
  }

  /** Databases of the page's own origin. A device failure throws instead of reading as "none". */
  async discoverDatabases(): Promise<IDBDatabaseInfo[]> {
    const result = await evaluateChecked(this.client, {
      expression: `
        (async () => {
          const dbs = await indexedDB.databases();
          const details = await Promise.all(dbs.map((dbInfo) => new Promise((resolve, reject) => {
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
          })));
          return JSON.stringify(details);
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = result.result.value;
    return typeof value === "string" ? (JSON.parse(value) as IDBDatabaseInfo[]) : [];
  }

  async getStoreInfo(databaseName: string, securityOrigin: string): Promise<StoreInfo[]> {
    await this.enable();

    const { databaseWithObjectStores } = await this.client.send<{
      databaseWithObjectStores: CdpDatabaseWithObjectStores;
    }>("IndexedDB.requestDatabase", { securityOrigin, databaseName });

    const storeNames = databaseWithObjectStores.objectStores.map((store) => store.name);
    const [metadata, samples] = await Promise.all([
      Promise.all(
        storeNames.map((objectStoreName) =>
          this.client.send<{ entriesCount: number; keyGeneratorValue: number }>(
            "IndexedDB.getMetadata",
            { securityOrigin, databaseName, objectStoreName },
          ),
        ),
      ),
      sampleStoreSizes(this.client, databaseName, storeNames).catch(
        () => ({}) as Record<string, { bytes: number; count: number }>,
      ),
    ]);

    return databaseWithObjectStores.objectStores.map((store, index) => {
      const { entriesCount, keyGeneratorValue } = metadata[index] ?? {
        entriesCount: 0,
        keyGeneratorValue: 0,
      };
      const sample = samples[store.name];
      const estimatedSize =
        sample && sample.count > 0 && entriesCount > 0
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
    });
  }

  async getStorageEstimate(): Promise<{ usage: number; idbUsage: number; quota: number }> {
    const result = await evaluateChecked(this.client, {
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
    const value = result.result.value as string;
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

  /** Writes a whole record; `primaryKey` may hold key markers (dates, binary). */
  putRecord(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    value: unknown,
    primaryKey?: unknown,
  ): Promise<void> {
    return putRecordOnDevice(
      this.client,
      securityOrigin,
      databaseName,
      objectStoreName,
      value,
      primaryKey,
    );
  }

  /** Changes one field in place on the device; every other field is kept exactly as stored. */
  patchRecord(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    primaryKey: unknown,
    path: readonly string[],
    value: unknown,
  ): Promise<void> {
    return patchRecordOnDevice(
      this.client,
      securityOrigin,
      databaseName,
      objectStoreName,
      primaryKey,
      path,
      value,
    );
  }

  deleteRecord(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    key: unknown,
  ): Promise<void> {
    return deleteRecordOnDevice(this.client, securityOrigin, databaseName, objectStoreName, key);
  }

  clearObjectStore(
    _securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
  ): Promise<void> {
    return clearStoreOnDevice(this.client, databaseName, objectStoreName);
  }

  /** Throws `IdbBlockedError` when the app holds the database open; nothing is changed then. */
  deleteObjectStore(
    _securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
  ): Promise<void> {
    return deleteStoreOnDevice(this.client, databaseName, objectStoreName);
  }

  /** Throws `IdbBlockedError` when the app holds the database open; the delete stays queued. */
  deleteDatabase(_securityOrigin: string, databaseName: string): Promise<void> {
    return deleteDatabaseOnDevice(this.client, databaseName);
  }

  /**
   * One page of records: one evaluate on the page; when that fails (another frame's origin),
   * `IndexedDB.requestData` with a single batched encode.
   */
  async getData(params: GetDataParams): Promise<GetDataResult> {
    if (params.databaseName === "localforage") return readPageByEval(this.client, params);
    try {
      return await readPageByEval(this.client, params);
    } catch (evalError) {
      try {
        return await readPageByProtocol(this.client, params);
      } catch (protocolError) {
        throw new Error(
          `IndexedDB read failed: ${errorText(evalError)}; DevTools: ${errorText(protocolError)}`,
        );
      }
    }
  }

  /** One record by primary key, read again from the device, or `null` when it is gone. */
  getRecord(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    primaryKey: unknown,
  ): Promise<IDBRecord | null> {
    return readRecord(this.client, securityOrigin, databaseName, objectStoreName, primaryKey);
  }

  /** Bounded scan of the whole store on the device for `needle` in keys and values. */
  searchStore(params: SearchStoreParams): Promise<SearchStoreResult> {
    return searchStoreOnDevice(this.client, params);
  }

  async getDatabaseSize(databaseName: string, securityOrigin: string): Promise<number> {
    const stores = await this.getStoreInfo(databaseName, securityOrigin);
    return stores.reduce((sum, store) => sum + (store.estimatedSize ?? 0), 0);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
