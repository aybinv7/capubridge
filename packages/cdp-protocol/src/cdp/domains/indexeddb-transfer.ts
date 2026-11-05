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
  /** One sentence per value that could not be saved in a form that restores it, naming its record. */
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

export interface ImportReplaceSchemaParams {
  /** The page origin the database belongs to; another page is refused before anything runs. */
  origin: string;
  schema: IdbSchema;
}

export interface ImportPutChunkParams {
  origin: string;
  database: string;
  store: string;
  /** Kept for older callers; the store's own key path on the phone decides how keys are written. */
  keyPath?: string | string[] | null;
  records: readonly IdbTransferRecord[];
  /** Turn markers back into real values (exports from Capubridge 2.7+); `false` writes plain JSON. */
  revive?: boolean;
  /**
   * Write `null` for values the export could not save in full. Without it such a value refuses
   * the whole chunk, so nothing is written silently in its place.
   */
  acceptLoss?: boolean;
}

export interface ImportStageBeginParams {
  origin: string;
  /** Name of the scratch database the file is written to first; it must not exist yet. */
  stage: string;
  schema: IdbSchema;
}

export interface ImportStageBinaryParams {
  origin: string;
  /** Id a marker refers to as `staged` instead of carrying `base64`. */
  id: string;
  base64: string;
}

export interface ImportCopyChunkParams {
  origin: string;
  from: string;
  to: string;
  store: string;
  /** `next` of the previous chunk (an encoded key), or `null` for the first one. */
  after: unknown;
  maxRecords?: number;
}

export interface ImportCopyChunk {
  copied: number;
  /** Encoded key to pass as `after`, or `null` when the store is copied. */
  next: unknown;
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

function originCheck(origin: string): string {
  return `__cbCheckOrigin(${jsLiteral(origin)});`;
}

async function runDevice<T>(client: CDPClient, body: string): Promise<T> {
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        ${body}
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e), blocked: Boolean(e && e.blocked) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return parseDeviceReply<T>(result);
}

/** Reads the next chunk of a store for an export, in primary-key order, losslessly encoded. */
export async function exportStoreChunk(
  client: CDPClient,
  params: ExportStoreChunkParams,
): Promise<ExportStoreChunk> {
  const maxRecords = Math.max(1, Math.floor(params.maxRecords ?? 2000));
  const maxBytes = Math.max(1, Math.floor(params.maxBytes ?? 4 * 1024 * 1024));
  return runDevice<ExportStoreChunk>(
    client,
    `const origin = ${jsLiteral(params.origin)};
    if (origin && location.origin !== origin) throw new Error('The database belongs to ' + origin + ', not to this page');
    const db = await __cbOpenExisting(${jsLiteral(params.database)});
    const codec = __cbCodec(${jsLiteral(EXPORT_CODEC)});
    const records = [];
    const lossy = [];
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
          const lost = key.lossy.concat(value.lossy);
          if (lost.length) {
            const label = 'Record ' + __cbKeyText(cursor.primaryKey) + ': ';
            for (const entry of lost) lossy.push(label + entry);
          }
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
    return JSON.stringify({ records, next, lossy });`,
  );
}

function createStoresSource(): string {
  return `const createStores = (db, stores) => {
      for (const s of stores) {
        const options = {};
        if (s.keyPath !== null && s.keyPath !== undefined) options.keyPath = s.keyPath;
        if (s.autoIncrement) options.autoIncrement = true;
        const store = db.createObjectStore(s.name, options);
        for (const index of s.indexes || []) {
          store.createIndex(index.name, index.keyPath === null ? '' : index.keyPath, { unique: Boolean(index.unique), multiEntry: Boolean(index.multiEntry) });
        }
      }
    };`;
}

/**
 * Replaces a database with an empty one built from `schema`. A version-change probe runs
 * first: when the app blocks it, the probe is aborted and `IdbBlockedError` reports that
 * nothing was changed. Only then is the database deleted and created again.
 */
export async function importReplaceSchema(
  client: CDPClient,
  params: ImportReplaceSchemaParams,
): Promise<void> {
  await runDevice<{ ok: boolean }>(
    client,
    `${originCheck(params.origin)}
    const spec = ${jsLiteral(params.schema)};
    ${createStoresSource()}
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
        req.onblocked = () => reject(new Error(${jsLiteral(DELETE_BLOCKED)}));
      });
    }
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(spec.name, Math.max(1, Math.floor(spec.version) || 1));
      req.onupgradeneeded = () => createStores(req.result, spec.stores);
      req.onsuccess = () => { req.result.close(); resolve(true); };
      req.onerror = () => reject(req.error && req.error.message ? req.error.message : 'open failed');
      req.onblocked = () => reject(new Error(${jsLiteral(DELETE_BLOCKED)}));
    });
    return JSON.stringify({ ok: true });`,
  );
}

/**
 * Creates the scratch database an import is written to before the real database is touched.
 * Writing the whole file there first proves every record can be stored (keys, unique indexes,
 * values) while the database on the phone is still intact.
 */
export async function importStageBegin(
  client: CDPClient,
  params: ImportStageBeginParams,
): Promise<void> {
  await runDevice<{ ok: boolean }>(
    client,
    `${originCheck(params.origin)}
    const name = ${jsLiteral(params.stage)};
    const spec = ${jsLiteral(params.schema)};
    ${createStoresSource()}
    const existing = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
    if (existing.some((entry) => entry.name === name)) throw new Error('The scratch database "' + name + '" already exists');
    globalThis.__cbImportBinary = {};
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => createStores(req.result, spec.stores);
      req.onsuccess = () => { req.result.close(); resolve(true); };
      req.onerror = () => reject(req.error && req.error.message ? req.error.message : 'open failed');
    });
    return JSON.stringify({ ok: true });`,
  );
}

/** Sends one piece of a large binary value ahead of the chunk whose marker refers to it. */
export async function importStageBinary(
  client: CDPClient,
  params: ImportStageBinaryParams,
): Promise<void> {
  await runDevice<{ ok: boolean }>(
    client,
    `${originCheck(params.origin)}
    const stage = globalThis.__cbImportBinary || (globalThis.__cbImportBinary = {});
    const id = ${jsLiteral(params.id)};
    (stage[id] || (stage[id] = [])).push(__cbB64ToBytes(${jsLiteral(params.base64)}));
    return JSON.stringify({ ok: true });`,
  );
}

/**
 * Writes one chunk of exported records in a single transaction, reviving every marker. The
 * records travel as JSON text, which the phone parses much faster than a script literal.
 */
export async function importPutChunk(
  client: CDPClient,
  params: ImportPutChunkParams,
): Promise<number> {
  const text = JSON.stringify(params.records);
  const reply = await runDevice<{ inserted: number }>(
    client,
    `${originCheck(params.origin)}
    const records = JSON.parse(${jsLiteral(text)});
    const revive = ${params.revive === false ? "false" : "true"};
    const lenient = ${params.acceptLoss === true ? "true" : "false"};
    const db = await __cbOpenExisting(${jsLiteral(params.database)});
    try {
      const tx = db.transaction(${jsLiteral(params.store)}, 'readwrite');
      const store = tx.objectStore(${jsLiteral(params.store)});
      const done = __cbTxDone(tx);
      try {
        for (const record of records) {
          const value = revive ? __cbRevive(record.value, lenient) : record.value;
          if (store.keyPath === null) store.put(value, revive ? __cbRevive(record.key, false) : record.key);
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
    return JSON.stringify({ inserted: records.length });`,
  );
  return reply.inserted;
}

/**
 * Copies the next records of a store from the scratch database into the real one, on the phone
 * (nothing crosses DevTools), in key order from just after `after`.
 */
export async function importCopyChunk(
  client: CDPClient,
  params: ImportCopyChunkParams,
): Promise<ImportCopyChunk> {
  const take = Math.max(1, Math.floor(params.maxRecords ?? 2000));
  return runDevice<ImportCopyChunk>(
    client,
    `${originCheck(params.origin)}
    const from = await __cbOpenExisting(${jsLiteral(params.from)});
    const to = await __cbOpenExisting(${jsLiteral(params.to)});
    try {
      const storeName = ${jsLiteral(params.store)};
      const source = from.transaction(storeName, 'readonly').objectStore(storeName);
      const after = ${jsLiteral(params.after ?? null)};
      const range = after === null ? undefined : IDBKeyRange.lowerBound(__cbRevive(after, false), true);
      const batch = [];
      let more = false;
      await new Promise((resolve, reject) => {
        const cursorReq = source.openCursor(range);
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return resolve();
          if (batch.length >= ${take}) { more = true; return resolve(); }
          batch.push([cursor.primaryKey, cursor.value]);
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
      if (batch.length) {
        const tx = to.transaction(storeName, 'readwrite');
        const target = tx.objectStore(storeName);
        const done = __cbTxDone(tx);
        for (const [key, value] of batch) {
          if (target.keyPath === null) target.put(value, key);
          else target.put(value);
        }
        await done;
      }
      const last = batch.length ? batch[batch.length - 1][0] : null;
      const next = more && last !== null ? __cbCodec({ binaryLimit: Infinity, maxDepth: 32, maxNodes: 10000 }).encode(last).value : null;
      return JSON.stringify({ copied: batch.length, next });
    } finally {
      from.close();
      to.close();
    }`,
  );
}

/** Deletes the scratch database of an import and any binary pieces still waiting. */
export async function importStageDiscard(
  client: CDPClient,
  params: { origin: string; stage: string },
): Promise<void> {
  await runDevice<{ ok: boolean }>(
    client,
    `${originCheck(params.origin)}
    globalThis.__cbImportBinary = {};
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(${jsLiteral(params.stage)});
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error && req.error.message ? req.error.message : 'delete failed');
      req.onblocked = () => resolve(true);
    });
    return JSON.stringify({ ok: true });`,
  );
}
