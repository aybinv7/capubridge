import { beforeEach, describe, expect, test } from "vite-plus/test";
import {
  importCopyChunk,
  importPutChunk,
  importReplaceSchema,
  importStageBegin,
  importStageBinary,
  importStageDiscard,
  type IdbSchema,
} from "../src/cdp/domains/indexeddb-transfer.ts";
import { deviceClient, freshDatabase, ORIGIN, readAll, seed } from "./indexeddb-fixture.ts";

let target = "";
let stage = "";

beforeEach(() => {
  target = freshDatabase("target");
  stage = `${target}-stage`;
});

const schema = (name: string): IdbSchema => ({
  name,
  version: 2,
  stores: [
    {
      name: "items",
      keyPath: "id",
      autoIncrement: false,
      indexes: [{ name: "by_code", keyPath: "code", unique: true, multiEntry: false }],
    },
  ],
});

async function copyAll(store: string): Promise<number> {
  let after: unknown = null;
  let copied = 0;
  for (;;) {
    const chunk = await importCopyChunk(deviceClient(), {
      origin: ORIGIN,
      from: stage,
      to: target,
      store,
      after,
      maxRecords: 2,
    });
    copied += chunk.copied;
    if (chunk.next === null) return copied;
    after = chunk.next;
  }
}

async function names(): Promise<string[]> {
  return (await indexedDB.databases()).map((entry) => entry.name ?? "");
}

describe("an import is written to a scratch database first (S3)", () => {
  test("a record the phone refuses fails before the real database is touched", async () => {
    await seed(target, { keyPath: "id" }, [[{ id: 1, code: "keep" }]]);
    const client = deviceClient();
    await importStageBegin(client, { origin: ORIGIN, stage, schema: schema(target) });
    await expect(
      importPutChunk(client, {
        origin: ORIGIN,
        database: stage,
        store: "items",
        records: [
          { key: 1, value: { id: 1, code: "same" } },
          { key: 2, value: { id: 2, code: "same" } },
        ],
      }),
    ).rejects.toThrow();
    await importStageDiscard(client, { origin: ORIGIN, stage });
    expect((await readAll(target)).values).toEqual([{ id: 1, code: "keep" }]);
    expect(await names()).not.toContain(stage);
  });

  test("the staged records replace the database, store by store, on the phone", async () => {
    await seed(target, { keyPath: "id" }, [[{ id: 99, code: "old" }]]);
    const client = deviceClient();
    await importStageBegin(client, { origin: ORIGIN, stage, schema: schema(target) });
    await importPutChunk(client, {
      origin: ORIGIN,
      database: stage,
      store: "items",
      records: [1, 2, 3, 4, 5].map((id) => ({ key: id, value: { id, code: `c${id}` } })),
    });
    await importReplaceSchema(client, { origin: ORIGIN, schema: schema(target) });
    expect(await copyAll("items")).toBe(5);
    await importStageDiscard(client, { origin: ORIGIN, stage });
    expect((await readAll(target)).keys).toEqual([1, 2, 3, 4, 5]);
    expect(await names()).not.toContain(stage);
  });

  test("a large binary value arrives in pieces and is put back together", async () => {
    const client = deviceClient();
    const bytes = Uint8Array.from({ length: 300 }, (_, index) => index % 256);
    const base64 = Buffer.from(bytes).toString("base64");
    await importStageBegin(client, {
      origin: ORIGIN,
      stage,
      schema: {
        name: target,
        version: 1,
        stores: [{ name: "files", keyPath: null, autoIncrement: false, indexes: [] }],
      },
    });
    for (let start = 0; start < base64.length; start += 100) {
      await importStageBinary(client, {
        origin: ORIGIN,
        id: "b1",
        base64: base64.slice(start, start + 100),
      });
    }
    await importPutChunk(client, {
      origin: ORIGIN,
      database: stage,
      store: "files",
      records: [
        {
          key: "photo",
          value: { blob: { __type: "Blob", size: 300, type: "image/png", staged: "b1" } },
        },
      ],
    });
    const stored = (await readAll(stage, "files")).values[0] as { blob: Blob };
    expect(stored.blob).toBeInstanceOf(Blob);
    expect(new Uint8Array(await stored.blob.arrayBuffer())).toEqual(bytes);
  });

  test("a scratch database that already exists is never reused", async () => {
    await seed(stage, {}, [["x", 1]]);
    await expect(
      importStageBegin(deviceClient(), { origin: ORIGIN, stage, schema: schema(target) }),
    ).rejects.toThrow("already exists");
    expect((await readAll(stage)).values).toEqual(["x"]);
  });
});
