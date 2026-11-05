import { beforeEach, describe, expect, test } from "vite-plus/test";
import { IDBDomain } from "../src/cdp/domains/indexeddb.ts";
import { deviceClient, freshDatabase, ORIGIN, seed } from "./indexeddb-fixture.ts";

let dbName = "";

beforeEach(() => {
  dbName = freshDatabase("search");
});

const rows = (count: number): [unknown, IDBValidKey?][] =>
  Array.from({ length: count }, (_, id) => [{ id, name: id % 250 === 7 ? "needle" : "hay" }]);

describe("searchStore (F4)", () => {
  test("reads in short transactions and still finds every match", async () => {
    await seed(dbName, { keyPath: "id" }, rows(1200));
    const result = await new IDBDomain(deviceClient()).searchStore({
      securityOrigin: ORIGIN,
      databaseName: dbName,
      objectStoreName: "items",
      needle: "NEEDLE",
    });
    expect(result.scanned).toBe(1200);
    expect(result.capped).toBeNull();
    expect(result.records.map((record) => record.key)).toEqual([7, 257, 507, 757, 1007]);
  });

  test("stops between two reads once cancelled", async () => {
    await seed(dbName, { keyPath: "id" }, rows(3000));
    const domain = new IDBDomain(deviceClient());
    const search = domain.searchStore({
      securityOrigin: ORIGIN,
      databaseName: dbName,
      objectStoreName: "items",
      needle: "needle",
      token: "t1",
    });
    await domain.cancelSearch("t1");
    const result = await search;
    expect(result.capped).toBe("cancelled");
    expect(result.scanned).toBeLessThan(3000);
  });
});
