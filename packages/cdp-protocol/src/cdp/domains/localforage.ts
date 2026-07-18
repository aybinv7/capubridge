import type { CDPClient } from "../client.js";

export interface LocalForageEntry {
  key: string;
  value: string;
}

export class LocalForageDomain {
  constructor(private client: CDPClient) {}

  private async evalExpression(expression: string): Promise<unknown> {
    const result = await this.client.send<{ result: { result: unknown } }>("Runtime.evaluate", {
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

  async setItem(origin: string, key: string, value: string): Promise<void> {
    await this.evalExpression(`
      (async () => {
        try {
          const value = ${value};
          
          // Try localforage API first
          if (typeof localforage !== 'undefined') {
            const lfDriver = localforage.createInstance({
              name: 'localforage',
              storeName: 'keyvaluepairs'
            });
            await lfDriver.setItem('${key.replace(/'/g, "\\'")}', value);
            return JSON.stringify({ ok: true });
          }

          // Fallback: raw IndexedDB
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('localforage');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          const tx = db.transaction('keyvaluepairs', 'readwrite');
          const store = tx.objectStore('keyvaluepairs');
          store.put(value, '${key.replace(/'/g, "\\'")}');
          await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          db.close();
          return JSON.stringify({ ok: true });
        } catch (e) {
          return JSON.stringify({ error: e.message });
        }
      })()
    `);
  }

  async deleteItem(origin: string, key: string): Promise<void> {
    await this.evalExpression(`
      (async () => {
        try {
          // Try localforage API first
          if (typeof localforage !== 'undefined') {
            const lfDriver = localforage.createInstance({
              name: 'localforage',
              storeName: 'keyvaluepairs'
            });
            await lfDriver.removeItem('${key.replace(/'/g, "\\'")}');
            return JSON.stringify({ ok: true });
          }

          // Fallback: raw IndexedDB
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('localforage');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          const tx = db.transaction('keyvaluepairs', 'readwrite');
          const store = tx.objectStore('keyvaluepairs');
          store.delete('${key.replace(/'/g, "\\'")}');
          await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          db.close();
          return JSON.stringify({ ok: true });
        } catch (e) {
          return JSON.stringify({ error: e.message });
        }
      })()
    `);
  }
}
