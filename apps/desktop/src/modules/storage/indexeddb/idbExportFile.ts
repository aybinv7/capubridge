import { open, save } from "@tauri-apps/plugin-dialog";
import { exportStoreChunk, type CDPClient } from "@capubridge/cdp-protocol";
import { invokeCommand } from "@/runtime/ipc/client";
import { openStreamedFile, type StreamedFile } from "@/lib/streamedFile";
import { exportLoss } from "./idbImportPlan";
import type {
  IdbExportedDatabase,
  IdbExportedStore,
  IdbKeyPath,
  IdbTransferOptions,
} from "./idbTransfer.types";

interface CdpKeyPath {
  type: "null" | "string" | "array";
  string?: string;
  array?: string[];
}

interface CdpObjectStore {
  name: string;
  keyPath: CdpKeyPath;
  autoIncrement: boolean;
  indexes: Array<{ name: string; keyPath: CdpKeyPath; unique: boolean; multiEntry: boolean }>;
}

interface CdpDatabaseWithObjectStores {
  name: string;
  version: number;
  objectStores: CdpObjectStore[];
}

const FILE_FILTER = { name: "IndexedDB JSON export", extensions: ["json"] };

function cdpKeyPathToValue(keyPath: CdpKeyPath): IdbKeyPath {
  if (keyPath.type === "null") return null;
  if (keyPath.type === "string") return keyPath.string ?? null;
  if (keyPath.type === "array") return keyPath.array ?? [];
  return null;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("The transfer was cancelled");
  error.name = "AbortError";
  throw error;
}

function header(origin: string, name: string, version: number): string {
  return `{"format":"capubridge-idb-export","version":2,"encoding":"capubridge-markers-v1","exportedAt":${JSON.stringify(new Date().toISOString())},"origin":${JSON.stringify(origin)},"database":{"name":${JSON.stringify(name)},"version":${JSON.stringify(version)},"stores":[`;
}

function storeHead(store: Omit<IdbExportedStore, "records">, first: boolean): string {
  const { name, keyPath, autoIncrement, indexes } = store;
  return `${first ? "" : ","}${JSON.stringify({ name, keyPath, autoIncrement, indexes }).slice(0, -1)},"records":[`;
}

function footer(lossy: readonly string[]): string {
  return `]},"lossy":${JSON.stringify(lossy)}}`;
}

/** Asks where to save an export; `null` when the person cancels. */
export async function chooseExportPath(defaultName: string): Promise<string | null> {
  return save({
    defaultPath: defaultName.endsWith(".json") ? defaultName : `${defaultName}.json`,
    filters: [FILE_FILTER],
  });
}

async function streamTo<T>(
  path: string,
  body: (file: StreamedFile) => Promise<T>,
): Promise<{ result: T; bytes: number }> {
  const file = await openStreamedFile(path);
  try {
    const result = await body(file);
    return { result, bytes: await file.finish() };
  } catch (error) {
    try {
      await file.discard();
    } catch (discardError) {
      console.warn("Could not remove the unfinished export file", discardError);
    }
    throw error;
  }
}

/**
 * Exports a whole database to `path`, store by store and chunk by chunk, written to disk as it
 * is read, so neither the phone's answers nor the file are ever held whole. Every value is
 * kept: dates, binary data, Blobs, Maps and Sets travel as markers. A cancel or failure leaves
 * no file behind.
 */
export async function exportDatabaseToFile(
  client: CDPClient,
  origin: string,
  databaseName: string,
  path: string,
  options: IdbTransferOptions = {},
): Promise<{ bytes: number; records: number; lossy: string[] }> {
  const { databaseWithObjectStores: db } = await client.send<{
    databaseWithObjectStores: CdpDatabaseWithObjectStores;
  }>("IndexedDB.requestDatabase", { securityOrigin: origin, databaseName });

  const { result, bytes } = await streamTo(path, async (file) => {
    const lossy: string[] = [];
    let total = 0;
    await file.write(header(origin, db.name, db.version));
    for (const [storeIndex, store] of db.objectStores.entries()) {
      await file.write(
        storeHead(
          {
            name: store.name,
            keyPath: cdpKeyPathToValue(store.keyPath),
            autoIncrement: store.autoIncrement,
            indexes: store.indexes.map((index) => ({
              name: index.name,
              keyPath: cdpKeyPathToValue(index.keyPath) ?? "",
              unique: index.unique,
              multiEntry: index.multiEntry,
            })),
          },
          storeIndex === 0,
        ),
      );
      let after: unknown = undefined;
      let records = 0;
      for (;;) {
        throwIfAborted(options.signal);
        const chunk = await exportStoreChunk(client, {
          origin,
          database: databaseName,
          store: store.name,
          after,
        });
        if (chunk.records.length) {
          const text = chunk.records.map((record) => JSON.stringify(record)).join(",");
          await file.write(records === 0 ? text : `,${text}`);
        }
        records += chunk.records.length;
        for (const entry of chunk.lossy) lossy.push(`${store.name} · ${entry}`);
        options.onProgress?.({
          phase: "export",
          store: store.name,
          storeIndex,
          storeCount: db.objectStores.length,
          records,
          bytes: file.bytes,
          totalBytes: null,
        });
        if (chunk.next === null) break;
        after = chunk.next;
      }
      total += records;
      await file.write("]}");
    }
    await file.write(footer(lossy));
    return { records: total, lossy };
  });
  return { bytes, ...result };
}

/** Writes an opened export to `path` again, store by store, without pretty-printing. */
export async function writeExportCopy(
  data: IdbExportedDatabase,
  path: string,
  options: IdbTransferOptions = {},
): Promise<number> {
  const { bytes } = await streamTo(path, async (file) => {
    const head = header(data.origin, data.database.name, data.database.version);
    await file.write(
      data.version === 1
        ? head.replace('"version":2,"encoding":"capubridge-markers-v1"', '"version":1')
        : head,
    );
    for (const [storeIndex, store] of data.database.stores.entries()) {
      throwIfAborted(options.signal);
      await file.write(storeHead(store, storeIndex === 0));
      for (const [index, record] of store.records.entries()) {
        await file.write(index === 0 ? JSON.stringify(record) : `,${JSON.stringify(record)}`);
      }
      await file.write("]}");
    }
    await file.write(footer(data.lossy ?? []));
  });
  return bytes;
}

export interface PickedIdbExport {
  path: string;
  data: IdbExportedDatabase;
  /** Size of the file on disk. */
  bytes: number;
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

/** Asks for an export file and reads it (raw bytes, no base64 on the way). */
export async function pickIdbExport(): Promise<PickedIdbExport | null> {
  const picked = await open({ multiple: false, directory: false, filters: [FILE_FILTER] });
  if (!picked || Array.isArray(picked)) return null;
  const buffer = await invokeCommand("read_local_file_bytes", { path: picked });
  const data = parseIdbExport(new TextDecoder("utf-8").decode(buffer));
  return { path: picked, data, bytes: buffer.byteLength, lossy: exportLoss(data) };
}
