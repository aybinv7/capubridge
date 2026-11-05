import { save, open } from "@tauri-apps/plugin-dialog";
import {
  exportStoreChunk,
  importPutChunk,
  importReplaceSchema,
  type CDPClient,
  type IdbTransferRecord,
} from "@capubridge/cdp-protocol";
import { invokeCommand } from "@/runtime/ipc/client";

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

type IdbKeyPath = string | string[] | null;

function cdpKeyPathToValue(keyPath: CdpKeyPath): IdbKeyPath {
  if (keyPath.type === "null") return null;
  if (keyPath.type === "string") return keyPath.string ?? null;
  if (keyPath.type === "array") return keyPath.array ?? [];
  return null;
}

export interface IdbExportedIndex {
  name: string;
  keyPath: IdbKeyPath;
  unique: boolean;
  multiEntry: boolean;
}

export interface IdbExportedStore {
  name: string;
  keyPath: IdbKeyPath;
  autoIncrement: boolean;
  indexes: IdbExportedIndex[];
  records: Array<{ key: unknown; value: unknown }>;
}

/**
 * A Capubridge IndexedDB export. Version 2 encodes every non-JSON value as a `__type`
 * marker that the import turns back into the real value; version 1 files saved raw JSON.
 */
export interface IdbExportedDatabase {
  format: "capubridge-idb-export";
  version: 1 | 2;
  encoding?: "capubridge-markers-v1";
  /** Values the export could not save in a form that restores them (version 2). */
  lossy?: string[];
  exportedAt: string;
  origin: string;
  database: {
    name: string;
    version: number;
    stores: IdbExportedStore[];
  };
}

export interface IdbTransferProgress {
  store: string;
  storeIndex: number;
  storeCount: number;
  records: number;
}

export interface IdbTransferOptions {
  onProgress?: (progress: IdbTransferProgress) => void;
  signal?: AbortSignal;
}

export interface IdbImportOptions extends IdbTransferOptions {
  /** Replace even though the file cannot restore every value (see `exportLoss`). */
  acceptLoss?: boolean;
}

const IMPORT_CHUNK = 1000;

const V1_LOSS =
  "This file was saved by an older Capubridge: dates were saved as text, and binary data, Maps, Sets and Blobs as empty objects.";

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("The transfer was cancelled");
  error.name = "AbortError";
  throw error;
}

/**
 * Exports a whole database store by store, in chunks, so no single device answer holds the
 * database. Every value is kept: dates, binary data, Blobs, Maps and Sets travel as markers.
 */
export async function exportDatabase(
  client: CDPClient,
  origin: string,
  databaseName: string,
  options: IdbTransferOptions = {},
): Promise<IdbExportedDatabase> {
  const { databaseWithObjectStores } = await client.send<{
    databaseWithObjectStores: CdpDatabaseWithObjectStores;
  }>("IndexedDB.requestDatabase", { securityOrigin: origin, databaseName });

  const schema = databaseWithObjectStores.objectStores;
  const lossy = new Set<string>();
  const stores: IdbExportedStore[] = [];
  for (const [storeIndex, store] of schema.entries()) {
    const records: IdbTransferRecord[] = [];
    let after: unknown = undefined;
    for (;;) {
      throwIfAborted(options.signal);
      const chunk = await exportStoreChunk(client, {
        origin,
        database: databaseName,
        store: store.name,
        after,
      });
      records.push(...chunk.records);
      for (const entry of chunk.lossy) lossy.add(`${store.name}: ${entry}`);
      options.onProgress?.({
        store: store.name,
        storeIndex,
        storeCount: schema.length,
        records: records.length,
      });
      if (chunk.next === null) break;
      after = chunk.next;
    }
    stores.push({
      name: store.name,
      keyPath: cdpKeyPathToValue(store.keyPath),
      autoIncrement: store.autoIncrement,
      indexes: store.indexes.map((index) => ({
        name: index.name,
        keyPath: cdpKeyPathToValue(index.keyPath) ?? "",
        unique: index.unique,
        multiEntry: index.multiEntry,
      })),
      records,
    });
  }

  return {
    format: "capubridge-idb-export",
    version: 2,
    encoding: "capubridge-markers-v1",
    lossy: Array.from(lossy),
    exportedAt: new Date().toISOString(),
    origin,
    database: {
      name: databaseWithObjectStores.name,
      version: databaseWithObjectStores.version,
      stores,
    },
  };
}

/** What a replace from this file would not restore exactly; empty when it is lossless. */
export function exportLoss(data: IdbExportedDatabase): string[] {
  if (data.version === 1) return [V1_LOSS];
  return data.lossy ?? [];
}

/**
 * Replaces the database `targetName` on the device (the one the user chose, never the name
 * inside the file) with the file's schema and records, in chunks of 1,000 records. Refuses a
 * lossy file unless `acceptLoss` is set.
 */
export async function importDatabaseReplace(
  client: CDPClient,
  data: IdbExportedDatabase,
  targetName: string,
  options: IdbImportOptions = {},
): Promise<{ inserted: number }> {
  const loss = exportLoss(data);
  if (loss.length > 0 && options.acceptLoss !== true) {
    throw new Error(`Refused: ${loss[0]}`);
  }
  throwIfAborted(options.signal);
  const stores = data.database.stores;
  await importReplaceSchema(client, {
    name: targetName,
    version: data.database.version,
    stores: stores.map((store) => ({
      name: store.name,
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
      indexes: store.indexes,
    })),
  });

  let inserted = 0;
  for (const [storeIndex, store] of stores.entries()) {
    for (let start = 0; start < store.records.length; start += IMPORT_CHUNK) {
      throwIfAborted(options.signal);
      inserted += await importPutChunk(client, {
        database: targetName,
        store: store.name,
        keyPath: store.keyPath,
        records: store.records.slice(start, start + IMPORT_CHUNK),
        revive: data.version === 2,
      });
      options.onProgress?.({
        store: store.name,
        storeIndex,
        storeCount: stores.length,
        records: Math.min(start + IMPORT_CHUNK, store.records.length),
      });
    }
  }
  return { inserted };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, bytes.length)) as unknown as number[],
    );
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function saveIdbExportToFile(
  exported: IdbExportedDatabase,
  defaultName: string,
): Promise<string | null> {
  const dest = await save({
    defaultPath: defaultName.endsWith(".json") ? defaultName : `${defaultName}.json`,
    filters: [{ name: "IndexedDB JSON export", extensions: ["json"] }],
  });
  if (!dest) return null;
  const json = JSON.stringify(exported, null, 2);
  await invokeCommand("save_base64_file", {
    path: dest,
    data: bytesToBase64(new TextEncoder().encode(json)),
  });
  return dest;
}

export interface PickedIdbExport {
  path: string;
  data: IdbExportedDatabase;
  /** What a replace from this file would not restore exactly (`exportLoss`). */
  lossy: string[];
}

/** Checks that parsed JSON is a Capubridge IndexedDB export this version can read. */
export function parseIdbExport(text: string): IdbExportedDatabase {
  const data = JSON.parse(text) as Partial<IdbExportedDatabase> | null;
  if (!data || data.format !== "capubridge-idb-export") {
    throw new Error("Not a Capubridge IndexedDB export file");
  }
  if (data.version !== 1 && data.version !== 2) {
    throw new Error(`This export was made by a newer Capubridge (format ${String(data.version)})`);
  }
  if (!data.database || !Array.isArray(data.database.stores)) {
    throw new Error("The export file has no database in it");
  }
  return data as IdbExportedDatabase;
}

export async function pickIdbExport(): Promise<PickedIdbExport | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "IndexedDB JSON export", extensions: ["json"] }],
  });
  if (!picked || Array.isArray(picked)) return null;
  const base64 = await invokeCommand("read_local_file_base64", { path: picked });
  const data = parseIdbExport(new TextDecoder("utf-8").decode(base64ToBytes(base64)));
  return { path: picked, data, lossy: exportLoss(data) };
}
