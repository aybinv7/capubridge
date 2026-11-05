import { evaluateChecked, jsLiteral } from "../evaluate.js";
import type { CDPClient } from "../client.js";
import { IDB_DEVICE_CODEC_SOURCE } from "./indexeddb-codec.js";
import { parseDeviceReply } from "./indexeddb-records.js";

/** One encoded record of an export: markers carry every non-JSON value in full. */
export interface IdbTransferRecord {
  key: unknown;
  value: unknown;
}

export interface ExportStoreChunkParams {
  origin: string;
  database: string;
  store: string;
  /** Encoded primary key of the last record already exported; the chunk starts after it. */
  after?: unknown;
  maxRecords?: number;
  maxBytes?: number;
}

export interface ExportStoreChunk {
  records: IdbTransferRecord[];
  /** Encoded primary key to pass as `after` for the next chunk, or `null` when the store is done. */
  next: unknown;
  /** Sentences naming values that could not be saved in a form that restores them. */
  lossy: string[];
}

export interface IdbSchemaIndex {
  name: string;
  keyPath: string | string[] | null;
  unique: boolean;
  multiEntry: boolean;
}

export interface IdbSchemaStore {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: readonly IdbSchemaIndex[];
}

export interface IdbSchema {
  name: string;
  version: number;
  stores: readonly IdbSchemaStore[];
}

export interface ImportPutChunkParams {
  database: string;
  store: string;
  keyPath: string | string[] | null;
  records: readonly IdbTransferRecord[];
  /** Turn markers back into real values (exports from Capubridge 2.7+); `false` writes plain JSON. */
  revive?: boolean;
}

const EXPORT_CODEC = {
  binaryLimit: Number.MAX_SAFE_INTEGER,
  maxDepth: 256,
  maxNodes: 5_000_000,
  escape: true,
  collectBlobs: true,
};

const SCHEMA_BLOCKED =
  "The app keeps this database open, so it was not replaced. Nothing was changed. Close or reload the app and try again.";

const DELETE_BLOCKED =
  "The app opened the database again while it was being replaced. The phone deletes it once the app lets go; import again afterwards.";

/** Reads the next chunk of a store for an export, in primary-key order, losslessly encoded. */
export async function exportStoreChunk(
  client: CDPClient,
  params: ExportStoreChunkParams,
): Promise<ExportStoreChunk> {
  const maxRecords = Math.max(1, Math.floor(params.maxRecords ?? 2000));
  const maxBytes = Math.max(1, Math.floor(params.maxBytes ?? 4 * 1024 * 1024));
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        const origin = ${jsLiteral(params.origin)};
        if (origin && location.origin !== origin) throw new Error('The database belongs to ' + origin + ', not to this page');
        const db = await __cbOpenExisting(${jsLiteral(params.database)});
        const codec = __cbCodec(${jsLiteral(EXPORT_CODEC)});
        const records = [];
        const lossy = new Set();
        let next = null;
        try {
          const store = db.transaction(${jsLiteral(params.store)}, 'readonly').objectStore(${jsLiteral(params.store)});
          const after = ${jsLiteral(params.after ?? null)};
          const range = after === null ? undefined : IDBKeyRange.lowerBound(__cbRevive(after, false), true);
          let bytes = 0;
          await new Promise((resolve, reject) => {
            const cursorReq = store.openCursor(range);
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (!cursor) return resolve();
              const key = codec.encode(cursor.primaryKey);
              const value = codec.encode(cursor.value);
              for (const entry of key.lossy.concat(value.lossy)) lossy.add(entry);
              records.push({ key: key.value, value: value.value });
              bytes += (JSON.stringify(value.value) || '').length + value.binaryBytes;
              if (records.length >= ${maxRecords} || bytes >= ${maxBytes}) {
                next = key.value;
                return resolve();
              }
              cursor.continue();
            };
            cursorReq.onerror = () => reject(cursorReq.error);
          });
        } finally {
          db.close();
        }
        await codec.fill();
        return JSON.stringify({ records, next, lossy: Array.from(lossy) });
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return parseDeviceReply<ExportStoreChunk>(result);
}

/**
 * Replaces a database with an empty one built from `schema`. A version-change probe runs
 * first: when the app blocks it, the probe is aborted and `IdbBlockedError` reports that
 * nothing was changed. Only then is the database deleted and created again.
 */
export async function importReplaceSchema(client: CDPClient, schema: IdbSchema): Promise<void> {
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        const spec = ${jsLiteral(schema)};
        const blocked = (message) => { const error = new Error(message); error.blocked = true; return error; };
        const existing = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
        const current = existing.find((entry) => entry.name === spec.name);
        if (current) {
          await new Promise((resolve, reject) => {
            let cancelled = false;
            const probe = indexedDB.open(spec.name, (current.version || 1) + 1);
            probe.onupgradeneeded = () => probe.transaction.abort();
            probe.onsuccess = () => { probe.result.close(); resolve(true); };
            probe.onerror = () => { if (!cancelled) resolve(true); };
            probe.onblocked = () => { cancelled = true; reject(blocked(${jsLiteral(SCHEMA_BLOCKED)})); };
          });
          await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(spec.name);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error && req.error.message ? req.error.message : 'delete failed');
            req.onblocked = () => reject(blocked(${jsLiteral(DELETE_BLOCKED)}));
          });
        }
        await new Promise((resolve, reject) => {
          const req = indexedDB.open(spec.name, Math.max(1, Math.floor(spec.version) || 1));
          req.onupgradeneeded = () => {
            const db = req.result;
            for (const s of spec.stores) {
              const options = {};
              if (s.keyPath !== null && s.keyPath !== undefined) options.keyPath = s.keyPath;
              if (s.autoIncrement) options.autoIncrement = true;
              const store = db.createObjectStore(s.name, options);
              for (const index of s.indexes || []) {
                store.createIndex(index.name, index.keyPath === null ? '' : index.keyPath, { unique: Boolean(index.unique), multiEntry: Boolean(index.multiEntry) });
              }
            }
          };
          req.onsuccess = () => { req.result.close(); resolve(true); };
          req.onerror = () => reject(req.error && req.error.message ? req.error.message : 'open failed');
          req.onblocked = () => reject(blocked(${jsLiteral(DELETE_BLOCKED)}));
        });
        return JSON.stringify({ ok: true });
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e), blocked: Boolean(e && e.blocked) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  parseDeviceReply<{ ok: boolean }>(result);
}

/** Writes one chunk of exported records in a single transaction, reviving every marker. */
export async function importPutChunk(
  client: CDPClient,
  params: ImportPutChunkParams,
): Promise<number> {
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        const records = ${jsLiteral(params.records)};
        const keyPath = ${jsLiteral(params.keyPath)};
        const revive = ${params.revive === false ? "false" : "true"};
        const db = await __cbOpenExisting(${jsLiteral(params.database)});
        try {
          const tx = db.transaction(${jsLiteral(params.store)}, 'readwrite');
          const store = tx.objectStore(${jsLiteral(params.store)});
          const done = __cbTxDone(tx);
          try {
            for (const record of records) {
              const value = revive ? __cbRevive(record.value, true) : record.value;
              if (keyPath === null) store.put(value, revive ? __cbRevive(record.key, false) : record.key);
              else store.put(value);
            }
          } catch (error) {
            try { tx.abort(); } catch (ignored) { void ignored; }
            await done.catch(() => undefined);
            throw error;
          }
          await done;
        } finally {
          db.close();
        }
        return JSON.stringify({ inserted: records.length });
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return parseDeviceReply<{ inserted: number }>(result).inserted;
}
