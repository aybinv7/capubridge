import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type {
  KeyValueDeleteItem,
  KeyValueDeleteResult,
  KeyValueDomain,
  KeyValueWriteInput,
} from "@capubridge/cdp-protocol";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));
vi.mock("@capubridge/cdp-protocol", () => ({
  KeyValueDeleteError: class extends Error {},
  KeyValueConflictError: class extends Error {
    constructor(
      readonly conflict: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const { KeyValueConflictError } = await import("@capubridge/cdp-protocol");
const { kvWrites } = await import("../kvWrites");
const { areaEntries, makeSource } = await import("../kvModel");

const source = makeSource({ kind: "local", origin: "https://app" });
const [token] = areaEntries([{ key: "token", value: "old" }]);

function domain(write: (input: KeyValueWriteInput) => Promise<{ gone: boolean }>) {
  const calls: KeyValueWriteInput[] = [];
  return {
    calls,
    domain: {
      write: vi.fn((_target: unknown, input: KeyValueWriteInput) => {
        calls.push({ ...input });
        return write(input);
      }),
    } as unknown as KeyValueDomain,
  };
}

const conflict = (kind: string) => new KeyValueConflictError(kind as never, `${kind} on the phone`);

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  toast.info.mockReset();
});

describe("saving a key", () => {
  test("reports success only after the phone answered", async () => {
    let answer: () => void = () => undefined;
    const { domain: device } = domain(
      () => new Promise((resolve) => (answer = () => resolve({ gone: false }))),
    );
    const pending = kvWrites(device, source, vi.fn()).save({
      entry: token ?? null,
      key: "token",
      value: "new",
    });
    expect(toast.success).not.toHaveBeenCalled();
    answer();
    await expect(pending).resolves.toBe("saved");
    expect(toast.success).toHaveBeenCalledWith("Saved “token” on the phone");
  });

  test("sends what the person saw, so the phone can refuse a changed value", async () => {
    const { domain: device, calls } = domain(async () => ({ gone: false }));
    await kvWrites(device, source, vi.fn()).save({
      entry: token ?? null,
      key: "token",
      value: "new",
    });
    expect(calls[0]).toMatchObject({ op: "set", key: "token", expected: "old" });
  });

  test("a new key that exists asks first and keeps the phone's value on no", async () => {
    const { domain: device, calls } = domain(async () => {
      throw conflict("exists");
    });
    const confirm = vi.fn().mockResolvedValue(false);
    const outcome = await kvWrites(device, source, confirm).save({
      entry: null,
      key: "token",
      value: "x",
    });
    expect(outcome).toBe("kept");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ expected: null });
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Replace the value of “token”?" }),
    );
  });

  test("a rename onto a taken key replaces it only after a yes", async () => {
    let first = true;
    const { domain: device, calls } = domain(async () => {
      if (first) {
        first = false;
        throw conflict("exists");
      }
      return { gone: false };
    });
    const outcome = await kvWrites(device, source, vi.fn().mockResolvedValue(true)).save({
      entry: token ?? null,
      key: "other",
      value: "old",
    });
    expect(outcome).toBe("saved");
    expect(calls[0]).toMatchObject({ op: "rename", nextKey: "other" });
    expect(calls[0]?.replaceExisting).toBeUndefined();
    expect(calls[1]).toMatchObject({ replaceExisting: true });
  });

  test("a value the app changed is asked about on its own, then written over on yes", async () => {
    const answers = [conflict("exists"), conflict("changed")];
    const { domain: device, calls } = domain(async () => {
      const next = answers.shift();
      if (next) throw next;
      return { gone: false };
    });
    const confirm = vi.fn().mockResolvedValue(true);
    await kvWrites(device, source, confirm).save({
      entry: token ?? null,
      key: "other",
      value: "x",
    });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1]?.[0]).toMatchObject({ confirmLabel: "Save mine over it" });
    expect(calls[2]).toMatchObject({ replaceExisting: true, overwriteChanged: true });
  });

  test("a device error is reported and the edit kept", async () => {
    const { domain: device } = domain(async () => {
      throw new Error("QuotaExceededError");
    });
    await expect(
      kvWrites(device, source, vi.fn()).save({ entry: null, key: "a", value: "b" }),
    ).resolves.toBe("failed");
    expect(toast.error).toHaveBeenCalledWith("Nothing was saved", {
      description: "QuotaExceededError",
    });
  });
});

describe("deleting keys", () => {
  const entries = areaEntries([
    { key: "a", value: "1" },
    { key: "b", value: "2" },
    { key: "c", value: "3" },
  ]);

  function deleter(results: KeyValueDeleteResult[]) {
    const calls: { items: KeyValueDeleteItem[]; force: boolean }[] = [];
    const device = {
      deleteMany: vi.fn(
        async (_target: unknown, items: KeyValueDeleteItem[], options: { force?: boolean }) => {
          calls.push({ items, force: options.force === true });
          const next = results.shift();
          if (!next) throw new Error("gone wrong");
          return next;
        },
      ),
    } as unknown as KeyValueDomain;
    return { device, calls };
  }

  test("sends what the person saw, so the phone keeps a value the app changed", async () => {
    const { device, calls } = deleter([{ deleted: [0, 2], gone: [], changed: [1] }]);
    const confirm = vi.fn().mockResolvedValue(false);
    const removed = await kvWrites(device, source, confirm).remove(entries);
    expect(calls[0]?.items).toEqual([
      { key: "a", expected: "1" },
      { key: "b", expected: "2" },
      { key: "c", expected: "3" },
    ]);
    expect(calls[0]?.force).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "“b” changed on the phone" }),
    );
    expect(calls).toHaveLength(1);
    expect(removed).toBe(2);
    expect(toast.success).toHaveBeenCalledWith("Deleted 2 keys on the phone", {
      description: "1 changed on the phone and was kept.",
    });
  });

  test("a yes deletes only the changed keys, forced", async () => {
    const { device, calls } = deleter([
      { deleted: [0], gone: [2], changed: [1] },
      { deleted: [0], gone: [], changed: [] },
    ]);
    const removed = await kvWrites(device, source, vi.fn().mockResolvedValue(true)).remove(entries);
    expect(calls[1]).toEqual({ items: [{ key: "b", expected: "2" }], force: true });
    expect(removed).toBe(3);
  });

  test("a failure says how many were deleted before it", async () => {
    const { device } = deleter([]);
    const removed = await kvWrites(device, source, vi.fn()).remove(entries);
    expect(removed).toBe(0);
    expect(toast.error).toHaveBeenCalledWith("No key was deleted", { description: "gone wrong" });
  });
});
