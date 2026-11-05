import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { IDBDomain } from "../src/cdp/domains/indexeddb.ts";
import { IdbKeyConflictError } from "../src/cdp/domains/indexeddb-records.ts";
import {
  exportStoreChunk,
  importPutChunk,
  importReplaceSchema,
} from "../src/cdp/domains/indexeddb-transfer.ts";
import {
  deviceClient,
  freshDatabase,
  ORIGIN,
  readAll,
  request,
  seed,
} from "./indexeddb-fixture.ts";

const OTHER = "https://other.test";

let dbName = "";

beforeEach(() => {
  dbName = freshDatabase("safety");
});

async function names(): Promise<string[]> {
  return (await indexedDB.databases()).map((entry) => entry.name ?? "");
}

describe("writes never create a database (S7)", () => {
  const missing = () => `${dbName}-missing`;

  test("put, patch, delete and clear on a missing database leave nothing behind", async () => {
    const domain = new IDBDomain(deviceClient());
    await expect(domain.putRecord(ORIGIN, missing(), "items", { id: 1 }, 1)).rejects.toThrow();
    await expect(domain.patchRecord(ORIGIN, missing(), "items", 1, ["a"], 2)).rejects.toThrow();
    await expect(domain.deleteRecord(ORIGIN, missing(), "items", 1)).rejects.toThrow();
    await expect(domain.clearObjectStore(ORIGIN, missing(), "items")).rejects.toThrow();
    expect(await names()).not.toContain(missing());
  });

  describe("without indexedDB.databases()", () => {
    let saved: PropertyDescriptor | undefined;
    function restore() {
      if (saved) Object.defineProperty(indexedDB, "databases", saved);
      else Reflect.deleteProperty(indexedDB, "databases");
    }
    beforeEach(() => {
      saved = Object.getOwnPropertyDescriptor(indexedDB, "databases");
      Object.defineProperty(indexedDB, "databases", { value: undefined, configurable: true });
    });
    afterEach(() => {
      restore();
    });

    test("a read of a missing database does not create it", async () => {
      await expect(
        new IDBDomain(deviceClient()).getData({
          securityOrigin: ORIGIN,
          databaseName: missing(),
          objectStoreName: "items",
          skipCount: 0,
          pageSize: 10,
        }),
      ).rejects.toThrow();
      restore();
      expect(await names()).not.toContain(missing());
    });
  });
});

describe("destructive actions check the page's origin (S7)", () => {
  test("clear, delete store and delete database refuse another origin", async () => {
    await seed(dbName, {}, [["a", 1]]);
    const domain = new IDBDomain(deviceClient());
    await expect(domain.clearObjectStore(OTHER, dbName, "items")).rejects.toThrow(/origin/);
    await expect(domain.deleteObjectStore(OTHER, dbName, "items")).rejects.toThrow(/origin/);
    await expect(domain.deleteDatabase(OTHER, dbName)).rejects.toThrow(/origin/);
    expect((await readAll(dbName)).values).toEqual(["a"]);
  });

  test("an import refuses another origin and writes nothing", async () => {
    await seed(dbName, {}, [["a", 1]]);
    const client = deviceClient();
    await expect(
      importReplaceSchema(client, {
        origin: OTHER,
        schema: { name: dbName, version: 2, stores: [] },
      }),
    ).rejects.toThrow(/origin/);
    await expect(
      importPutChunk(client, {
        origin: OTHER,
        database: dbName,
        store: "items",
        keyPath: null,
        records: [{ key: 2, value: "b" }],
      }),
    ).rejects.toThrow(/origin/);
    expect((await readAll(dbName)).values).toEqual(["a"]);
  });

  test("an import chunk without a key path still writes out-of-line keys", async () => {
    await seed(dbName, {}, []);
    await importPutChunk(deviceClient(), {
      origin: ORIGIN,
      database: dbName,
      store: "items",
      keyPath: undefined as unknown as null,
      records: [{ key: "k", value: { n: 1 } }],
    });
    expect(await readAll(dbName)).toEqual({ keys: ["k"], values: [{ n: 1 }] });
  });
});

describe("a key edit never overwrites another record (S4)", () => {
  test("moving onto a key that is taken is refused and nothing changes", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1, name: "one" }], [{ id: 2, name: "two" }]]);
    const error = await new IDBDomain(deviceClient())
      .putRecord(ORIGIN, dbName, "items", { id: 2, name: "moved" }, 1)
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(IdbKeyConflictError);
    expect((error as Error).message).toContain("2");
    expect((await readAll(dbName)).values).toEqual([
      { id: 1, name: "one" },
      { id: 2, name: "two" },
    ]);
  });

  test("replacing the other record is possible when asked for", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1, name: "one" }], [{ id: 2, name: "two" }]]);
    await new IDBDomain(deviceClient()).putRecord(
      ORIGIN,
      dbName,
      "items",
      { id: 2, name: "moved" },
      1,
      { replaceExisting: true },
    );
    expect((await readAll(dbName)).values).toEqual([{ id: 2, name: "moved" }]);
  });

  test("a move to a free key keeps one record", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1, name: "one" }]]);
    await new IDBDomain(deviceClient()).putRecord(
      ORIGIN,
      dbName,
      "items",
      { id: 5, name: "one" },
      1,
    );
    expect(await readAll(dbName)).toEqual({ keys: [5], values: [{ id: 5, name: "one" }] });
  });

  test("compound keys: a collision is refused, a free key moves", async () => {
    await seed(dbName, { keyPath: ["a", "b"] }, [[{ a: 1, b: 1 }], [{ a: 1, b: 2 }]]);
    const domain = new IDBDomain(deviceClient());
    await expect(
      domain.putRecord(ORIGIN, dbName, "items", { a: 1, b: 2, x: true }, [1, 1]),
    ).rejects.toBeInstanceOf(IdbKeyConflictError);
    await domain.putRecord(ORIGIN, dbName, "items", { a: 1, b: 3 }, [1, 1]);
    expect((await readAll(dbName)).keys).toEqual([
      [1, 2],
      [1, 3],
    ]);
  });

  test("auto-increment: a collision is refused, the key field cannot be dropped", async () => {
    await seed(dbName, { keyPath: "id", autoIncrement: true }, [[{ name: "a" }], [{ name: "b" }]]);
    const domain = new IDBDomain(deviceClient());
    await expect(
      domain.putRecord(ORIGIN, dbName, "items", { id: 2, name: "a" }, 1),
    ).rejects.toBeInstanceOf(IdbKeyConflictError);
    await expect(domain.putRecord(ORIGIN, dbName, "items", { name: "a" }, 1)).rejects.toThrow(
      "must keep its key field",
    );
    expect((await readAll(dbName)).keys).toEqual([1, 2]);
  });
});

describe("an import never writes empty values silently (S2)", () => {
  test("a value that was not saved in full is refused unless the loss was accepted", async () => {
    await seed(dbName, {}, []);
    const client = deviceClient();
    const records = [{ key: 1, value: { ok: 1, lost: { __type: "Unsupported", kind: "Foo" } } }];
    await expect(
      importPutChunk(client, {
        origin: ORIGIN,
        database: dbName,
        store: "items",
        keyPath: null,
        records,
      }),
    ).rejects.toThrow("not read in full");
    expect((await readAll(dbName)).values).toEqual([]);
    await importPutChunk(client, {
      origin: ORIGIN,
      database: dbName,
      store: "items",
      keyPath: null,
      records,
      acceptLoss: true,
    });
    expect((await readAll(dbName)).values).toEqual([{ ok: 1, lost: null }]);
  });

  test("the export names every lossy value with its record", async () => {
    const open = indexedDB.open(dbName, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("items");
    const db = await request(open);
    const tx = db.transaction("items", "readwrite");
    tx.objectStore("items").put({ failure: new Error("a") }, "first");
    tx.objectStore("items").put({ failure: new Error("b") }, "second");
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
    const chunk = await exportStoreChunk(deviceClient(), {
      origin: ORIGIN,
      database: dbName,
      store: "items",
    });
    expect(chunk.lossy).toEqual([
      'Record "first": "failure" is an Error (only its name and message are kept)',
      'Record "second": "failure" is an Error (only its name and message are kept)',
    ]);
  });
});
