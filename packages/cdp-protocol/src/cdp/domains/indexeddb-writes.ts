import { evaluateChecked, jsLiteral } from "../evaluate.js";
import type { CDPClient } from "../client.js";
import { IDB_DEVICE_CODEC_SOURCE } from "./indexeddb-codec.js";
import { parseDeviceReply } from "./indexeddb-records.js";

function originGuard(origin: string): string {
  return `if (location.origin !== ${jsLiteral(origin)}) throw new Error('IndexedDB origin mismatch');`;
}

async function runWrite(client: CDPClient, body: string): Promise<void> {
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        ${body}
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

/** Writes a whole record. The key (markers revived) moves the record when an inline key changed. */
export function putRecordOnDevice(
  client: CDPClient,
  origin: string,
  databaseName: string,
  objectStoreName: string,
  value: unknown,
  primaryKey?: unknown,
): Promise<void> {
  return runWrite(
    client,
    `${originGuard(origin)}
    const db = await __cbRequest(indexedDB.open(${jsLiteral(databaseName)}));
    try {
      const tx = db.transaction(${jsLiteral(objectStoreName)}, 'readwrite');
      const store = tx.objectStore(${jsLiteral(objectStoreName)});
      const key = ${primaryKey === undefined ? "undefined" : `__cbRevive(${jsLiteral(primaryKey)}, false)`};
      const value = ${jsLiteral(value)};
      const readPath = (source, path) => path.split('.').reduce((node, part) => (node == null ? undefined : node[part]), source);
      const inlineKey = (path) => Array.isArray(path) ? path.map((part) => readPath(value, part)) : readPath(value, path);
      const done = __cbTxDone(tx);
      try {
        if (store.keyPath === null) {
          if (key === undefined) throw new Error('Out-of-line key required');
          store.put(value, key);
        } else {
          const nextKey = inlineKey(store.keyPath);
          const missing = Array.isArray(nextKey) ? nextKey.some((part) => part === undefined) : nextKey === undefined;
          if (missing && key !== undefined) {
            throw new Error('The record must keep its key field (' + JSON.stringify(store.keyPath) + ')');
          }
          store.put(value);
          if (!missing && key !== undefined && indexedDB.cmp(nextKey, key) !== 0) store.delete(key);
        }
      } catch (error) {
        tx.abort();
        await done.catch(() => undefined);
        throw error;
      }
      await done;
    } finally {
      db.close();
    }`,
  );
}

/** Deletes one record; the key may hold markers (dates, binary), revived on the device. */
export function deleteRecordOnDevice(
  client: CDPClient,
  origin: string,
  databaseName: string,
  objectStoreName: string,
  primaryKey: unknown,
): Promise<void> {
  return runWrite(
    client,
    `${originGuard(origin)}
    const db = await __cbRequest(indexedDB.open(${jsLiteral(databaseName)}));
    try {
      const tx = db.transaction(${jsLiteral(objectStoreName)}, 'readwrite');
      const done = __cbTxDone(tx);
      tx.objectStore(${jsLiteral(objectStoreName)}).delete(__cbRevive(${jsLiteral(primaryKey)}, false));
      await done;
    } finally {
      db.close();
    }`,
  );
}

/**
 * Changes one field of a record in a single transaction, reading the record on the device so
 * every other field (dates, blobs, maps) is written back exactly as it was.
 */
export function patchRecordOnDevice(
  client: CDPClient,
  origin: string,
  databaseName: string,
  objectStoreName: string,
  primaryKey: unknown,
  path: readonly string[],
  value: unknown,
): Promise<void> {
  return runWrite(
    client,
    `${originGuard(origin)}
    const path = ${jsLiteral(path)};
    const next = ${jsLiteral(value)};
    if (path.length === 0) throw new Error('No field to change');
    const kindOf = (node) => {
      if (node === null || node === undefined || typeof node === 'string' || typeof node === 'boolean') return null;
      if (typeof node === 'number') return Number.isFinite(node) && !Object.is(node, -0) ? null : 'number JSON cannot carry';
      if (typeof node !== 'object') return typeof node;
      if (Array.isArray(node)) {
        for (const entry of node) { const inner = kindOf(entry); if (inner) return inner; }
        return null;
      }
      if (__cbIsPlain(node)) {
        for (const key of Object.keys(node)) { const inner = kindOf(node[key]); if (inner) return inner; }
        return null;
      }
      return (node.constructor && node.constructor.name) || 'Object';
    };
    const db = await __cbRequest(indexedDB.open(${jsLiteral(databaseName)}));
    try {
      const tx = db.transaction(${jsLiteral(objectStoreName)}, 'readwrite');
      const store = tx.objectStore(${jsLiteral(objectStoreName)});
      const done = __cbTxDone(tx);
      try {
        const keyPath = store.keyPath;
        if (keyPath !== null) {
          const keyPaths = Array.isArray(keyPath) ? keyPath : [keyPath];
          for (const entry of keyPaths) {
            const parts = entry === '' ? [] : entry.split('.');
            const shared = Math.min(parts.length, path.length);
            let same = true;
            for (let i = 0; i < shared; i += 1) if (parts[i] !== path[i]) same = false;
            if (same) throw new Error('Change the key in the record pane');
          }
        }
        const key = __cbRevive(${jsLiteral(primaryKey)}, false);
        const record = await __cbRequest(store.get(key));
        if (record === undefined) throw new Error('The record is no longer on the device');
        if (record === null || typeof record !== 'object' || !(Array.isArray(record) || __cbIsPlain(record))) {
          throw new Error('The record is not an object, so it has no field to change');
        }
        let node = record;
        for (let i = 0; i < path.length - 1; i += 1) {
          const part = path[i];
          if (node[part] === undefined) node[part] = {};
          const child = node[part];
          if (child === null || typeof child !== 'object' || !(Array.isArray(child) || __cbIsPlain(child))) {
            throw new Error('This field holds a ' + (kindOf(child) || typeof child) + '; edit it in the app');
          }
          node = child;
        }
        const last = path[path.length - 1];
        const current = kindOf(node[last]);
        if (current) throw new Error('This field holds a ' + current + '; edit it in the app');
        node[last] = next;
        if (keyPath === null) store.put(record, key);
        else store.put(record);
      } catch (error) {
        try { tx.abort(); } catch (ignored) { void ignored; }
        await done.catch(() => undefined);
        throw error;
      }
      await done;
    } finally {
      db.close();
    }`,
  );
}

/** Removes every record of a store. */
export function clearStoreOnDevice(
  client: CDPClient,
  databaseName: string,
  objectStoreName: string,
): Promise<void> {
  return runWrite(
    client,
    `const db = await __cbRequest(indexedDB.open(${jsLiteral(databaseName)}));
    try {
      const tx = db.transaction(${jsLiteral(objectStoreName)}, 'readwrite');
      const done = __cbTxDone(tx);
      tx.objectStore(${jsLiteral(objectStoreName)}).clear();
      await done;
    } finally {
      db.close();
    }`,
  );
}

const STORE_BLOCKED =
  "The app keeps this database open, so the store was not deleted. Nothing was changed. Close or reload the app and try again.";

const DATABASE_BLOCKED =
  "The app keeps this database open. The phone deletes it as soon as the app lets go of it (for example when the app is closed or reloaded); this request cannot be cancelled.";

/**
 * Deletes a store through a version upgrade. When the app blocks the upgrade the request is
 * cancelled: if the upgrade later starts, it is aborted, so nothing changes.
 */
export function deleteStoreOnDevice(
  client: CDPClient,
  databaseName: string,
  objectStoreName: string,
): Promise<void> {
  return runWrite(
    client,
    `const name = ${jsLiteral(databaseName)};
    const storeName = ${jsLiteral(objectStoreName)};
    const probe = await __cbOpenExisting(name);
    const version = probe.version;
    probe.close();
    await new Promise((resolve, reject) => {
      let cancelled = false;
      const req = indexedDB.open(name, version + 1);
      req.onupgradeneeded = () => {
        if (cancelled) {
          req.transaction.abort();
          return;
        }
        if (req.result.objectStoreNames.contains(storeName)) req.result.deleteObjectStore(storeName);
      };
      req.onsuccess = () => {
        req.result.close();
        resolve(true);
      };
      req.onerror = () => {
        if (!cancelled) reject(req.error && req.error.message ? req.error.message : 'upgrade failed');
      };
      req.onblocked = () => {
        cancelled = true;
        const error = new Error(${jsLiteral(STORE_BLOCKED)});
        error.blocked = true;
        reject(error);
      };
    });`,
  );
}

/** Deletes a database. When the app blocks it the delete stays queued on the phone. */
export async function deleteDatabaseOnDevice(
  client: CDPClient,
  databaseName: string,
): Promise<void> {
  const result = await evaluateChecked(client, {
    expression: `new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(${jsLiteral(databaseName)});
      req.onsuccess = () => resolve(JSON.stringify({ ok: true }));
      req.onerror = () => resolve(JSON.stringify({ error: req.error && req.error.message ? req.error.message : 'delete failed' }));
      req.onblocked = () => resolve(JSON.stringify({ error: ${jsLiteral(DATABASE_BLOCKED)}, blocked: true }));
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  parseDeviceReply<{ ok: boolean }>(result);
}
