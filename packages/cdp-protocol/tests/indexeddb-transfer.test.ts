import { beforeEach, describe, expect, test } from "vite-plus/test";
import { IdbBlockedError } from "../src/cdp/domains/indexeddb-records.ts";
import {
  exportStoreChunk,
  importPutChunk,
  importReplaceSchema,
  type IdbTransferRecord,
} from "../src/cdp/domains/indexeddb-transfer.ts";
import {
  deviceClient,
  freshDatabase,
  ORIGIN,
  readAll,
  request,
  wait,
} from "./indexeddb-fixture.ts";

let source = "";
let target = "";

beforeEach(() => {
  source = freshDatabase("export");
  target = freshDatabase("import");
});

const when = new Date("2026-02-03T04:05:06.007Z");

async function seedRich(name: string): Promise<void> {
  const open = indexedDB.open(name, 3);
  open.onupgradeneeded = () => {
    open.result.createObjectStore("plain");
    const items = open.result.createObjectStore("items", { keyPath: "id" });
    items.createIndex("by_name", "name", { unique: false });
  };
  const db = await request(open);
  const tx = db.transaction(["plain", "items"], "readwrite");
  tx.objectStore("plain").put(
    {
      when,
      bytes: new Uint8Array([1, 2, 250]),
      buffer: new Uint8Array([7, 8]).buffer,
      map: new Map<unknown, unknown>([["k", new Date(0)]]),
      set: new Set([1, "two"]),
      big: 12345678901234567890n,
      nested: { gone: undefined, nan: Number.NaN },
      reserved: { __type: "user", name: "Ana" },
    },
    when,
  );
  for (let id = 1; id <= 5; id += 1) tx.objectStore("items").put({ id, name: `n${id}` });
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
}

async function exportAll(name: string, store: string) {
  const client = deviceClient();
  const records: IdbTransferRecord[] = [];
  const lossy: string[] = [];
  let after: unknown = undefined;
  let chunks = 0;
  for (;;) {
    const chunk = await exportStoreChunk(client, {
      origin: ORIGIN,
      database: name,
      store,
      after,
      maxRecords: 2,
    });
    chunks += 1;
    records.push(...chunk.records);
    lossy.push(...chunk.lossy);
    if (chunk.next === null) break;
    after = chunk.next;
  }
  return { records, lossy, chunks };
}

describe("IndexedDB export and import", () => {
  test("round-trips every structured-clone type, including a Date key", async () => {
    await seedRich(source);
    const plain = await exportAll(source, "plain");
    const items = await exportAll(source, "items");
    expect(plain.lossy).toEqual([]);
    expect(items.records).toHaveLength(5);
    expect(items.chunks).toBe(3);

    const client = deviceClient();
    await importReplaceSchema(client, {
      origin: ORIGIN,
      schema: {
        name: target,
        version: 3,
        stores: [
          { name: "plain", keyPath: null, autoIncrement: false, indexes: [] },
          {
            name: "items",
            keyPath: "id",
            autoIncrement: false,
            indexes: [{ name: "by_name", keyPath: "name", unique: false, multiEntry: false }],
          },
        ],
      },
    });
    await importPutChunk(client, {
      origin: ORIGIN,
      database: target,
      store: "plain",
      keyPath: null,
      records: plain.records,
    });
    await importPutChunk(client, {
      origin: ORIGIN,
      database: target,
      store: "items",
      keyPath: "id",
      records: items.records,
    });

    const { keys, values } = await readAll(target, "plain");
    expect(keys[0]).toBeInstanceOf(Date);
    expect((keys[0] as Date).toISOString()).toBe(when.toISOString());
    const value = values[0] as Record<string, unknown>;
    expect(value.when).toBeInstanceOf(Date);
    expect((value.when as Date).getTime()).toBe(when.getTime());
    expect(value.bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(value.bytes as Uint8Array)).toEqual([1, 2, 250]);
    expect(value.buffer).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(value.buffer as ArrayBuffer))).toEqual([7, 8]);
    expect(value.map).toBeInstanceOf(Map);
    expect((value.map as Map<string, unknown>).get("k")).toBeInstanceOf(Date);
    expect(value.set).toEqual(new Set([1, "two"]));
    expect(value.big).toBe(12345678901234567890n);
    const nested = value.nested as Record<string, unknown>;
    expect("gone" in nested).toBe(true);
    expect(nested.gone).toBeUndefined();
    expect(Number.isNaN(nested.nan)).toBe(true);
    expect(value.reserved).toEqual({ __type: "user", name: "Ana" });

    const restored = await readAll(target, "items");
    expect(restored.keys).toEqual([1, 2, 3, 4, 5]);
    const db = await request(indexedDB.open(target));
    expect(db.version).toBe(3);
    expect(Array.from(db.transaction("items").objectStore("items").indexNames)).toEqual([
      "by_name",
    ]);
    db.close();
  });

  test("blobs are exported with their bytes and restored", async () => {
    const open = indexedDB.open(source, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("plain");
    const db = await request(open);
    const tx = db.transaction("plain", "readwrite");
    tx.objectStore("plain").put({ file: new Blob(["hello"], { type: "text/plain" }) }, 1);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
    const exported = await exportAll(source, "plain");
    expect(exported.records[0]?.value).toMatchObject({
      file: { __type: "Blob", size: 5, type: "text/plain", base64: "aGVsbG8=" },
    });
    const client = deviceClient();
    await importReplaceSchema(client, {
      origin: ORIGIN,
      schema: {
        name: target,
        version: 1,
        stores: [{ name: "plain", keyPath: null, autoIncrement: false, indexes: [] }],
      },
    });
    await importPutChunk(client, {
      origin: ORIGIN,
      database: target,
      store: "plain",
      keyPath: null,
      records: exported.records,
    });
    const restored = (await readAll(target, "plain")).values[0] as { file: Blob };
    expect(restored.file).toBeInstanceOf(Blob);
    expect(await restored.file.text()).toBe("hello");
  });

  test("reports values that cannot be restored", async () => {
    const open = indexedDB.open(source, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("plain");
    const db = await request(open);
    const tx = db.transaction("plain", "readwrite");
    tx.objectStore("plain").put({ failure: new RangeError("boom") }, 1);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
    const exported = await exportAll(source, "plain");
    expect(exported.lossy).toEqual([
      'Record 1: "failure" is an Error (only its name and message are kept)',
    ]);
  });

  test("replacing a database the app holds open changes nothing", async () => {
    await seedRich(source);
    const held = await request(indexedDB.open(source));
    held.onversionchange = null;
    await expect(
      importReplaceSchema(deviceClient(), {
        origin: ORIGIN,
        schema: { name: source, version: 3, stores: [] },
      }),
    ).rejects.toBeInstanceOf(IdbBlockedError);
    held.close();
    await wait(30);
    expect((await readAll(source, "items")).keys).toEqual([1, 2, 3, 4, 5]);
  });

  test("writes plain JSON as is when markers must not be revived", async () => {
    const client = deviceClient();
    await importReplaceSchema(client, {
      origin: ORIGIN,
      schema: {
        name: target,
        version: 1,
        stores: [{ name: "plain", keyPath: null, autoIncrement: false, indexes: [] }],
      },
    });
    await importPutChunk(client, {
      origin: ORIGIN,
      database: target,
      store: "plain",
      keyPath: null,
      records: [{ key: "a", value: { __type: "Date", value: "x" } }],
      revive: false,
    });
    expect((await readAll(target, "plain")).values).toEqual([{ __type: "Date", value: "x" }]);
  });
});
