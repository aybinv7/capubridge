import type { CDPClient } from "../client.js";

export interface JeepSqliteDatabase {
  name: string;
  key: string;
  size: number;
  idbName: string;
  storeName: string;
}

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export class JeepSqliteDomain {
  constructor(private client: CDPClient) {}

  async listDatabases(): Promise<JeepSqliteDatabase[]> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
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
                    const bytes = await asBytes(value);
                    if (!hasMagic(bytes)) continue;
                    out.push({
                      name: String(key),
                      key: String(key),
                      size: bytes.byteLength,
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

  async readDatabaseBytes(params: {
    key: string;
    idbName?: string;
    storeName?: string;
  }): Promise<Uint8Array> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
      expression: `
        (async () => {
          const idbName = ${JSON.stringify(params.idbName ?? "jeepSQLiteStore")};
          const storeName = ${JSON.stringify(params.storeName ?? "databases")};
          const key = ${JSON.stringify(params.key)};
          const magic = "SQLite format 3\\u0000";

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
            const db = await openDb(idbName);
            try {
              if (!db.objectStoreNames.contains(storeName)) {
                throw new Error("jeep-sqlite store not found");
              }
              const tx = db.transaction(storeName, "readonly");
              const value = await request(tx.objectStore(storeName).get(key));
              const bytes = await asBytes(value);
              if (!hasMagic(bytes)) {
                throw new Error("Stored jeep-sqlite value is not a SQLite database");
              }
              let binary = "";
              const chunk = 32768;
              for (let i = 0; i < bytes.length; i += chunk) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
              }
              return btoa(binary);
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
    if (value.startsWith('{"__jeepSqliteError"')) {
      throw new Error((JSON.parse(value) as { __jeepSqliteError: string }).__jeepSqliteError);
    }
    return bytesFromBase64(value);
  }
}
