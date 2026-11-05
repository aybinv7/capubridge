import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { CDPClient } from "@capubridge/cdp-protocol";

const disk = vi.hoisted(() => ({ text: "", finished: false, discarded: false }));
const protocol = vi.hoisted(() => ({ exportStoreChunk: vi.fn() }));

vi.mock("@capubridge/cdp-protocol", () => protocol);
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn(), open: vi.fn() }));
vi.mock("@/runtime/ipc/client", () => ({ invokeCommand: vi.fn() }));
vi.mock("@/lib/streamedFile", () => ({
  openStreamedFile: async () => ({
    get bytes() {
      return disk.text.length;
    },
    write: async (text: string) => {
      disk.text += text;
    },
    finish: async () => {
      disk.finished = true;
      return disk.text.length;
    },
    discard: async () => {
      disk.discarded = true;
    },
  }),
}));

const { exportDatabaseToFile, parseIdbExport, writeExportCopy } = await import("../idbExportFile");

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
        { name: "empty", keyPath: { type: "null" }, autoIncrement: true, indexes: [] },
      ],
    },
  }),
} as unknown as CDPClient;

beforeEach(() => {
  disk.text = "";
  disk.finished = false;
  disk.discarded = false;
  protocol.exportStoreChunk.mockReset();
});

describe("exportDatabaseToFile (F2)", () => {
  test("streams a valid, compact file store by store and chunk by chunk", async () => {
    protocol.exportStoreChunk
      .mockResolvedValueOnce({ records: [{ key: 1, value: { id: 1 } }], next: 1, lossy: [] })
      .mockResolvedValueOnce({
        records: [{ key: 2, value: { id: 2, at: { __type: "Date", value: "x" } } }],
        next: null,
        lossy: ['Record 2: "e" is an Error'],
      })
      .mockResolvedValueOnce({ records: [], next: null, lossy: [] });
    const onProgress = vi.fn();
    const result = await exportDatabaseToFile(client, "https://app", "shop", "C:/x.json", {
      onProgress,
    });
    expect(disk.finished).toBe(true);
    expect(disk.text).not.toContain("\n");
    const parsed = parseIdbExport(disk.text);
    expect(parsed).toMatchObject({
      version: 2,
      encoding: "capubridge-markers-v1",
      origin: "https://app",
      lossy: ['orders · Record 2: "e" is an Error'],
      database: { name: "shop", version: 4 },
    });
    expect(parsed.database.stores.map((store) => store.records.length)).toEqual([2, 0]);
    expect(parsed.database.stores[1]).toMatchObject({ keyPath: null, autoIncrement: true });
    expect(result).toMatchObject({ records: 2 });
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: "export" }));
  });

  test("a failure leaves no file behind", async () => {
    protocol.exportStoreChunk.mockRejectedValueOnce(new Error("frozen"));
    await expect(exportDatabaseToFile(client, "https://app", "shop", "C:/x.json")).rejects.toThrow(
      "frozen",
    );
    expect(disk.discarded).toBe(true);
    expect(disk.finished).toBe(false);
  });

  test("an opened file is written again as the same data", async () => {
    const data = parseIdbExport(
      JSON.stringify({
        format: "capubridge-idb-export",
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        origin: "https://app",
        database: {
          name: "old",
          version: 2,
          stores: [
            {
              name: "s",
              keyPath: null,
              autoIncrement: false,
              indexes: [],
              records: [{ key: 1, value: 2 }],
            },
          ],
        },
      }),
    );
    await writeExportCopy(data, "C:/copy.json");
    const copy = parseIdbExport(disk.text);
    expect(copy.version).toBe(1);
    expect(copy.database).toEqual(data.database);
  });
});
