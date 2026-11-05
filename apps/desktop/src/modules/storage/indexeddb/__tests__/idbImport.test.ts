import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { CDPClient } from "@capubridge/cdp-protocol";
import type { IdbExportedDatabase } from "../idbTransfer.types";

const calls = vi.hoisted(() => ({ log: [] as string[] }));

const protocol = vi.hoisted(() => {
  class IdbBlockedError extends Error {}
  return {
    IdbBlockedError,
    importStageBegin: vi.fn(),
    importStageBinary: vi.fn(),
    importPutChunk: vi.fn(),
    importReplaceSchema: vi.fn(),
    importCopyChunk: vi.fn(),
    importStageDiscard: vi.fn(),
  };
});
vi.mock("@capubridge/cdp-protocol", () => protocol);

const { importDatabaseReplace, finishImport, IdbPartialImportError } = await import("../idbImport");

const client = {} as CDPClient;

function file(version: 1 | 2, records = 3): IdbExportedDatabase {
  return {
    format: "capubridge-idb-export",
    version,
    ...(version === 2 ? { encoding: "capubridge-markers-v1" as const, lossy: [] } : {}),
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
        { name: "notes", keyPath: null, autoIncrement: false, indexes: [], records: [] },
      ],
    },
  };
}

beforeEach(() => {
  calls.log = [];
  const log =
    (name: string, result?: unknown) =>
    async (_client: CDPClient, params: Record<string, unknown>) => {
      calls.log.push(`${name}:${JSON.stringify(params["store"] ?? params["stage"] ?? "")}`);
      return typeof result === "function" ? (result as (p: unknown) => unknown)(params) : result;
    };
  protocol.importStageBegin.mockReset().mockImplementation(log("stage"));
  protocol.importStageBinary.mockReset().mockImplementation(log("binary"));
  protocol.importPutChunk
    .mockReset()
    .mockImplementation(log("put", (params: { records: unknown[] }) => params.records.length));
  protocol.importReplaceSchema.mockReset().mockImplementation(log("replace"));
  protocol.importCopyChunk.mockReset().mockImplementation(log("copy", { copied: 3, next: null }));
  protocol.importStageDiscard.mockReset().mockImplementation(log("discard"));
});

describe("importDatabaseReplace (S3)", () => {
  test("writes the whole file to a scratch database before touching the real one", async () => {
    const onCommit = vi.fn();
    await importDatabaseReplace(client, file(2), "shop", "https://app", { onCommit });
    const order = calls.log.map((entry) => entry.split(":")[0]);
    expect(order.indexOf("replace")).toBeGreaterThan(order.lastIndexOf("put"));
    expect(order.at(-1)).toBe("discard");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(protocol.importReplaceSchema).toHaveBeenCalledWith(client, {
      origin: "https://app",
      schema: expect.objectContaining({ name: "shop", version: 4 }),
    });
  });

  test("a record the phone refuses leaves the real database untouched", async () => {
    protocol.importPutChunk.mockRejectedValueOnce(new Error("ConstraintError"));
    await expect(importDatabaseReplace(client, file(2), "shop", "https://app")).rejects.toThrow(
      "ConstraintError",
    );
    expect(protocol.importReplaceSchema).not.toHaveBeenCalled();
    expect(protocol.importStageDiscard).toHaveBeenCalledTimes(1);
  });

  test("a cancel before the replace changes nothing", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      importDatabaseReplace(client, file(2), "shop", "https://app", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(protocol.importReplaceSchema).not.toHaveBeenCalled();
  });

  test("a failure while copying says the database is partial and can be finished", async () => {
    protocol.importCopyChunk
      .mockImplementationOnce(async () => ({ copied: 3, next: null }))
      .mockRejectedValueOnce(new Error("QuotaExceededError"));
    const error = await importDatabaseReplace(client, file(2), "shop", "https://app").catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(IdbPartialImportError);
    const pending = (error as InstanceType<typeof IdbPartialImportError>).state;
    expect(pending).toMatchObject({ phase: "copy", fromStore: 1, target: "shop" });
    expect((error as Error).message).toContain("orders is written");
    expect(protocol.importStageDiscard).not.toHaveBeenCalled();

    protocol.importReplaceSchema.mockClear();
    await finishImport(client, pending);
    expect(protocol.importReplaceSchema).not.toHaveBeenCalled();
    expect(protocol.importCopyChunk.mock.calls.at(-1)?.[1]).toMatchObject({ store: "notes" });
    expect(protocol.importStageDiscard).toHaveBeenCalledTimes(1);
  });

  test("refuses a lossy file unless the loss was accepted, and says how much", async () => {
    await expect(importDatabaseReplace(client, file(1), "shop", "https://app")).rejects.toThrow(
      /^Refused: one value/,
    );
    expect(protocol.importStageBegin).not.toHaveBeenCalled();
    await importDatabaseReplace(client, file(1), "shop", "https://app", { acceptLoss: true });
    expect(protocol.importPutChunk.mock.calls[0]?.[1]).toMatchObject({
      revive: false,
      acceptLoss: true,
    });
  });
});
