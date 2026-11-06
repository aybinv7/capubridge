import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { KeyValueDomain } from "../src/cdp/domains/keyvalue.ts";
import { PAGE, fakeOrigin, freshName, pageClient, seedForage } from "./keyvalue-fixture.ts";

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((entry) => entry.name ?? "");
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localforage");
});

describe("the Graph's LocalForage read", () => {
  test("never asks LocalForage for an instance and never creates a database", async () => {
    const createInstance = vi.fn(() => ({ keys: async () => [], getItem: async () => null }));
    Object.defineProperty(globalThis, "localforage", {
      value: { createInstance },
      configurable: true,
    });
    const client = pageClient({ [PAGE]: fakeOrigin() });
    await new KeyValueDomain(client).readAllForage().catch(() => undefined);
    Reflect.deleteProperty(globalThis, "localforage");
    await new KeyValueDomain(client).readAllForage().catch(() => undefined);
    expect(createInstance).not.toHaveBeenCalled();
    expect(await databaseNames()).not.toContain("localforage");
  });

  test("reads the entries of every LocalForage store of the page", async () => {
    const name = freshName("graph");
    await seedForage(name, [["cart", { items: 2 }]]);
    const client = pageClient({ [PAGE]: fakeOrigin() });
    const stores = await new KeyValueDomain(client).readAllForage();
    const mine = stores.find((store) => store.database === name);
    expect(mine?.page.entries).toContainEqual(expect.objectContaining({ key: "cart" }));
  });
});
