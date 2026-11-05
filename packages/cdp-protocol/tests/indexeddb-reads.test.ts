import { beforeEach, describe, expect, test } from "vite-plus/test";
import { IDBDomain } from "../src/cdp/domains/indexeddb.ts";
import { DeviceEvaluationError } from "../src/cdp/evaluate.ts";
import { deviceClient, freshDatabase, ORIGIN, seed } from "./indexeddb-fixture.ts";

type Client = ConstructorParameters<typeof IDBDomain>[0];

let dbName = "";

beforeEach(() => {
  dbName = freshDatabase();
});

function page(skipCount = 0, pageSize = 50) {
  return {
    securityOrigin: ORIGIN,
    databaseName: dbName,
    objectStoreName: "items",
    skipCount,
    pageSize,
  };
}

describe("IDBDomain.getData", () => {
  test("reads a page in one evaluate and keeps plain JSON editable", async () => {
    await seed(dbName, { keyPath: "id" }, [[{ id: 1, name: "a" }], [{ id: 2, name: "b" }]]);
    const client = deviceClient();
    const result = await new IDBDomain(client).getData(page());
    expect(client.calls).toEqual(["Runtime.evaluate"]);
    expect(result.hasMore).toBe(false);
    expect(result.records).toEqual([
      { key: 1, primaryKey: 1, value: { id: 1, name: "a" }, editable: true },
      { key: 2, primaryKey: 2, value: { id: 2, name: "b" }, editable: true },
    ]);
  });

  test("pages with skip and reports more records", async () => {
    await seed(
      dbName,
      {},
      Array.from({ length: 5 }, (_, index): [unknown, IDBValidKey] => [index, index]),
    );
    const result = await new IDBDomain(deviceClient()).getData(page(2, 2));
    expect(result.records.map((record) => record.key)).toEqual([2, 3]);
    expect(result.hasMore).toBe(true);
    const last = await new IDBDomain(deviceClient()).getData(page(4, 2));
    expect(last.records.map((record) => record.key)).toEqual([4]);
    expect(last.hasMore).toBe(false);
  });

  test("marks every non-JSON value read-only with an honest reason", async () => {
    await seed(dbName, {}, [
      [{ when: new Date("2026-01-02T03:04:05.000Z") }, "date"],
      [{ tags: new Map([["a", 1]]) }, "map"],
      [{ ids: new Set([1, 2]) }, "set"],
      [{ bytes: new Int16Array([1, 2]) }, "typed"],
      [{ file: new Blob(["hi"], { type: "text/plain" }) }, "blob"],
      [{ big: 10n }, "bigint"],
      [{ nested: { missing: undefined } }, "undefined"],
      [{ __type: "user", name: "x" }, "reserved"],
      [{ plain: [1, "two", null] }, "plain"],
    ]);
    const { records } = await new IDBDomain(deviceClient()).getData(page());
    const byKey = new Map(records.map((record) => [record.key, record]));
    expect(byKey.get("date")?.value).toEqual({
      when: { __type: "Date", value: "2026-01-02T03:04:05.000Z" },
    });
    expect(byKey.get("date")?.readOnlyReason).toBe(
      'Holds a Date at "when"; saving the whole record here would turn it into text.',
    );
    expect(byKey.get("map")?.value).toEqual({
      tags: { __type: "Map", size: 1, entries: [["a", 1]] },
    });
    expect(byKey.get("map")?.readOnlyReason).toContain('Holds a Map at "tags"');
    expect(byKey.get("set")?.value).toEqual({ ids: { __type: "Set", size: 2, values: [1, 2] } });
    expect(byKey.get("typed")?.value).toEqual({
      bytes: { __type: "Int16Array", byteLength: 4, length: 2, base64: "AQACAA==" },
    });
    expect(byKey.get("typed")?.readOnlyReason).toContain("an Int16Array");
    expect(byKey.get("blob")?.value).toEqual({
      file: { __type: "Blob", size: 2, type: "text/plain" },
    });
    expect(byKey.get("bigint")?.value).toEqual({ big: { __type: "BigInt", value: "10" } });
    expect(byKey.get("undefined")?.readOnlyReason).toContain('Holds undefined at "nested.missing"');
    expect(byKey.get("reserved")?.readOnlyReason).toContain("reserved field name");
    expect(byKey.get("plain")).toMatchObject({ editable: true });
    for (const [key, record] of byKey) {
      if (key !== "plain") expect(record.editable, JSON.stringify(key)).toBe(false);
    }
  });

  test("a Date key keeps the record editable and comes back as a marker", async () => {
    await seed(dbName, {}, [[{ a: 1 }, new Date("2026-03-01T00:00:00.000Z")]]);
    const { records } = await new IDBDomain(deviceClient()).getData(page());
    expect(records[0]).toMatchObject({
      key: { __type: "Date", value: "2026-03-01T00:00:00.000Z" },
      editable: true,
    });
  });

  test("a value over 1 MB is cut and read-only", async () => {
    await seed(dbName, {}, [["x".repeat(1_100_000), "big"]]);
    const { records } = await new IDBDomain(deviceClient()).getData(page());
    expect(records[0]?.value).toMatchObject({ __type: "TooLarge" });
    expect(records[0]?.readOnlyReason).toBe(
      "The value is larger than 1 MB, so only part of it was read.",
    );
  });

  test("falls back to IndexedDB.requestData with one batched encode", async () => {
    const sent: string[] = [];
    const client = {
      send: async (method: string, params?: Record<string, unknown>) => {
        sent.push(method);
        if (method === "Runtime.evaluate") {
          return { result: { value: JSON.stringify({ error: "wrong origin" }) } };
        }
        if (method === "IndexedDB.requestData") {
          return {
            hasMore: false,
            objectStoreDataEntries: [
              {
                key: { type: "number", value: 1 },
                primaryKey: { type: "number", value: 1 },
                value: { type: "object", objectId: "v1" },
              },
              {
                key: { type: "number", value: 2 },
                primaryKey: { type: "number", value: 2 },
                value: { type: "object", objectId: "v2" },
              },
            ],
          };
        }
        if (method === "Runtime.callFunctionOn") {
          expect(params?.arguments).toHaveLength(6);
          const fn = (0, eval)(`(${String(params?.functionDeclaration)})`) as (
            ...values: unknown[]
          ) => string;
          return { result: { value: fn(1, 1, { a: new Date(0) }, 2, 2, { b: 2 }) } };
        }
        return {};
      },
    } as unknown as Client;
    const result = await new IDBDomain(client).getData(page());
    expect(sent.filter((method) => method === "Runtime.callFunctionOn")).toHaveLength(1);
    expect(sent.filter((method) => method === "Runtime.releaseObject")).toHaveLength(2);
    expect(result.records[0]).toMatchObject({ editable: false });
    expect(result.records[1]).toMatchObject({ value: { b: 2 }, editable: true });
  });
});

describe("IDBDomain other reads", () => {
  test("getRecord reads one record by a Date key and returns null when gone", async () => {
    const when = new Date("2026-03-01T00:00:00.000Z");
    await seed(dbName, {}, [[{ a: 1 }, when]]);
    const domain = new IDBDomain(deviceClient());
    const key = { __type: "Date", value: when.toISOString() };
    await expect(domain.getRecord(ORIGIN, dbName, "items", key)).resolves.toMatchObject({
      value: { a: 1 },
      editable: true,
    });
    await expect(domain.getRecord(ORIGIN, dbName, "items", "missing")).resolves.toBeNull();
  });

  test("searchStore scans the whole store and reports its caps", async () => {
    await seed(
      dbName,
      {},
      Array.from({ length: 30 }, (_, index): [unknown, IDBValidKey] => [
        { name: index % 10 === 3 ? `Needle ${index}` : `hay ${index}` },
        index,
      ]),
    );
    const domain = new IDBDomain(deviceClient());
    const base = { securityOrigin: ORIGIN, databaseName: dbName, objectStoreName: "items" };
    const found = await domain.searchStore({ ...base, needle: "needle" });
    expect(found.records.map((record) => record.key)).toEqual([3, 13, 23]);
    expect(found).toMatchObject({ scanned: 30, capped: null });
    const capped = await domain.searchStore({ ...base, needle: "needle", maxScan: 10 });
    expect(capped).toMatchObject({ scanned: 10, capped: "count" });
    const limited = await domain.searchStore({ ...base, needle: "hay", limit: 2 });
    expect(limited).toMatchObject({ capped: "limit" });
    expect(limited.records).toHaveLength(2);
  });

  test("store size sample measures the stored value", async () => {
    await seed(dbName, {}, [[{ text: "x".repeat(1000) }, 1]]);
    const domain = new IDBDomain(deviceClient());
    const client = (domain as unknown as { client: Client }).client;
    const sizes = await import("../src/cdp/domains/indexeddb-reads.ts").then((module) =>
      module.sampleStoreSizes(client, dbName, ["items"]),
    );
    expect(sizes.items?.count).toBe(1);
    expect(sizes.items?.bytes).toBeGreaterThan(1000);
  });

  test("discoverDatabases throws the device error instead of reading as empty", async () => {
    const client = {
      send: async () => ({
        result: { type: "object" },
        exceptionDetails: { exception: { description: "SecurityError: denied" } },
      }),
    } as unknown as Client;
    await expect(new IDBDomain(client).discoverDatabases()).rejects.toBeInstanceOf(
      DeviceEvaluationError,
    );
  });
});
