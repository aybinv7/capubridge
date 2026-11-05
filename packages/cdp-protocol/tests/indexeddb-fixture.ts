import "fake-indexeddb/auto";
import type { CDPClient } from "../src/cdp/client.ts";

export const ORIGIN = "https://app.test";

/** Runs each device script in this process against fake-indexeddb, as Runtime.evaluate would. */
export function deviceClient(): CDPClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    send: async (method: string, params?: Record<string, unknown>) => {
      calls.push(method);
      const expression = typeof params?.expression === "string" ? params.expression : "";
      try {
        const value: unknown = await (0, eval)(expression);
        return { result: { type: typeof value, value } };
      } catch (error) {
        return {
          result: { type: "object" },
          exceptionDetails: { text: "Uncaught", exception: { description: String(error) } },
        };
      }
    },
  } as unknown as CDPClient & { calls: string[] };
}

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Creates `name` with one store `items` and the given rows (`[value, key?]`). */
export async function seed(
  name: string,
  options: IDBObjectStoreParameters,
  rows: [unknown, IDBValidKey?][],
): Promise<void> {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => open.result.createObjectStore("items", options);
  const db = await request(open);
  const tx = db.transaction("items", "readwrite");
  for (const [value, key] of rows) tx.objectStore("items").put(value, key);
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
}

export async function readAll(name: string, store = "items") {
  const db = await request(indexedDB.open(name));
  const objectStore = db.transaction(store).objectStore(store);
  const [keys, values] = await Promise.all([
    request(objectStore.getAllKeys()),
    request(objectStore.getAll()),
  ]);
  db.close();
  return { keys, values };
}

let counter = 0;

/** A fresh database name per test, with `location.origin` set for the device scripts. */
export function freshDatabase(prefix = "db"): string {
  Object.defineProperty(globalThis, "location", {
    value: { origin: ORIGIN },
    configurable: true,
  });
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
