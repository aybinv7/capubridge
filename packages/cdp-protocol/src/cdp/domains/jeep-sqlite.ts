import { evaluateChecked, jsLiteral } from "../evaluate.js";
import type { CDPClient } from "../client.js";

export interface JeepSqliteDatabase {
  name: string;
  key: string;
  size: number;
  idbName: string;
  storeName: string;
}

/** Bytes of a jeep-sqlite database per evaluate (base64 keeps each under 3 MB of text). */
export const JEEP_READ_CHUNK_BYTES = 2 * 1024 * 1024;

const JEEP_PAGE_HELPERS = `
  const magic = "SQLite format 3\\u0000";
  const asBytes = async (value) => {
    if (!value) return null;
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (typeof value !== "object") return null;
    const queue = [value.database, value.db, value.data, value.bytes, value.buffer, value.value, value._value, ...Object.values(value)];
    const seen = new Set();
    while (queue.length) {
      const next = queue.shift();
      if (!next || seen.has(next)) continue;
      seen.add(next);
      const bytes = await asBytes(next);
      if (bytes) return bytes;
      if (typeof next === "object") queue.push(...Object.values(next));
    }
    return null;
  };
  const hasMagic = (bytes) => {
    if (!bytes || bytes.length < magic.length) return false;
    for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic.charCodeAt(i)) return false;
    return true;
  };
  const openDb = (name) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onupgradeneeded = () => {
        req.transaction?.abort();
        reject("The database does not exist");
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error?.message ?? "open failed");
      req.onblocked = () => reject("open blocked");
    });
  const request = (req) =>
    new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error?.message ?? "request failed");
    });
`;

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export class JeepSqliteDomain {
  constructor(private client: CDPClient) {}

  async listDatabases(): Promise<JeepSqliteDatabase[]> {
    const result = await evaluateChecked(this.client, {
      expression: `
        (async () => {
          const dbNames = ["jeepSQLiteStore", "jeepSqliteStore"];
          const storeNames = ["databases"];
          const magic = "SQLite format 3\\u0000";
          const out = [];

          const asBytes = async (value) => {
            if (!value) return null;
            if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
            if (value instanceof ArrayBuffer) return new Uint8Array(value);
            if (ArrayBuffer.isView(value)) {
              return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            }
            if (typeof value !== "object") return null;
            const queue = [value.database, value.db, value.data, value.bytes, value.buffer, value.value, value._value, ...Object.values(value)];
            const seen = new Set();
            while (queue.length) {
              const next = queue.shift();
              if (!next || seen.has(next)) continue;
              seen.add(next);
              const bytes = await asBytes(next);
              if (bytes) return bytes;
              if (typeof next === "object") queue.push(...Object.values(next));
            }
            return null;
          };

          const hasMagic = (bytes) => {
            if (!bytes || bytes.length < magic.length) return false;
            for (let i = 0; i < magic.length; i++) {
              if (bytes[i] !== magic.charCodeAt(i)) return false;
            }
            return true;
          };

          const openDb = (name) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open(name);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? "open failed");
              req.onblocked = () => reject("open blocked");
            });

          const request = (req) =>
            new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? "request failed");
            });

          try {
            if (!indexedDB.databases) return JSON.stringify(out);
            const existing = new Set((await indexedDB.databases()).map((db) => db.name).filter(Boolean));
            for (const idbName of dbNames) {
              if (!existing.has(idbName)) continue;
              const db = await openDb(idbName);
              try {
                for (const storeName of storeNames) {
                  if (!db.objectStoreNames.contains(storeName)) continue;
                  const tx = db.transaction(storeName, "readonly");
                  const store = tx.objectStore(storeName);
                  const keys = await request(store.getAllKeys());
                  for (const key of keys) {
                    const value = await request(store.get(key));
                    const bytes =
                      value instanceof Blob
                        ? new Uint8Array(await value.slice(0, magic.length).arrayBuffer())
                        : await asBytes(value);
                    if (!hasMagic(bytes)) continue;
                    out.push({
                      name: String(key),
                      key: String(key),
                      size: value instanceof Blob ? value.size : bytes.byteLength,
                      idbName,
                      storeName,
                    });
                  }
                }
              } finally {
                db.close();
              }
            }
            return JSON.stringify(out);
          } catch (e) {
            return JSON.stringify({ __jeepSqliteError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__jeepSqliteError" in parsed) {
      throw new Error((parsed as { __jeepSqliteError: string }).__jeepSqliteError);
    }
    return parsed as JeepSqliteDatabase[];
  }

  async hashDatabaseBytes(params: {
    key: string;
    idbName?: string;
    storeName?: string;
  }): Promise<string | null> {
    const result = await evaluateChecked(this.client, {
      expression: `
        (async () => {
          const idbName = ${JSON.stringify(params.idbName ?? "jeepSQLiteStore")};
          const storeName = ${JSON.stringify(params.storeName ?? "databases")};
          const key = ${JSON.stringify(params.key)};

          const asBytes = async (value) => {
            if (!value) return null;
            if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
            if (value instanceof ArrayBuffer) return new Uint8Array(value);
            if (ArrayBuffer.isView(value)) {
              return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            }
            if (typeof value !== "object") return null;
            const queue = [value.database, value.db, value.data, value.bytes, value.buffer, value.value, value._value, ...Object.values(value)];
            const seen = new Set();
            while (queue.length) {
              const next = queue.shift();
              if (!next || seen.has(next)) continue;
              seen.add(next);
              const bytes = await asBytes(next);
              if (bytes) return bytes;
              if (typeof next === "object") queue.push(...Object.values(next));
            }
            return null;
          };

          const openDb = (name) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open(name);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? "open failed");
              req.onblocked = () => reject("open blocked");
            });

          const request = (req) =>
            new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error?.message ?? "request failed");
            });

          try {
            const db = await openDb(idbName);
            try {
              if (!db.objectStoreNames.contains(storeName)) return JSON.stringify({ hash: null });
              const tx = db.transaction(storeName, "readonly");
              const value = await request(tx.objectStore(storeName).get(key));
              const bytes = await asBytes(value);
              if (!bytes || bytes.byteLength === 0) return JSON.stringify({ hash: null });
              const digest = await crypto.subtle.digest('SHA-256', bytes);
              const view = new Uint8Array(digest);
              let hex = '';
              for (let i = 0; i < view.length; i++) {
                hex += view[i].toString(16).padStart(2, '0');
              }
              return JSON.stringify({ hash: hex, size: bytes.byteLength });
            } finally {
              db.close();
            }
          } catch (e) {
            return JSON.stringify({ __jeepSqliteError: e && e.message ? e.message : String(e) });
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__jeepSqliteError" in parsed) {
      throw new Error((parsed as { __jeepSqliteError: string }).__jeepSqliteError);
    }
    return (parsed as { hash: string | null }).hash;
  }

  /**
   * A jeep-sqlite database's bytes, read in chunks: the page keeps the value it found under a
   * token, then hands it over `JEEP_READ_CHUNK_BYTES` at a time (one evaluate per chunk, each far
   * under a WebSocket frame), then drops it. A single evaluate broke above about 12 MB.
   */
  async readDatabaseBytes(
    params: { key: string; idbName?: string; storeName?: string },
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<Uint8Array> {
    const token = `jeep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const staged = await this.evaluateJson<{ size: number }>(`
      (async () => {
        ${JEEP_PAGE_HELPERS}
        try {
          const db = await openDb(${jsLiteral(params.idbName ?? "jeepSQLiteStore")});
          try {
            const storeName = ${jsLiteral(params.storeName ?? "databases")};
            if (!db.objectStoreNames.contains(storeName)) throw new Error("jeep-sqlite store not found");
            const tx = db.transaction(storeName, "readonly");
            const bytes = await asBytes(await request(tx.objectStore(storeName).get(${jsLiteral(params.key)})));
            if (!hasMagic(bytes)) throw new Error("Stored jeep-sqlite value is not a SQLite database");
            const reads = (globalThis.__capubridgeJeepReads ??= {});
            reads[${jsLiteral(token)}] = bytes;
            return JSON.stringify({ size: bytes.byteLength });
          } finally {
            db.close();
          }
        } catch (e) {
          return JSON.stringify({ __jeepSqliteError: e && e.message ? e.message : String(e) });
        }
      })()
    `);
    try {
      const out = new Uint8Array(staged.size);
      for (let offset = 0; offset < staged.size; offset += JEEP_READ_CHUNK_BYTES) {
        const length = Math.min(JEEP_READ_CHUNK_BYTES, staged.size - offset);
        const chunk = await this.evaluateJson<{ base64: string }>(`
          (() => {
            const bytes = globalThis.__capubridgeJeepReads?.[${jsLiteral(token)}];
            if (!bytes) return JSON.stringify({ __jeepSqliteError: "The read was dropped by the page" });
            const part = bytes.subarray(${offset}, ${offset + length});
            let binary = "";
            for (let i = 0; i < part.length; i += 32768) {
              binary += String.fromCharCode.apply(null, part.subarray(i, Math.min(i + 32768, part.length)));
            }
            return JSON.stringify({ base64: btoa(binary) });
          })()
        `);
        out.set(bytesFromBase64(chunk.base64), offset);
        onProgress?.(offset + length, staged.size);
      }
      return out;
    } finally {
      await this.client
        .send("Runtime.evaluate", {
          expression: `delete globalThis.__capubridgeJeepReads?.[${jsLiteral(token)}]`,
          returnByValue: true,
        })
        .catch(() => undefined);
    }
  }

  private async evaluateJson<T>(expression: string): Promise<T> {
    const result = await evaluateChecked(this.client, {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = (result.result as Record<string, unknown>).value as string;
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "__jeepSqliteError" in parsed) {
      throw new Error((parsed as { __jeepSqliteError: string }).__jeepSqliteError);
    }
    return parsed as T;
  }
}
