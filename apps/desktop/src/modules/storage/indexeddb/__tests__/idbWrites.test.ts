import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { IDBDomain } from "@capubridge/cdp-protocol";
import { idbWrites } from "../idbWrites";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));

const at = { origin: "https://app", database: "db", store: "items" };

function domain(overrides: Partial<Record<"putRecord" | "deleteRecord", unknown>> = {}) {
  return {
    putRecord: vi.fn().mockResolvedValue(undefined),
    deleteRecord: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IDBDomain;
}

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("idbWrites", () => {
  test("reports success only after the device accepted the write", async () => {
    let resolveWrite: () => void = () => undefined;
    const putRecord = vi.fn(() => new Promise<void>((resolve) => (resolveWrite = resolve)));
    const pending = idbWrites(domain({ putRecord }), at).save({ key: 1, value: { a: 1 } });
    expect(toast.success).not.toHaveBeenCalled();
    resolveWrite();
    await expect(pending).resolves.toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Record saved on the device");
  });

  test("reports the device error instead of success", async () => {
    const putRecord = vi.fn().mockRejectedValue(new Error("DataError"));
    await expect(idbWrites(domain({ putRecord }), at).save({ key: 1, value: 1 })).resolves.toBe(
      false,
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Record was not saved", {
      description: "Error: DataError",
    });
  });

  test("never sends a read-only record", async () => {
    const putRecord = vi.fn();
    const record = { key: 1, value: 1, editable: false, readOnlyReason: "Blob value" };
    await idbWrites(domain({ putRecord }), at).save(record);
    expect(putRecord).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Record is read-only", { description: "Blob value" });
  });

  test("keeps deleting after a failure and counts what happened", async () => {
    const deleteRecord = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("gone"))
      .mockResolvedValueOnce(undefined);
    const deleted = await idbWrites(domain({ deleteRecord }), at).remove([1, 2, 3]);
    expect(deleted).toBe(2);
    expect(deleteRecord).toHaveBeenCalledTimes(3);
    expect(toast.error).toHaveBeenCalledWith("1 of 3 deletes failed", {
      description: "Error: gone",
    });
  });
});
