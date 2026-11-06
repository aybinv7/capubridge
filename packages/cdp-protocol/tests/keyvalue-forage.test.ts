import { beforeEach, describe, expect, test } from "vite-plus/test";
import { KeyValueDomain, KeyValueWrongOriginError } from "../src/cdp/domains/keyvalue.ts";
import {
  PAGE,
  fakeOrigin,
  freshName,
  idbRequest,
  pageClient,
  readForage,
  seedForage,
} from "./keyvalue-fixture.ts";

let name = "";
let domain: KeyValueDomain;

beforeEach(() => {
  name = freshName("forage");
  domain = new KeyValueDomain(pageClient({ [PAGE]: fakeOrigin() }));
});

const target = () =>
  ({ kind: "forage", origin: PAGE, database: name, store: "keyvaluepairs" }) as const;

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((entry) => entry.name ?? "");
}

describe("finding LocalForage", () => {
  test("lists every store of a LocalForage database, never a plain IndexedDB database", async () => {
    await seedForage(name, [["a", 1]]);
    const plain = freshName("plain");
    await seedForage(plain, [["b", 2]], { detectStore: false });
    const found = await domain.discover();
    expect(found.forage).toContainEqual({ database: name, store: "keyvaluepairs", count: 1 });
    expect(found.forage.some((entry) => entry.database === plain)).toBe(false);
    expect(found.forage.some((entry) => entry.store === "local-forage-detect-blob-support")).toBe(
      false,
    );
  });
});

describe("reading LocalForage", () => {
  test("values JSON cannot carry come back as readable markers and are read-only", async () => {
    await seedForage(name, [
      ["plain", { a: 1 }],
      ["when", new Date("2026-11-05T10:00:00.000Z")],
    ]);
    const page = await domain.readForage(PAGE, name, "keyvaluepairs");
    const byKey = new Map(page.entries.map((entry) => [entry.key, entry]));
    expect(byKey.get("plain")).toMatchObject({ value: { a: 1 }, editable: true });
    expect(byKey.get("when")).toMatchObject({
      value: { __type: "Date", value: "2026-11-05T10:00:00.000Z" },
      editable: false,
    });
    expect(byKey.get("when")?.readOnlyReason).toMatch(/Date/);
  });

  test("a missing database is never created by a read or a write", async () => {
    await expect(domain.readForage(PAGE, name, "keyvaluepairs")).rejects.toThrow();
    await expect(
      domain.write(target(), { op: "set", key: "a", value: 1, expected: null }),
    ).rejects.toThrow();
    expect(await databaseNames()).not.toContain(name);
  });
});

describe("LocalForage writes keep what the person did not see", () => {
  test("a save replaces the value only when the phone still holds what was read", async () => {
    await seedForage(name, [["cart", { items: 1 }]]);
    const save = { op: "set", key: "cart", value: { items: 2 }, expected: '{"items":9}' } as const;
    await expect(domain.write(target(), save)).rejects.toMatchObject({ conflict: "changed" });
    expect((await readForage(name))["cart"]).toEqual({ items: 1 });
    await domain.write(target(), { ...save, expected: '{"items":1}' });
    expect((await readForage(name))["cart"]).toEqual({ items: 2 });
  });

  test("a new key that exists and a rename onto a taken key are refused", async () => {
    await seedForage(name, [
      ["a", "one"],
      ["b", "two"],
    ]);
    await expect(
      domain.write(target(), { op: "set", key: "a", value: "x", expected: null }),
    ).rejects.toMatchObject({ conflict: "exists" });
    await expect(
      domain.write(target(), {
        op: "rename",
        key: "a",
        nextKey: "b",
        value: "one",
        expected: '"one"',
      }),
    ).rejects.toMatchObject({ conflict: "exists" });
    expect(await readForage(name)).toEqual({ a: "one", b: "two" });
  });

  test("a rename moves the value; a date in a new value is stored as a date", async () => {
    await seedForage(name, [["a", "one"]]);
    await domain.write(target(), {
      op: "rename",
      key: "a",
      nextKey: "c",
      value: { at: { __type: "Date", value: "2026-11-05T10:00:00.000Z" } },
      expected: '"one"',
    });
    const stored = await readForage(name);
    expect(Object.keys(stored)).toEqual(["c"]);
    expect((stored["c"] as { at: unknown }).at).toBeInstanceOf(Date);
  });

  test("a delete says when the key was already gone", async () => {
    await seedForage(name, [["a", 1]]);
    await expect(domain.write(target(), { op: "delete", key: "a" })).resolves.toEqual({
      gone: false,
    });
    await expect(domain.write(target(), { op: "delete", key: "a" })).resolves.toEqual({
      gone: true,
    });
  });

  test("another origin is refused and nothing changes", async () => {
    await seedForage(name, [["a", 1]]);
    await expect(
      domain.write({ ...target(), origin: "https://other.test" }, { op: "delete", key: "a" }),
    ).rejects.toBeInstanceOf(KeyValueWrongOriginError);
    expect(await readForage(name)).toEqual({ a: 1 });
  });

  test("the database version is never changed by a write", async () => {
    await seedForage(name, [["a", 1]]);
    await domain.write(target(), { op: "set", key: "a", value: 2, expected: "1" });
    const db = await idbRequest(indexedDB.open(name));
    expect(db.version).toBe(2);
    db.close();
  });
});

describe("LocalForage deletes keep what the person did not see", () => {
  test("a value the app changed is kept, the rest of the batch is deleted in one transaction", async () => {
    await seedForage(name, [
      ["a", { v: 1 }],
      ["b", { v: 9 }],
    ]);
    const result = await domain.deleteMany(target(), [
      { key: "a", expected: '{"v":1}' },
      { key: "b", expected: '{"v":2}' },
      { key: "c", expected: "1" },
    ]);
    expect(result).toEqual({ deleted: [0], changed: [1], gone: [2] });
    expect(await readForage(name)).toEqual({ b: { v: 9 } });
  });

  test("a single delete of a changed value is refused", async () => {
    await seedForage(name, [["a", 2]]);
    await expect(
      domain.write(target(), { op: "delete", key: "a", expected: "1" }),
    ).rejects.toMatchObject({ conflict: "changed" });
    expect(await readForage(name)).toEqual({ a: 2 });
  });
});
