import { jsLiteral } from "../evaluate.js";
import { IDB_DEVICE_CODEC_SOURCE, IDB_VIEW_LIMITS } from "./indexeddb-codec.js";

/** The object store LocalForage adds to every database it opens; it marks a LocalForage database. */
export const FORAGE_DETECT_STORE = "local-forage-detect-blob-support";

/** How many LocalForage entries one read returns at most. */
export const FORAGE_READ_LIMIT = 5000;

/**
 * How many values one short read-only transaction reads: a long read is split so the app's own
 * writes to the store are never held up for the whole read.
 */
const FORAGE_READ_BATCH = 200;

/** How long discovery waits for the databases to open before it skips those still opening. */
const FORAGE_OPEN_WAIT_MS = 2500;

/** Fields shared by every key-value write the device checks before it changes anything. */
export interface KeyValueWriteInput {
  op: "set" | "rename" | "delete";
  /** The key as stored (LocalForage keys may be encoded markers). */
  key: unknown;
  /** The new key of a rename. */
  nextKey?: string;
  value?: unknown;
  /**
   * The value the person saw, as stored text: `null` for a new key, `undefined` to skip the
   * check. The device refuses the write when what it holds now differs.
   */
  expected?: string | null;
  /** Write over a value another key already holds (the person said yes). */
  replaceExisting?: boolean;
  /** Write although the app changed or deleted the value since it was read (the person said yes). */
  overwriteChanged?: boolean;
}

const REPLY_HELPERS = String.raw`
function __kvConflict(kind, message) {
  return JSON.stringify({ error: message, conflict: kind });
}
function __kvKeyText(key) {
  return typeof key === 'string' ? '"' + key + '"' : JSON.stringify(key);
}
function __kvFailure(e) {
  if (e && e.name === 'QuotaExceededError') {
    return JSON.stringify({ error: "The phone has no room left in this page's storage; nothing was saved" });
  }
  const message = e && e.message ? e.message : String(e);
  return JSON.stringify({ error: message, wrongOrigin: /another origin/.test(message) });
}
function __kvCheck(input, current, exists, targetTaken) {
  if (targetTaken && !input.replaceExisting) {
    return __kvConflict('exists', __kvKeyText(input.op === 'rename' ? input.nextKey : input.key) + ' already has a value on the phone. Nothing was changed.');
  }
  if (input.expected === undefined || input.overwriteChanged || input.expected === null) return null;
  if (!exists) return __kvConflict('gone', __kvKeyText(input.key) + ' was deleted on the phone after it was read. Nothing was changed.');
  if (current !== input.expected) return __kvConflict('changed', __kvKeyText(input.key) + ' changed on the phone after it was read. Nothing was changed.');
  return null;
}
`;

/**
 * One Local or Session storage write, run in the frame of `origin`. Every check and the write
 * itself happen in one synchronous block, so the page cannot change the value in between: a
 * new key that exists, a rename onto a taken key, or a value the app changed since it was read
 * is refused unless the person agreed to it.
 */
export function storageWriteScript(
  origin: string,
  area: "local" | "session",
  input: KeyValueWriteInput,
): string {
  return `(() => {
    ${REPLY_HELPERS}
    const origin = ${jsLiteral(origin)};
    const input = ${jsLiteral(input)};
    try {
      if (location.origin !== origin) {
        return JSON.stringify({ error: 'This frame belongs to another origin (' + location.origin + ') than ' + origin + '; nothing was changed', wrongOrigin: true });
      }
      const area = ${area === "session" ? "sessionStorage" : "localStorage"};
      const current = area.getItem(input.key);
      const exists = current !== null;
      if (input.op === 'delete') {
        if (!exists) return JSON.stringify({ ok: true, gone: true });
        const changed = __kvCheck(input, current, exists, false);
        if (changed) return changed;
        area.removeItem(input.key);
        return JSON.stringify({ ok: true });
      }
      const moves = input.op === 'rename' && input.nextKey !== input.key;
      const target = moves ? input.nextKey : input.key;
      const targetTaken = moves ? area.getItem(target) !== null : input.expected === null && exists;
      const refused = __kvCheck(input, current, exists, targetTaken);
      if (refused) return refused;
      area.setItem(target, String(input.value));
      if (moves) area.removeItem(input.key);
      return JSON.stringify({ ok: true });
    } catch (e) {
      return __kvFailure(e);
    }
  })()`;
}

/**
 * Every key of one origin's Local or Session storage with its value as stored, read in the same
 * frame context the writes run in, so reads and writes see one storage partition.
 */
export function storageReadScript(origin: string, area: "local" | "session"): string {
  return `(() => {
    ${REPLY_HELPERS}
    const origin = ${jsLiteral(origin)};
    try {
      if (location.origin !== origin) {
        return JSON.stringify({ error: 'This frame belongs to another origin (' + location.origin + ') than ' + origin, wrongOrigin: true });
      }
      const area = ${area === "session" ? "sessionStorage" : "localStorage"};
      const entries = [];
      for (let index = 0; index < area.length; index++) {
        const key = area.key(index);
        if (key !== null) entries.push([key, area.getItem(key)]);
      }
      return JSON.stringify({ entries });
    } catch (e) {
      return __kvFailure(e);
    }
  })()`;
}

/**
 * Counts of the page's own Local and Session storage, and every LocalForage store it keeps in
 * IndexedDB: a database is LocalForage's when it holds LocalForage's blob-support store, or is
 * named `localforage`. Databases are opened in parallel, only if they exist (never created or
 * upgraded), close the moment the app upgrades them, and are closed right after; those still
 * opening when `FORAGE_OPEN_WAIT_MS` runs out are skipped and named. Databases in `skip`
 * (`name@version`, known not to be LocalForage) are not opened; `plain` names those found.
 */
export function discoveryScript(skip: readonly string[] = []): string {
  return `(async () => {
    ${IDB_DEVICE_CODEC_SOURCE}
    const out = { origin: location.origin, local: null, session: null, forage: [], forageError: null, plain: [] };
    try { out.local = localStorage.length; } catch (e) { out.local = null; }
    try { out.session = sessionStorage.length; } catch (e) { out.session = null; }
    const skip = new Set(${jsLiteral(skip)});
    const skipped = [];
    let late = false;
    let timer = 0;
    const deadline = new Promise(function (resolve) {
      timer = setTimeout(function () { late = true; resolve(null); }, ${FORAGE_OPEN_WAIT_MS});
    });
    async function look(entry) {
      const name = entry.name;
      const opening = __cbOpenExisting(name);
      opening.then(function (db) { if (late) db.close(); }, function () { return undefined; });
      const db = await Promise.race([opening.catch(function () { return undefined; }), deadline]);
      if (db === null) { skipped.push(name); return; }
      if (!db) return;
      try {
        const stores = Array.from(db.objectStoreNames);
        if (name !== 'localforage' && stores.indexOf(${jsLiteral(FORAGE_DETECT_STORE)}) === -1) {
          out.plain.push(name + '@' + db.version);
          return;
        }
        for (const store of stores) {
          if (store === ${jsLiteral(FORAGE_DETECT_STORE)}) continue;
          let count = null;
          try { count = await __cbRequest(db.transaction(store, 'readonly').objectStore(store).count()); } catch (e) { count = null; }
          out.forage.push({ database: name, store: store, count: count });
        }
      } finally {
        db.close();
      }
    }
    try {
      const entries = typeof indexedDB.databases === 'function'
        ? (await indexedDB.databases()).filter(function (entry) { return Boolean(entry.name); })
        : [{ name: 'localforage', version: undefined }];
      const looked = entries.filter(function (entry) {
        if (entry.version !== undefined && skip.has(entry.name + '@' + entry.version)) {
          out.plain.push(entry.name + '@' + entry.version);
          return false;
        }
        return true;
      });
      await Promise.all(looked.map(look));
      if (!late) clearTimeout(timer);
    } catch (e) {
      out.forageError = e && e.message ? e.message : String(e);
    }
    out.forage.sort(function (a, b) { return a.database < b.database ? -1 : a.database > b.database ? 1 : a.store < b.store ? -1 : a.store > b.store ? 1 : 0; });
    if (skipped.length && !out.forageError) {
      out.forageError = 'Busy, not looked inside: ' + skipped.join(', ');
    }
    return JSON.stringify(out);
  })()`;
}

/**
 * Reads up to `FORAGE_READ_LIMIT` entries of one LocalForage store, encoded like IndexedDB
 * records: the keys in one transaction, then the values `FORAGE_READ_BATCH` at a time in short
 * transactions. A key the app deleted in between is left out.
 */
export function forageReadScript(origin: string, database: string, store: string): string {
  return `(async () => {
    ${IDB_DEVICE_CODEC_SOURCE}
    ${REPLY_HELPERS}
    try {
      __cbCheckOrigin(${jsLiteral(origin)});
      const db = await __cbOpenExisting(${jsLiteral(database)});
      try {
        const name = ${jsLiteral(store)};
        if (!db.objectStoreNames.contains(name)) throw new Error('The store "' + name + '" is not in this database any more');
        const encode = __cbRecordEncoder(${jsLiteral(IDB_VIEW_LIMITS)});
        const listed = await __cbRequest(db.transaction(name, 'readonly').objectStore(name).getAllKeys(null, ${FORAGE_READ_LIMIT + 1}));
        const more = listed.length > ${FORAGE_READ_LIMIT};
        const keys = more ? listed.slice(0, ${FORAGE_READ_LIMIT}) : listed;
        const records = [];
        for (let start = 0; start < keys.length; start += ${FORAGE_READ_BATCH}) {
          const part = keys.slice(start, start + ${FORAGE_READ_BATCH});
          const objectStore = db.transaction(name, 'readonly').objectStore(name);
          const values = await Promise.all(part.map(function (key) { return __cbRequest(objectStore.get(key)); }));
          for (let index = 0; index < part.length; index++) {
            if (values[index] === undefined) continue;
            records.push(encode(part[index], part[index], values[index]));
          }
        }
        const total = more ? await __cbRequest(db.transaction(name, 'readonly').objectStore(name).count()) : records.length;
        return JSON.stringify({ records: records, more: more, total: total });
      } finally {
        db.close();
      }
    } catch (e) {
      return __kvFailure(e);
    }
  })()`;
}

/**
 * One LocalForage write in a single read-write transaction. The stored value is compared with
 * what the person saw through the same encoder the read used, so a value the app changed is
 * never overwritten silently; a rename onto a taken key and a new key that exists are refused
 * the same way. The database is opened only if it exists.
 */
export function forageWriteScript(
  origin: string,
  database: string,
  store: string,
  input: KeyValueWriteInput,
): string {
  return `(async () => {
    ${IDB_DEVICE_CODEC_SOURCE}
    ${REPLY_HELPERS}
    const input = ${jsLiteral(input)};
    try {
      __cbCheckOrigin(${jsLiteral(origin)});
      const db = await __cbOpenExisting(${jsLiteral(database)});
      try {
        const name = ${jsLiteral(store)};
        if (!db.objectStoreNames.contains(name)) throw new Error('The store "' + name + '" is not in this database any more; nothing was changed');
        const tx = db.transaction(name, 'readwrite');
        const objectStore = tx.objectStore(name);
        const done = __cbTxDone(tx);
        let reply = JSON.stringify({ ok: true });
        try {
          const key = __cbRevive(input.key, false);
          const exists = (await __cbRequest(objectStore.count(key))) > 0;
          const codec = __cbCodec(${jsLiteral(IDB_VIEW_LIMITS)});
          if (input.op === 'delete') {
            const checks = exists && typeof input.expected === 'string' && !input.overwriteChanged;
            const current = checks ? JSON.stringify(codec.encode(await __cbRequest(objectStore.get(key))).value) : null;
            const changed = checks ? __kvCheck(input, current, exists, false) : null;
            if (changed) reply = changed;
            else if (exists) objectStore.delete(key);
            else reply = JSON.stringify({ ok: true, gone: true });
          } else {
            const current = exists ? JSON.stringify(codec.encode(await __cbRequest(objectStore.get(key))).value) : null;
            const moves = input.op === 'rename' && input.nextKey !== input.key;
            const targetTaken = moves
              ? (await __cbRequest(objectStore.count(input.nextKey))) > 0
              : input.expected === null && exists;
            const refused = __kvCheck(input, current, exists, targetTaken);
            if (refused) {
              reply = refused;
            } else {
              const value = __cbRevive(input.value, false);
              objectStore.put(value, moves ? input.nextKey : key);
              if (moves) objectStore.delete(key);
            }
          }
        } catch (error) {
          try { tx.abort(); } catch (ignored) { void ignored; }
          await done.catch(function () { return undefined; });
          throw error;
        }
        await done;
        return reply;
      } finally {
        db.close();
      }
    } catch (e) {
      return __kvFailure(e);
    }
  })()`;
}

/** One key of a batch delete, with the stored value the person saw (as in `KeyValueWriteInput`). */
export interface KeyValueDeleteItem {
  key: unknown;
  expected?: string;
}

/** How many keys one delete script handles; a longer batch runs in several, with progress. */
export const KEYVALUE_DELETE_BATCH = 500;

/**
 * Deletes keys of one origin's Local or Session storage in one synchronous block: a key whose
 * value is not what the person saw is kept (its index in `changed`) unless `force`, one already
 * gone is named in `gone`.
 */
export function storageDeleteScript(
  origin: string,
  area: "local" | "session",
  items: readonly KeyValueDeleteItem[],
  force: boolean,
): string {
  return `(() => {
    ${REPLY_HELPERS}
    const origin = ${jsLiteral(origin)};
    const items = ${jsLiteral(items)};
    const force = ${jsLiteral(force)};
    try {
      if (location.origin !== origin) {
        return JSON.stringify({ error: 'This frame belongs to another origin (' + location.origin + ') than ' + origin + '; nothing was changed', wrongOrigin: true });
      }
      const area = ${area === "session" ? "sessionStorage" : "localStorage"};
      const out = { deleted: [], gone: [], changed: [] };
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const current = area.getItem(item.key);
        if (current === null) { out.gone.push(index); continue; }
        if (!force && typeof item.expected === 'string' && current !== item.expected) { out.changed.push(index); continue; }
        area.removeItem(item.key);
        out.deleted.push(index);
      }
      return JSON.stringify(out);
    } catch (e) {
      return __kvFailure(e);
    }
  })()`;
}

/**
 * Deletes keys of one LocalForage store in one read-write transaction, comparing each stored
 * value with what the person saw through the encoder the read used (see `storageDeleteScript`).
 */
export function forageDeleteScript(
  origin: string,
  database: string,
  store: string,
  items: readonly KeyValueDeleteItem[],
  force: boolean,
): string {
  return `(async () => {
    ${IDB_DEVICE_CODEC_SOURCE}
    ${REPLY_HELPERS}
    const items = ${jsLiteral(items)};
    const force = ${jsLiteral(force)};
    try {
      __cbCheckOrigin(${jsLiteral(origin)});
      const db = await __cbOpenExisting(${jsLiteral(database)});
      try {
        const name = ${jsLiteral(store)};
        if (!db.objectStoreNames.contains(name)) throw new Error('The store "' + name + '" is not in this database any more; nothing was changed');
        const tx = db.transaction(name, 'readwrite');
        const objectStore = tx.objectStore(name);
        const done = __cbTxDone(tx);
        const codec = __cbCodec(${jsLiteral(IDB_VIEW_LIMITS)});
        const out = { deleted: [], gone: [], changed: [] };
        try {
          for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const key = __cbRevive(item.key, false);
            if ((await __cbRequest(objectStore.count(key))) === 0) { out.gone.push(index); continue; }
            if (!force && typeof item.expected === 'string') {
              const current = JSON.stringify(codec.encode(await __cbRequest(objectStore.get(key))).value);
              if (current !== item.expected) { out.changed.push(index); continue; }
            }
            objectStore.delete(key);
            out.deleted.push(index);
          }
        } catch (error) {
          try { tx.abort(); } catch (ignored) { void ignored; }
          await done.catch(function () { return undefined; });
          throw error;
        }
        await done;
        return JSON.stringify(out);
      } finally {
        db.close();
      }
    } catch (e) {
      return __kvFailure(e);
    }
  })()`;
}
