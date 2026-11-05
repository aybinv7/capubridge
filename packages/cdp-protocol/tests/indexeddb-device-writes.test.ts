import { beforeEach, describe, expect, test } from "vite-plus/test";
import { IDBDomain } from "../src/cdp/domains/indexeddb.ts";
import { IdbBlockedError } from "../src/cdp/domains/indexeddb-records.ts";
import {
  deviceClient,
  freshDatabase,
  ORIGIN,
  readAll,
  request,
  seed,
  wait,
} from "./indexeddb-fixture.ts";

let dbName = "";

beforeEach(() => {
  dbName = freshDatabase("writes");
});

async function keyOf(value: unknown): Promise<unknown> {
  const { records } = await new IDBDomain(deviceClient()).getData({
    securityOrigin: ORIGIN,
    databaseName: dbName,
    objectStoreName: "items",
    skipCount: 0,
    pageSize: 10,
  });
  return records.find((record) => JSON.stringify(record.value) === JSON.stringify(value))
    ?.primaryKey;
}

describe("keys holding markers round-trip", () => {
  test("deletes a record whose key is a Date", async () => {
    await seed(dbName, {}, [
      ["a", new Date("2026-01-01T00:00:00.000Z")],
      ["b", 2],
    ]);
    const key = await keyOf("a");
    expect(key).toEqual({ __type: "Date", value: "2026-01-01T00:00:00.000Z" });
    await new IDBDomain(deviceClient()).deleteRecord(ORIGIN, dbName, "items", key);
    expect((await readAll(dbName)).values).toEqual(["b"]);
  });

  test("deletes records whose keys are an ArrayBuffer and a Uint8Array", async () => {
    await seed(dbName, {}, [
      ["buffer", new Uint8Array([1, 2, 3]).buffer],
      ["view", new Uint8Array([9, 9])],
      ["text", "keep"],
    ]);
    const domain = new IDBDomain(deviceClient());
    await domain.deleteRecord(ORIGIN, dbName, "items", await keyOf("buffer"));
    await domain.deleteRecord(ORIGIN, dbName, "items", await keyOf("view"));
    expect((await readAll(dbName)).values).toEqual(["text"]);
  });

  test("saves an out-of-line record under its Date key", async () => {
    const when = new Date("2026-01-01T00:00:00.000Z");
    await seed(dbName, {}, [[{ n: 1 }, when]]);
    await new IDBDomain(deviceClient()).putRecord(
      ORIGIN,
      dbName,
      "items",
      { n: 2 },
      await keyOf({ n: 1 }),
    );
    const { keys, values } = await readAll(dbName);
    expect(values).toEqual([{ n: 2 }]);
    expect(keys[0]).toBeInstanceOf(Date);
    expect((keys[0] as Date).toISOString()).toBe(when.toISOString());
  });
});

describe("IDBDomain.patchRecord", () => {
  test("changes one field and keeps a sibling Date a real Date", async () => {
    const created = new Date("2025-05-05T10:00:00.000Z");
    await seed(dbName, { keyPath: "id" }, [[{ id: 1, name: "a", created, tags: new Set([1]) }]]);
    await new IDBDomain(deviceClient()).patchRecord(ORIGIN, dbName, "items", 1, ["name"], "b");
    const [stored] = (await readAll(dbName)).values as Array<Record<string, unknown>>;
    expect(stored?.name).toBe("b");
    expect(stored?.created).toBeInstanceOf(Date);
    expect((stored as { created: Date }).created.toISOString()).toBe(created.toISOString());
    expect(stored?.tags).toBeInstanceOf(Set);
  });

  test("creates missing parents on an out-of-line record", async () => {
    await seed(dbName, {}, [[{ a: 1 }, "k"]]);
    await new IDBDomain(deviceClient()).patchRecord(
      ORIGIN,
      dbName,
      "items",
      "k",
      ["meta", "seen"],
      true,
    );
    expect((await readAll(dbName)).values).toEqual([{ a: 1, meta: { seen: true } }]);
  });

  test("refuses a field that holds a Date", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1, created: new Date(0) }]]);
    await expect(
      new IDBDomain(deviceClient()).patchRecord(ORIGIN, dbName, "items", 1, ["created"], "x"),
    ).rejects.toThrow("This field holds a Date; edit it in the app");
    const [stored] = (await readAll(dbName)).values as Array<Record<string, unknown>>;
    expect(stored?.created).toBeInstanceOf(Date);
  });

  test("refuses the key path", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1 }]]);
    await expect(
      new IDBDomain(deviceClient()).patchRecord(ORIGIN, dbName, "items", 1, ["id"], 2),
    ).rejects.toThrow("Change the key in the record pane");
  });

  test("reports a record that is no longer on the device", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1 }]]);
    await expect(
      new IDBDomain(deviceClient()).patchRecord(ORIGIN, dbName, "items", 7, ["x"], 2),
    ).rejects.toThrow("The record is no longer on the device");
  });

  test("rejects writes aimed at another origin", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1 }]]);
    await expect(
      new IDBDomain(deviceClient()).patchRecord("https://other.test", dbName, "items", 1, ["x"], 2),
    ).rejects.toThrow("another origin");
  });
});

describe("blocked schema changes", () => {
  async function holdOpen(): Promise<IDBDatabase> {
    const db = await request(indexedDB.open(dbName));
    db.onversionchange = null;
    return db;
  }

  test("deleteObjectStore reports blocked and changes nothing", async () => {
    await seed(dbName, {}, [["a", 1]]);
    const held = await holdOpen();
    await expect(
      new IDBDomain(deviceClient()).deleteObjectStore(ORIGIN, dbName, "items"),
    ).rejects.toBeInstanceOf(IdbBlockedError);
    held.close();
    await wait(30);
    const db = await request(indexedDB.open(dbName));
    expect(db.version).toBe(1);
    expect(Array.from(db.objectStoreNames)).toEqual(["items"]);
    db.close();
  });

  test("deleteObjectStore removes the store when nothing holds the database", async () => {
    await seed(dbName, {}, [["a", 1]]);
    await new IDBDomain(deviceClient()).deleteObjectStore(ORIGIN, dbName, "items");
    const db = await request(indexedDB.open(dbName));
    expect(Array.from(db.objectStoreNames)).toEqual([]);
    db.close();
  });

  test("deleteDatabase reports blocked with what happens next", async () => {
    await seed(dbName, {}, [["a", 1]]);
    const held = await holdOpen();
    const error = await new IDBDomain(deviceClient())
      .deleteDatabase(ORIGIN, dbName)
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(IdbBlockedError);
    expect((error as Error).message).toContain("cannot be cancelled");
    held.close();
    await wait(30);
    const names = (await indexedDB.databases()).map((entry) => entry.name);
    expect(names).not.toContain(dbName);
  });
});
