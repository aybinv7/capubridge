import { evaluateChecked, jsLiteral } from "../evaluate.js";
import type { CDPClient } from "../client.js";
import { IDB_DEVICE_CODEC_SOURCE, IDB_VIEW_LIMITS } from "./indexeddb-codec.js";
import {
  parseDeviceReply,
  toRecord,
  type EncodedRecord,
  type IDBRecord,
} from "./indexeddb-records.js";

export interface GetDataParams {
  securityOrigin: string;
  databaseName: string;
  objectStoreName: string;
  indexName?: string;
  skipCount: number;
  pageSize: number;
  /** `{ lower?, upper?, lowerOpen?, upperOpen? }`; bounds may hold key markers. */
  keyRange?: unknown;
}

export interface GetDataResult {
  records: IDBRecord[];
  hasMore: boolean;
}

export interface SearchStoreParams {
  securityOrigin: string;
  databaseName: string;
  objectStoreName: string;
  needle: string;
  limit?: number;
  maxScan?: number;
  maxMs?: number;
  /** Lets `cancelStoreSearch` stop this search between two short transactions. */
  token?: string;
}

export interface SearchStoreResult {
  records: IDBRecord[];
  scanned: number;
  capped: "count" | "time" | "limit" | "cancelled" | null;
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

interface CallFunctionResponse {
  result?: { value?: unknown };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

const PROTOCOL_PAGE_LIMIT = 10_000;

function originGuard(origin: string): string {
  return `const __origin = ${jsLiteral(origin)};
      if (__origin && location.origin !== __origin) {
        return JSON.stringify({ error: 'The database belongs to ' + __origin + ', not to this page', wrongOrigin: true });
      }`;
}

function limitsLiteral(): string {
  return jsLiteral(IDB_VIEW_LIMITS);
}

function primitiveRemote(obj: CdpRemoteObject): unknown {
  const special = obj.unserializableValue;
  if (special !== undefined) {
    if (special.endsWith("n")) return { __type: "BigInt", value: special.slice(0, -1) };
    return { __type: "Number", value: special };
  }
  if (obj.type === "undefined") return { __type: "Undefined" };
  return obj.value;
}

function primitiveIssue(encoded: unknown): { type: string; path: string } | null {
  if (encoded && typeof encoded === "object" && "__type" in encoded) {
    return { type: String((encoded as { __type: unknown }).__type), path: "" };
  }
  return null;
}

/** One evaluate: open, walk the cursor from `skipCount`, encode every record for display. */
export async function readPageByEval(
  client: CDPClient,
  params: GetDataParams,
): Promise<GetDataResult> {
  const take = Math.max(1, Math.min(PROTOCOL_PAGE_LIMIT, Math.floor(params.pageSize)));
  const skip = Math.max(0, Math.floor(params.skipCount));
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        ${originGuard(params.securityOrigin)}
        const db = await __cbOpenExisting(${jsLiteral(params.databaseName)});
        try {
          const store = db.transaction(${jsLiteral(params.objectStoreName)}, 'readonly').objectStore(${jsLiteral(params.objectStoreName)});
          const indexName = ${jsLiteral(params.indexName ?? "")};
          const source = indexName ? store.index(indexName) : store;
          const encodeRecord = __cbRecordEncoder(${limitsLiteral()});
          const records = [];
          const skip = ${skip};
          const take = ${take};
          let skipped = skip === 0;
          let hasMore = false;
          await new Promise((resolve, reject) => {
            const cursorReq = source.openCursor(__cbRange(${jsLiteral(params.keyRange ?? null)}));
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (!cursor) return resolve();
              if (!skipped) {
                skipped = true;
                cursor.advance(skip);
                return;
              }
              if (records.length >= take) {
                hasMore = true;
                return resolve();
              }
              records.push(encodeRecord(cursor.key, cursor.primaryKey, cursor.value));
              cursor.continue();
            };
            cursorReq.onerror = () => reject(cursorReq.error);
          });
          return JSON.stringify({ records, hasMore });
        } finally {
          db.close();
        }
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const parsed = parseDeviceReply<{ records: EncodedRecord[]; hasMore: boolean }>(result);
  return { records: parsed.records.map(toRecord), hasMore: parsed.hasMore };
}

function callArgument(obj: CdpRemoteObject): Record<string, unknown> {
  if (obj.objectId) return { objectId: obj.objectId };
  if (obj.unserializableValue !== undefined)
    return { unserializableValue: obj.unserializableValue };
  return { value: obj.value };
}

/**
 * `IndexedDB.requestData` with one batched `Runtime.callFunctionOn` that encodes every key,
 * primary key and value at once; remote objects are released without waiting.
 */
export async function readPageByProtocol(
  client: CDPClient,
  params: GetDataParams,
): Promise<GetDataResult> {
  await client.send("IndexedDB.enable");
  const response = await client.send<{ objectStoreDataEntries: CdpDataEntry[]; hasMore: boolean }>(
    "IndexedDB.requestData",
    {
      securityOrigin: params.securityOrigin,
      databaseName: params.databaseName,
      objectStoreName: params.objectStoreName,
      indexName: params.indexName ?? "",
      skipCount: params.skipCount,
      pageSize: params.pageSize,
      ...(params.keyRange ? { keyRange: params.keyRange } : {}),
    },
  );
  const entries = response.objectStoreDataEntries;
  if (entries.length === 0) return { records: [], hasMore: response.hasMore };
  const remotes = entries.flatMap((entry) => [entry.key, entry.primaryKey, entry.value]);
  const objectIds = remotes.flatMap((remote) => (remote.objectId ? [remote.objectId] : []));
  const thisId = objectIds[0];
  if (!thisId) {
    const records = entries.map((entry) => {
      const [k, p, v] = [entry.key, entry.primaryKey, entry.value].map(primitiveRemote);
      return toRecord({
        k,
        p,
        v,
        ik: primitiveIssue(k),
        ip: primitiveIssue(p),
        iv: primitiveIssue(v),
      });
    });
    return { records, hasMore: response.hasMore };
  }
  try {
    const call = await client.send<CallFunctionResponse>("Runtime.callFunctionOn", {
      objectId: thisId,
      functionDeclaration: `function () {
        ${IDB_DEVICE_CODEC_SOURCE}
        const encodeRecord = __cbRecordEncoder(${limitsLiteral()});
        const out = [];
        for (let i = 0; i < arguments.length; i += 3) {
          out.push(encodeRecord(arguments[i], arguments[i + 1], arguments[i + 2]));
        }
        return JSON.stringify(out);
      }`,
      arguments: remotes.map(callArgument),
      returnByValue: true,
    });
    if (call.exceptionDetails) {
      throw new Error(call.exceptionDetails.exception?.description ?? call.exceptionDetails.text);
    }
    const raw = call.result?.value;
    if (typeof raw !== "string") throw new Error("The device sent no records");
    const encoded = JSON.parse(raw) as EncodedRecord[];
    return { records: encoded.map(toRecord), hasMore: response.hasMore };
  } finally {
    for (const objectId of objectIds) {
      void client.send("Runtime.releaseObject", { objectId }).catch(() => undefined);
    }
  }
}

/** One record by primary key (markers revived on the device), or `null` when it is gone. */
export async function readRecord(
  client: CDPClient,
  origin: string,
  databaseName: string,
  objectStoreName: string,
  primaryKey: unknown,
): Promise<IDBRecord | null> {
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        ${originGuard(origin)}
        const db = await __cbOpenExisting(${jsLiteral(databaseName)});
        try {
          const store = db.transaction(${jsLiteral(objectStoreName)}, 'readonly').objectStore(${jsLiteral(objectStoreName)});
          const key = __cbRevive(${jsLiteral(primaryKey)}, false);
          const value = await __cbRequest(store.get(key));
          if (value === undefined) return JSON.stringify({ record: null });
          const encodeRecord = __cbRecordEncoder(${limitsLiteral()});
          return JSON.stringify({ record: encodeRecord(key, key, value) });
        } finally {
          db.close();
        }
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const parsed = parseDeviceReply<{ record: EncodedRecord | null }>(result);
  return parsed.record ? toRecord(parsed.record) : null;
}

/**
 * Bounded device-side scan for records whose key or value text contains `needle`. It reads in
 * short transactions (200 records or 50 ms each) resumed after the last key, so the app's own
 * writes are never held up long, and it stops between two of them once cancelled.
 */
export async function searchStoreOnDevice(
  client: CDPClient,
  params: SearchStoreParams,
): Promise<SearchStoreResult> {
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        ${originGuard(params.securityOrigin)}
        const db = await __cbOpenExisting(${jsLiteral(params.databaseName)});
        try {
          const storeName = ${jsLiteral(params.objectStoreName)};
          const token = ${jsLiteral(params.token ?? "")};
          const cancels = globalThis.__cbSearchCancel || (globalThis.__cbSearchCancel = {});
          const needle = ${jsLiteral(params.needle.toLowerCase())};
          const limit = ${Math.max(1, Math.floor(params.limit ?? 500))};
          const maxScan = ${Math.max(1, Math.floor(params.maxScan ?? 50_000))};
          const maxMs = ${Math.max(1, Math.floor(params.maxMs ?? 4_000))};
          const probe = __cbCodec({ binaryLimit: 0, maxDepth: 12, maxNodes: 20000 });
          const encodeRecord = __cbRecordEncoder(${limitsLiteral()});
          const started = Date.now();
          const records = [];
          let scanned = 0;
          let capped = null;
          let done = false;
          let after;
          let resumed = false;
          try {
            while (!done) {
              if (token && cancels[token]) { capped = 'cancelled'; break; }
              const store = db.transaction(storeName, 'readonly').objectStore(storeName);
              const range = resumed ? IDBKeyRange.lowerBound(after, true) : undefined;
              const batchStarted = Date.now();
              let inBatch = 0;
              await new Promise((resolve, reject) => {
                const cursorReq = store.openCursor(range);
                cursorReq.onsuccess = () => {
                  const cursor = cursorReq.result;
                  if (!cursor) { done = true; return resolve(); }
                  if (records.length >= limit) { capped = 'limit'; done = true; return resolve(); }
                  if (scanned >= maxScan) { capped = 'count'; done = true; return resolve(); }
                  if (Date.now() - started > maxMs) { capped = 'time'; done = true; return resolve(); }
                  scanned += 1;
                  inBatch += 1;
                  const text = (JSON.stringify(probe.encode(cursor.primaryKey).value) + ' ' + JSON.stringify(probe.encode(cursor.value).value)).toLowerCase();
                  if (text.indexOf(needle) !== -1) records.push(encodeRecord(cursor.primaryKey, cursor.primaryKey, cursor.value));
                  after = cursor.primaryKey;
                  resumed = true;
                  if (inBatch >= 200 || Date.now() - batchStarted > 50) return resolve();
                  cursor.continue();
                };
                cursorReq.onerror = () => reject(cursorReq.error);
              });
            }
          } finally {
            if (token) delete cancels[token];
          }
          return JSON.stringify({ records, scanned, capped });
        } finally {
          db.close();
        }
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const parsed = parseDeviceReply<{
    records: EncodedRecord[];
    scanned: number;
    capped: SearchStoreResult["capped"];
  }>(result);
  return { records: parsed.records.map(toRecord), scanned: parsed.scanned, capped: parsed.capped };
}

/** Stops the search started with `token` before its next short transaction. */
export async function cancelStoreSearch(client: CDPClient, token: string): Promise<void> {
  await evaluateChecked(client, {
    expression: `((globalThis.__cbSearchCancel || (globalThis.__cbSearchCancel = {}))[${jsLiteral(token)}] = true, true)`,
    returnByValue: true,
  });
}

/**
 * Size sample per store: encoded length of the first `sampleSize` records plus their binary
 * bytes, read in one evaluate for every store of the database.
 */
export async function sampleStoreSizes(
  client: CDPClient,
  databaseName: string,
  storeNames: readonly string[],
  sampleSize = 12,
): Promise<Record<string, { bytes: number; count: number }>> {
  const result = await evaluateChecked(client, {
    expression: `(async () => {
      ${IDB_DEVICE_CODEC_SOURCE}
      try {
        const db = await __cbOpenExisting(${jsLiteral(databaseName)});
        try {
          const codec = __cbCodec({ binaryLimit: 0, maxDepth: 12, maxNodes: 20000 });
          const out = {};
          for (const name of ${jsLiteral(storeNames)}) {
            if (!db.objectStoreNames.contains(name)) continue;
            const store = db.transaction(name, 'readonly').objectStore(name);
            out[name] = await new Promise((resolve, reject) => {
              let bytes = 0;
              let count = 0;
              const cursorReq = store.openCursor();
              cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (!cursor || count >= ${Math.max(1, Math.floor(sampleSize))}) return resolve({ bytes, count });
                const key = codec.encode(cursor.primaryKey);
                const value = codec.encode(cursor.value);
                bytes += (JSON.stringify(key.value) || '').length + (JSON.stringify(value.value) || '').length + key.binaryBytes + value.binaryBytes;
                count += 1;
                cursor.continue();
              };
              cursorReq.onerror = () => reject(cursorReq.error);
            });
          }
          return JSON.stringify({ sizes: out });
        } finally {
          db.close();
        }
      } catch (e) {
        return JSON.stringify({ error: String(e && e.message ? e.message : e) });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return parseDeviceReply<{ sizes: Record<string, { bytes: number; count: number }> }>(result)
    .sizes;
}
