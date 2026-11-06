import { describe, expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import type { KeyValueDomain } from "@capubridge/cdp-protocol";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));
vi.mock("@capubridge/cdp-protocol", () => ({
  KeyValueConflictError: class extends Error {},
  KeyValueDeleteError: class extends Error {},
}));

const { useKvWrites } = await import("../useKvWrites");
const { areaEntries, makeSource } = await import("../kvModel");

function setup(state: { pending: boolean; away: string | null }, answer = false) {
  const write = vi.fn().mockResolvedValue({ gone: false });
  const deleteMany = vi.fn(async (_target: unknown, items: unknown[]) => ({
    deleted: items.map((_item, index) => index),
    gone: [],
    changed: [],
  }));
  const afterWrite = vi.fn();
  const confirm = vi.fn().mockResolvedValue(answer);
  const writes = useKvWrites({
    source: makeSource({ kind: "local", origin: "https://app" }),
    domain: () => ({ write, deleteMany }) as unknown as KeyValueDomain,
    pending: ref(state.pending),
    away: ref(state.away),
    confirm,
    afterWrite,
  });
  return { writes, write, deleteMany, afterWrite, confirm };
}

describe("writes wait when the phone cannot be trusted to answer (U1)", () => {
  test("nothing is sent while the list is still being read", async () => {
    const { writes, write } = setup({ pending: true, away: null });
    await expect(writes.save({ entry: null, key: "a", value: "b" })).resolves.toBe("kept");
    expect(write).not.toHaveBeenCalled();
    expect(writes.blockedReason.value).toBe("The keys are still being read.");
  });

  test("nothing is sent while the app is away, and the reason is shown", async () => {
    const { writes, write } = setup({ pending: false, away: "The app is in the background" });
    await writes.save({ entry: null, key: "a", value: "b" });
    expect(write).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Nothing was saved", {
      description: "The app is in the background",
    });
  });

  test("a saved write reads the list again", async () => {
    const { writes, write, afterWrite } = setup({ pending: false, away: null });
    await expect(writes.save({ entry: null, key: "a", value: "b" })).resolves.toBe("saved");
    expect(write).toHaveBeenCalledTimes(1);
    expect(afterWrite).toHaveBeenCalledTimes(1);
  });
});

describe("deletes ask first", () => {
  const entries = () =>
    areaEntries([
      { key: "token", value: "x" },
      { key: "user", value: "y" },
    ]);

  test("nothing is deleted when the answer is no", async () => {
    const { writes, write, confirm } = setup({ pending: false, away: null }, false);
    const [first] = entries();
    await expect(writes.confirmAndRemove(first ? [first] : [], "Local storage")).resolves.toBe(0);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete “token”?",
        text: "“token” is deleted from Local storage on the phone. This cannot be undone.",
        danger: true,
      }),
    );
    expect(write).not.toHaveBeenCalled();
  });

  test("a delete blocked while the keys are read says nothing was deleted", async () => {
    const { writes, deleteMany } = setup({ pending: true, away: null }, true);
    const [first] = entries();
    await writes.confirmAndRemove(first ? [first] : [], "Local storage");
    expect(deleteMany).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Nothing was deleted", {
      description: "The keys are still being read.",
    });
  });

  test("every key asked about is deleted on yes", async () => {
    const { writes, deleteMany, confirm } = setup({ pending: false, away: null }, true);
    await expect(writes.confirmAndRemove(entries(), "Session storage")).resolves.toBe(2);
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({ title: "Delete 2 keys?" });
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });
});
