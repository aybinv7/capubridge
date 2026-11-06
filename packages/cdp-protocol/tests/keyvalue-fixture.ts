import "fake-indexeddb/auto";
import type { CDPClient } from "../src/cdp/client.ts";

export const PAGE = "https://app.test";
export const FRAME = "https://frame.test";

/** An in-memory `Storage`; `quotaBytes` makes `setItem` throw like a full phone. */
export class FakeStorage {
  private items = new Map<string, string>();
  quotaBytes = Infinity;

  constructor(seed: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(seed)) this.items.set(key, value);
  }

  get length(): number {
    return this.items.size;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    let used = 0;
    for (const [entryKey, entryValue] of this.items) {
      if (entryKey !== key) used += entryKey.length + entryValue.length;
    }
    if (used + key.length + value.length > this.quotaBytes) {
      const error = new Error("The quota has been exceeded.");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.items.set(key, String(value));
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  entries(): [string, string][] {
    return [...this.items.entries()];
  }

  toObject(): Record<string, string> {
    return Object.fromEntries(this.items);
  }
}

export interface FakeOrigin {
  local: FakeStorage;
  session: FakeStorage;
}

export function fakeOrigin(
  local: Record<string, string> = {},
  session: Record<string, string> = {},
): FakeOrigin {
  return { local: new FakeStorage(local), session: new FakeStorage(session) };
}

function install(origin: string, storage: FakeOrigin | undefined) {
  Object.defineProperty(globalThis, "location", { value: { origin }, configurable: true });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage?.local,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: storage?.session,
    configurable: true,
    writable: true,
  });
}

/**
 * A page with a main frame and child frames: device scripts run in this process with the
 * storage of the frame they were sent to (the page, or an isolated world of a frame).
 */
export function pageClient(
  origins: Record<string, FakeOrigin>,
  frames: { id: string; origin: string }[] = [{ id: "main", origin: PAGE }],
): CDPClient & { calls: string[] } {
  const calls: string[] = [];
  const contexts = new Map<number, string>();
  let nextContext = 10;
  const main = frames[0] ?? { id: "main", origin: PAGE };
  install(main.origin, origins[main.origin]);
  return {
    calls,
    send: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push(method);
      if (method === "DOMStorage.enable") return {};
      if (method === "Page.getFrameTree") {
        return {
          frameTree: {
            frame: { id: main.id, securityOrigin: main.origin },
            childFrames: frames.slice(1).map((frame) => ({
              frame: { id: frame.id, securityOrigin: frame.origin },
            })),
          },
        };
      }
      if (method === "Page.createIsolatedWorld") {
        const frame = frames.find((entry) => entry.id === params["frameId"]);
        const id = nextContext++;
        contexts.set(id, frame?.origin ?? "");
        return { executionContextId: id };
      }
      if (method === "DOMStorage.getDOMStorageItems") {
        const storageId = params["storageId"] as {
          securityOrigin: string;
          isLocalStorage: boolean;
        };
        const storage = origins[storageId.securityOrigin];
        const area = storageId.isLocalStorage ? storage?.local : storage?.session;
        return { entries: area?.entries() ?? [] };
      }
      const contextId = params["contextId"];
      const origin = typeof contextId === "number" ? (contexts.get(contextId) ?? "") : main.origin;
      install(origin, origins[origin]);
      const expression = typeof params["expression"] === "string" ? params["expression"] : "";
      try {
        const value: unknown = await (0, eval)(expression);
        return { result: { type: typeof value, value } };
      } catch (error) {
        return {
          result: { type: "object" },
          exceptionDetails: { text: "Uncaught", exception: { description: String(error) } },
        };
      } finally {
        install(main.origin, origins[main.origin]);
      }
    },
  } as unknown as CDPClient & { calls: string[] };
}

export function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** A database the way LocalForage creates it: its store plus the blob-support marker store. */
export async function seedForage(
  name: string,
  rows: [IDBValidKey, unknown][],
  options: { store?: string; detectStore?: boolean } = {},
): Promise<void> {
  const store = options.store ?? "keyvaluepairs";
  const open = indexedDB.open(name, 2);
  open.onupgradeneeded = () => {
    open.result.createObjectStore(store);
    if (options.detectStore !== false) {
      open.result.createObjectStore("local-forage-detect-blob-support");
    }
  };
  const db = await idbRequest(open);
  const tx = db.transaction(store, "readwrite");
  for (const [key, value] of rows) tx.objectStore(store).put(value, key);
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
}

export async function readForage(
  name: string,
  store = "keyvaluepairs",
): Promise<Record<string, unknown>> {
  const db = await idbRequest(indexedDB.open(name));
  const objectStore = db.transaction(store).objectStore(store);
  const [keys, values] = await Promise.all([
    idbRequest(objectStore.getAllKeys()),
    idbRequest(objectStore.getAll()),
  ]);
  db.close();
  return Object.fromEntries(
    keys.map((key, index) => [typeof key === "string" ? key : JSON.stringify(key), values[index]]),
  );
}

let counter = 0;

export function freshName(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}
