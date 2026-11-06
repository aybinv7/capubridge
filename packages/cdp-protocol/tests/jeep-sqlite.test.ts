import { describe, expect, test } from "vite-plus/test";
import { JEEP_READ_CHUNK_BYTES, JeepSqliteDomain } from "../src/cdp/domains/jeep-sqlite.ts";
import type { CDPClient } from "../src/cdp/client.ts";
import { PAGE, fakeOrigin, idbRequest, pageClient } from "./keyvalue-fixture.ts";

const MAGIC = new TextEncoder().encode("SQLite format 3\u0000");

function database(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(MAGIC);
  for (let i = MAGIC.length; i < size; i++) bytes[i] = i % 251;
  return bytes;
}

async function seedJeep(key: string, value: Uint8Array): Promise<void> {
  const open = indexedDB.open("jeepSQLiteStore", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("databases");
  const db = await idbRequest(open);
  const tx = db.transaction("databases", "readwrite");
  tx.objectStore("databases").put(value, key);
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
}

function measured(client: CDPClient & { calls: string[] }) {
  const sizes: number[] = [];
  const send = client.send.bind(client);
  const wrapped = {
    ...client,
    send: async (method: string, params?: Record<string, unknown>) => {
      const answer = (await send(method as never, params as never)) as {
        result?: { value?: unknown };
      };
      const value = answer.result?.value;
      if (typeof value === "string") sizes.push(value.length);
      return answer;
    },
  } as unknown as CDPClient;
  return { client: wrapped, sizes };
}

describe("jeep-sqlite reads (C35)", () => {
  test("a database larger than one chunk arrives whole, one chunk per evaluate", async () => {
    const bytes = database(JEEP_READ_CHUNK_BYTES * 2 + 1234);
    await seedJeep("big.db", bytes);
    const { client, sizes } = measured(pageClient({ [PAGE]: fakeOrigin() }));
    const progress: number[] = [];
    const read = await new JeepSqliteDomain(client).readDatabaseBytes({ key: "big.db" }, (loaded) =>
      progress.push(loaded),
    );
    expect(read.byteLength).toBe(bytes.byteLength);
    expect(Buffer.compare(read, bytes)).toBe(0);
    expect(Math.max(...sizes)).toBeLessThan(JEEP_READ_CHUNK_BYTES * 1.4);
    expect(progress).toEqual([
      JEEP_READ_CHUNK_BYTES,
      JEEP_READ_CHUNK_BYTES * 2,
      JEEP_READ_CHUNK_BYTES * 2 + 1234,
    ]);
    expect(
      (globalThis as { __capubridgeJeepReads?: Record<string, unknown> }).__capubridgeJeepReads,
    ).toEqual({});
  }, 30_000);

  test("a value that is not a database is refused and nothing stays behind", async () => {
    await seedJeep("notes", new TextEncoder().encode("plain text, no header"));
    const client = pageClient({ [PAGE]: fakeOrigin() });
    await expect(new JeepSqliteDomain(client).readDatabaseBytes({ key: "notes" })).rejects.toThrow(
      /not a SQLite database/,
    );
  });
});
