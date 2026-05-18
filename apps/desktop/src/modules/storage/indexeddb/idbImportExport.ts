import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import type { CDPClient } from "utils";

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

export interface IdbExportedDatabase {
  format: "capubridge-idb-export";
  version: 1;
  exportedAt: string;
  origin: string;
  database: {
    name: string;
    version: number;
    stores: IdbExportedStore[];
  };
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

function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

/**
 * Pull the entire database (schema + records for every store) by running a
 * single Runtime.evaluate against the target. Records are serialized via
 * structured-clone-then-JSON; non-cloneable values fall back to `null`.
 */
export async function exportDatabaseToJson(
  client: CDPClient,
  securityOrigin: string,
  databaseName: string,
): Promise<IdbExportedDatabase> {
  // Schema via the IDB CDP domain (more reliable than parsing from JS).
  const { databaseWithObjectStores } = await client.send<{
    databaseWithObjectStores: CdpDatabaseWithObjectStores;
  }>("IndexedDB.requestDatabase", { securityOrigin, databaseName });

  // Records via Runtime.evaluate — cursor-walks every store.
  const dbNameLit = JSON.stringify(databaseName);
  const expression = `
    (async () => {
      try {
        const openReq = indexedDB.open(${dbNameLit});
        const db = await new Promise((resolve, reject) => {
          openReq.onsuccess = () => resolve(openReq.result);
          openReq.onerror = () => reject(openReq.error?.message ?? 'open failed');
        });
        const storeNames = Array.from(db.objectStoreNames);
        const out = {};
        for (const storeName of storeNames) {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const records = await new Promise((resolve, reject) => {
            const acc = [];
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (!cursor) return resolve(acc);
              try {
                acc.push({ key: cursor.primaryKey, value: cursor.value });
              } catch (e) {
                acc.push({ key: cursor.primaryKey, value: null });
              }
              cursor.continue();
            };
            cursorReq.onerror = () => reject(cursorReq.error?.message ?? 'cursor failed');
          });
          out[storeName] = records;
        }
        db.close();
        return JSON.stringify({ ok: true, data: out });
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()
  `;
  const result = await client.send<{ result: { value: string } }>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  const raw = (result.result as Record<string, unknown>).value as string;
  const parsed = JSON.parse(raw) as {
    ok?: boolean;
    error?: string;
    data?: Record<string, Array<{ key: unknown; value: unknown }>>;
  };
  if (parsed.error) throw new Error(parsed.error);
  const records = parsed.data ?? {};

  const stores: IdbExportedStore[] = databaseWithObjectStores.objectStores.map((s) => ({
    name: s.name,
    keyPath: cdpKeyPathToValue(s.keyPath),
    autoIncrement: s.autoIncrement,
    indexes: s.indexes.map((i) => ({
      name: i.name,
      keyPath: cdpKeyPathToValue(i.keyPath) ?? "",
      unique: i.unique,
      multiEntry: i.multiEntry,
    })),
    records: records[s.name] ?? [],
  }));

  return {
    format: "capubridge-idb-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    origin: securityOrigin,
    database: {
      name: databaseWithObjectStores.name,
      version: databaseWithObjectStores.version,
      stores,
    },
  };
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
  await invoke<void>("save_base64_file", { path: dest, data: textToBase64(json) });
  return dest;
}

export interface PickedIdbExport {
  path: string;
  data: IdbExportedDatabase;
}

export async function pickIdbExport(): Promise<PickedIdbExport | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "IndexedDB JSON export", extensions: ["json"] }],
  });
  if (!picked || Array.isArray(picked)) return null;
  const base64 = await invoke<string>("read_local_file_base64", { path: picked });
  const text = new TextDecoder("utf-8").decode(base64ToBytes(base64));
  const data = JSON.parse(text) as IdbExportedDatabase;
  if (data.format !== "capubridge-idb-export") {
    throw new Error("Not a Capubridge IndexedDB export file");
  }
  return { path: picked, data };
}

/**
 * Replace-import: delete the target database, then re-create the schema and
 * insert every record. Runs entirely inside the target via Runtime.evaluate.
 */
export async function importDatabaseReplace(
  client: CDPClient,
  exported: IdbExportedDatabase,
): Promise<void> {
  const payload = JSON.stringify(exported.database);
  const expression = `
    (async () => {
      try {
        const payload = ${JSON.stringify(payload)};
        const spec = JSON.parse(payload);
        await new Promise((resolve, reject) => {
          const req = indexedDB.deleteDatabase(spec.name);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error?.message ?? 'delete failed');
          req.onblocked = () => reject('delete blocked — close any tabs holding this database');
        });
        const targetVersion = Math.max(1, spec.version | 0);
        const openReq = indexedDB.open(spec.name, targetVersion);
        const db = await new Promise((resolve, reject) => {
          openReq.onupgradeneeded = () => {
            const upgradeDb = openReq.result;
            for (const s of spec.stores) {
              const opts = {};
              if (s.keyPath !== null && s.keyPath !== undefined) opts.keyPath = s.keyPath;
              if (s.autoIncrement) opts.autoIncrement = true;
              const store = upgradeDb.createObjectStore(s.name, opts);
              for (const idx of s.indexes || []) {
                store.createIndex(idx.name, idx.keyPath, {
                  unique: !!idx.unique,
                  multiEntry: !!idx.multiEntry,
                });
              }
            }
          };
          openReq.onsuccess = () => resolve(openReq.result);
          openReq.onerror = () => reject(openReq.error?.message ?? 'open failed');
          openReq.onblocked = () => reject('open blocked — close any tabs holding this database');
        });

        let inserted = 0;
        for (const s of spec.stores) {
          const records = s.records || [];
          if (records.length === 0) continue;
          const tx = db.transaction(s.name, 'readwrite');
          const store = tx.objectStore(s.name);
          for (const rec of records) {
            if (s.keyPath === null || s.keyPath === undefined) {
              store.put(rec.value, rec.key);
            } else {
              store.put(rec.value);
            }
            inserted++;
          }
          await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error?.message ?? 'tx failed');
            tx.onabort = () => reject(tx.error?.message ?? 'tx aborted');
          });
        }
        db.close();
        return JSON.stringify({ ok: true, inserted });
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()
  `;
  const result = await client.send<{ result: { value: string } }>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  const raw = (result.result as Record<string, unknown>).value as string;
  const parsed = JSON.parse(raw) as { ok?: boolean; error?: string; inserted?: number };
  if (parsed.error) throw new Error(parsed.error);
}
