import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { CDPClient } from "../src/cdp/client.ts";
import { IDBDomain } from "../src/cdp/domains/indexeddb.ts";

const ORIGIN = "https://app.test";

/** Runs the generated device script in this process, against fake-indexeddb, like Runtime.evaluate would. */
function deviceClient(): CDPClient {
  return {
    send: async (_method: string, params?: Record<string, unknown>) => {
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
  } as unknown as CDPClient;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function seed(
  name: string,
  setup: (db: IDBDatabase) => void,
  rows: [unknown, IDBValidKey?][],
) {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => setup(open.result);
  const db = await request(open);
  const tx = db.transaction("items", "readwrite");
  for (const [value, key] of rows) tx.objectStore("items").put(value, key);
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
}

async function readAll(name: string) {
  const db = await request(indexedDB.open(name));
  const store = db.transaction("items").objectStore("items");
  const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
  db.close();
  return { keys, values };
}

let dbName = "";
let counter = 0;

beforeEach(() => {
  Object.defineProperty(globalThis, "location", {
    value: { origin: ORIGIN },
    configurable: true,
  });
  counter += 1;
  dbName = `db-${counter}`;
});

describe("IDBDomain.putRecord on the device", () => {
  test("editing an inline key moves the record instead of duplicating it", async () => {
    await seed(dbName, (db) => db.createObjectStore("items", { keyPath: "id" }), [
      [{ id: 1, name: "a" }],
    ]);
    await new IDBDomain(deviceClient()).putRecord(ORIGIN, dbName, "items", { id: 2, name: "a" }, 1);
    expect(await readAll(dbName)).toEqual({ keys: [2], values: [{ id: 2, name: "a" }] });
  });

  test("editing a nested inline key with a dotted path moves the record", async () => {
    await seed(dbName, (db) => db.createObjectStore("items", { keyPath: "meta.id" }), [
      [{ meta: { id: "x" } }],
    ]);
    await new IDBDomain(deviceClient()).putRecord(
      ORIGIN,
      dbName,
      "items",
      { meta: { id: "y" } },
      "x",
    );
    expect((await readAll(dbName)).keys).toEqual(["y"]);
  });

  test("refuses a record that dropped its key field and leaves the store untouched", async () => {
    await seed(
      dbName,
      (db) => db.createObjectStore("items", { keyPath: "id", autoIncrement: true }),
      [[{ id: 1, name: "a" }]],
    );
    await expect(
      new IDBDomain(deviceClient()).putRecord(ORIGIN, dbName, "items", { name: "b" }, 1),
    ).rejects.toThrow("must keep its key field");
    expect((await readAll(dbName)).values).toEqual([{ id: 1, name: "a" }]);
  });

  test("updates an out-of-line record in place", async () => {
    await seed(dbName, (db) => db.createObjectStore("items"), [["old", "k"]]);
    await new IDBDomain(deviceClient()).putRecord(ORIGIN, dbName, "items", "new", "k");
    expect(await readAll(dbName)).toEqual({ keys: ["k"], values: ["new"] });
  });

  test("rejects writes aimed at another origin", async () => {
    await seed(dbName, (db) => db.createObjectStore("items"), []);
    await expect(
      new IDBDomain(deviceClient()).putRecord("https://other.test", dbName, "items", 1, "k"),
    ).rejects.toThrow("another origin");
  });
});
