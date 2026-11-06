import { describe, expect, test } from "vite-plus/test";
import { IDB_DEVICE_CODEC_SOURCE } from "../src/cdp/domains/indexeddb-codec.ts";
import { KeyValueDomain } from "../src/cdp/domains/keyvalue.ts";
import {
  PAGE,
  fakeOrigin,
  freshName,
  idbRequest,
  pageClient,
  seedForage,
} from "./keyvalue-fixture.ts";

describe("databases opened to look inside them", () => {
  test("close when the app upgrades, so the app is never blocked", async () => {
    const name = freshName("app");
    await seedForage(name, [["a", 1]], { detectStore: false });
    const held = (await (0, eval)(
      `(async () => { ${IDB_DEVICE_CODEC_SOURCE}; return __cbOpenExisting(${JSON.stringify(name)}); })()`,
    )) as IDBDatabase;
    let blocked = false;
    const upgrade = indexedDB.open(name, 3);
    upgrade.onblocked = () => (blocked = true);
    upgrade.onupgradeneeded = () => upgrade.result.createObjectStore("added");
    const db = await idbRequest(upgrade);
    expect(blocked).toBe(false);
    expect(db.version).toBe(3);
    db.close();
    held.close();
  });
});

describe("LocalForage discovery", () => {
  test("names the databases that are not LocalForage, and does not open them again", async () => {
    const plain = freshName("plain");
    const forage = freshName("forage");
    await seedForage(plain, [["b", 2]], { detectStore: false });
    await seedForage(forage, [["a", 1]]);
    const client = pageClient({ [PAGE]: fakeOrigin() });
    const first = await new KeyValueDomain(client).discover();
    expect(first.plainDatabases).toContain(`${plain}@2`);
    expect(first.plainDatabases.some((entry) => entry.startsWith(`${forage}@`))).toBe(false);
    const opened: string[] = [];
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = ((target: string, version?: number) => {
      opened.push(target);
      return open(target, version);
    }) as typeof indexedDB.open;
    try {
      const again = await new KeyValueDomain(client).discover({ skip: first.plainDatabases });
      expect(again.forage.some((entry) => entry.database === forage)).toBe(true);
      expect(opened).not.toContain(plain);
      expect(opened).toContain(forage);
    } finally {
      indexedDB.open = open;
    }
  });
});
