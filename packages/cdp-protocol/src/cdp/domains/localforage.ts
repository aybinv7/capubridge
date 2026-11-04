import {
  assertNoDeviceError,
  DeviceEvaluationError,
  evaluateChecked,
  jsLiteral,
} from "../evaluate.js";
import type { CDPClient } from "../client.js";

export interface LocalForageEntry {
  key: string;
  value: string;
}

export class LocalForageDomain {
  constructor(private client: CDPClient) {}

  private async evalExpression(expression: string): Promise<unknown> {
    const result = await evaluateChecked(this.client, {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return (result.result as Record<string, unknown>).value;
  }

  async getOrigins(): Promise<string[]> {
    const value = (await this.evalExpression(`
      (async () => {
        try {
          const dbs = await indexedDB.databases();
          const origins = new Set();
          for (const db of dbs) {
            if (db.name === 'localforage') {
              origins.add(location.origin);
            }
          }
          return JSON.stringify([...origins]);
        } catch (e) {
          return JSON.stringify([]);
        }
      })()
    `)) as string;
    return JSON.parse(value as string) as string[];
  }

  async getEntries(_origin: string): Promise<LocalForageEntry[]> {
    const value = (await this.evalExpression(`
      (async () => {
        try {
          function safeSerialize(val) {
            if (val === undefined) return undefined;
            if (val === null) return null;
            if (val instanceof Date) return { __type: 'Date', value: val.toISOString() };
            if (val instanceof Blob) return { __type: 'Blob', size: val.size, type: val.type };
            if (typeof val === 'bigint') return { __type: 'BigInt', value: val.toString() };
            if (val instanceof ArrayBuffer) return { __type: 'ArrayBuffer', byteLength: val.byteLength };
            if (val instanceof Uint8Array) return { __type: 'Uint8Array', data: Array.from(val) };
            if (val instanceof Set) return { __type: 'Set', values: Array.from(val) };
            if (val instanceof Map) return { __type: 'Map', entries: Array.from(val.entries()) };
            return val;
          }

          // Try localforage API first
          if (typeof localforage !== 'undefined') {
            const lfDriver = localforage.createInstance({
              name: 'localforage',
              storeName: 'keyvaluepairs'
            });
            const keys = await lfDriver.keys();
            const entries = await Promise.all(
              keys.map(async (k) => ({
                key: k,
                value: JSON.stringify(safeSerialize(await lfDriver.getItem(k)))
              }))
            );
            return JSON.stringify(entries);
          }

          // Fallback: raw IndexedDB
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('localforage');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          const tx = db.transaction('keyvaluepairs', 'readonly');
          const store = tx.objectStore('keyvaluepairs');

          const [allKeys, allValues] = await Promise.all([
            new Promise((resolve, reject) => {
              const req = store.getAllKeys();
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            }),
            new Promise((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            })
          ]);

          db.close();

          const entries = [];
          for (let i = 0; i < allKeys.length; i++) {
            entries.push({
              key: allKeys[i],
              value: JSON.stringify(safeSerialize(allValues[i]))
            });
          }
          return JSON.stringify(entries);
        } catch (e) {
          return JSON.stringify({ error: e.message });
        }
      })()
    `)) as string;

    const parsed = JSON.parse(value as string);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return parsed as LocalForageEntry[];
  }

  /**
   * Writes one entry. `value` is JSON text (objects, numbers, booleans keep their type);
   * text that is not valid JSON is stored as a plain string. Never evaluated as code.
   */
  async setItem(_origin: string, key: string, value: string): Promise<void> {
    await this.mutate("set", key, value);
  }

  async deleteItem(_origin: string, key: string): Promise<void> {
    await this.mutate("delete", key, null);
  }

  private async mutate(op: "set" | "delete", key: string, raw: string | null): Promise<void> {
    const outcome = await this.evalExpression(`
      (async () => {
        const { op, key, raw } = ${jsLiteral({ op, key, raw })};
        try {
          let value = null;
          if (op === "set") {
            try { value = JSON.parse(raw); } catch { value = raw; }
          }
          if (typeof localforage !== "undefined") {
            const lfDriver = localforage.createInstance({ name: "localforage", storeName: "keyvaluepairs" });
            if (op === "set") await lfDriver.setItem(key, value);
            else await lfDriver.removeItem(key);
            return JSON.stringify({ ok: true });
          }
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open("localforage");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          try {
            const tx = db.transaction("keyvaluepairs", "readwrite");
            const store = tx.objectStore("keyvaluepairs");
            if (op === "set") store.put(value, key);
            else store.delete(key);
            await new Promise((resolve, reject) => {
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
              tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
            });
          } finally {
            db.close();
          }
          return JSON.stringify({ ok: true });
        } catch (e) {
          return JSON.stringify({ error: e && e.message ? e.message : String(e) });
        }
      })()
    `);
    if (typeof outcome !== "string") {
      throw new DeviceEvaluationError("LocalForage write returned no result");
    }
    assertNoDeviceError(JSON.parse(outcome));
  }
}
