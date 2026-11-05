import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { CDPClient } from "@capubridge/cdp-protocol";
import {
  exportDatabase,
  exportLoss,
  importDatabaseReplace,
  parseIdbExport,
  type IdbExportedDatabase,
} from "../idbImportExport";

const protocol = vi.hoisted(() => ({
  exportStoreChunk: vi.fn(),
  importPutChunk: vi.fn(),
  importReplaceSchema: vi.fn(),
}));
vi.mock("@capubridge/cdp-protocol", () => protocol);
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn(), open: vi.fn() }));
vi.mock("@/runtime/ipc/client", () => ({ invokeCommand: vi.fn() }));

const client = {
  send: vi.fn().mockResolvedValue({
    databaseWithObjectStores: {
      name: "shop",
      version: 4,
      objectStores: [
        {
          name: "orders",
          keyPath: { type: "string", string: "id" },
          autoIncrement: false,
          indexes: [],
        },
      ],
    },
  }),
} as unknown as CDPClient;

function file(version: 1 | 2, records = 3, lossy: string[] = []): IdbExportedDatabase {
  return {
    format: "capubridge-idb-export",
    version,
    ...(version === 2 ? { encoding: "capubridge-markers-v1" as const, lossy } : {}),
    exportedAt: "2026-11-05T00:00:00.000Z",
    origin: "https://app",
    database: {
      name: "shop-from-file",
      version: 4,
      stores: [
        {
          name: "orders",
          keyPath: "id",
          autoIncrement: false,
          indexes: [],
          records: Array.from({ length: records }, (_, id) => ({ key: id, value: { id } })),
        },
      ],
    },
  };
}

beforeEach(() => {
  protocol.exportStoreChunk.mockReset();
  protocol.importPutChunk
    .mockReset()
    .mockImplementation(
      async (_client: CDPClient, params: { records: unknown[] }) => params.records.length,
    );
  protocol.importReplaceSchema.mockReset().mockResolvedValue(undefined);
});

describe("importDatabaseReplace", () => {
  test("refuses an older, lossy export unless the loss is accepted", async () => {
    await expect(importDatabaseReplace(client, file(1), "shop")).rejects.toThrow(/^Refused: /);
    expect(protocol.importReplaceSchema).not.toHaveBeenCalled();
    await expect(
      importDatabaseReplace(client, file(1), "shop", { acceptLoss: true }),
    ).resolves.toEqual({ inserted: 3 });
    expect(protocol.importPutChunk.mock.calls[0]?.[1]).toMatchObject({ revive: false });
  });

  test("refuses a version 2 export that lists lossy values", async () => {
    const lossy = file(2, 1, [
      'orders: "failure" is an Error (only its name and message are kept)',
    ]);
    await expect(importDatabaseReplace(client, lossy, "shop")).rejects.toThrow("Refused: orders:");
  });

  test("replaces the database the user chose, not the one named in the file", async () => {
    await importDatabaseReplace(client, file(2), "shop");
    expect(protocol.importReplaceSchema).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ name: "shop", version: 4 }),
    );
    expect(protocol.importPutChunk).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ database: "shop", store: "orders", keyPath: "id", revive: true }),
    );
  });

  test("writes in chunks of 1,000 and reports progress", async () => {
    const onProgress = vi.fn();
    const result = await importDatabaseReplace(client, file(2, 2500), "shop", { onProgress });
    expect(result).toEqual({ inserted: 2500 });
    expect(protocol.importPutChunk).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls.map(([progress]) => progress.records)).toEqual([1000, 2000, 2500]);
  });

  test("stops between chunks when cancelled", async () => {
    const controller = new AbortController();
    const onProgress = vi.fn(() => controller.abort());
    await expect(
      importDatabaseReplace(client, file(2, 2500), "shop", {
        onProgress,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(protocol.importPutChunk).toHaveBeenCalledTimes(1);
  });
});

describe("exportDatabase", () => {
  test("reads every chunk, reports progress and keeps the loss list", async () => {
    protocol.exportStoreChunk
      .mockResolvedValueOnce({ records: [{ key: 1, value: {} }], next: 1, lossy: [] })
      .mockResolvedValueOnce({ records: [{ key: 2, value: {} }], next: null, lossy: ["x"] });
    const onProgress = vi.fn();
    const data = await exportDatabase(client, "https://app", "shop", { onProgress });
    expect(protocol.exportStoreChunk.mock.calls[1]?.[1]).toMatchObject({ after: 1 });
    expect(data).toMatchObject({
      version: 2,
      encoding: "capubridge-markers-v1",
      lossy: ["orders: x"],
      database: { name: "shop", version: 4 },
    });
    expect(data.database.stores[0]?.records).toHaveLength(2);
    expect(onProgress).toHaveBeenLastCalledWith({
      store: "orders",
      storeIndex: 0,
      storeCount: 1,
      records: 2,
    });
  });
});

describe("export files", () => {
  test("a version 1 file always says what it lost", () => {
    expect(exportLoss(file(1))).toHaveLength(1);
    expect(exportLoss(file(2))).toEqual([]);
  });

  test("rejects other files and newer formats", () => {
    expect(() => parseIdbExport("{}")).toThrow("Not a Capubridge IndexedDB export file");
    expect(() =>
      parseIdbExport(JSON.stringify({ format: "capubridge-idb-export", version: 3 })),
    ).toThrow("newer Capubridge");
    expect(parseIdbExport(JSON.stringify(file(1))).version).toBe(1);
  });
});
