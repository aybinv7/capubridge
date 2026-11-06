import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import type { CacheStorageDomain } from "@capubridge/cdp-protocol";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));
vi.mock("@capubridge/cdp-protocol", () => ({
  CacheStorageGoneError: class extends Error {},
  CacheStorageChangedError: class extends Error {
    constructor(
      message: string,
      readonly count: number,
    ) {
      super(message);
    }
  },
}));

const { CacheStorageChangedError, CacheStorageGoneError } =
  await import("@capubridge/cdp-protocol");
const { cacheWrites } = await import("../cacheWrites");
const { useCacheWrites } = await import("../useCacheWrites");
const { toRow } = await import("../cacheModel");
const { entry } = await import("./cacheFixtures");

const ORIGIN = "https://localhost";
const rowA = toRow(entry({ id: "a", url: "https://localhost/api/a" }));
const rowB = toRow(entry({ id: "b", url: "https://localhost/api/b" }));

function device(
  overrides: Partial<Record<"deleteEntries" | "deleteCache", ReturnType<typeof vi.fn>>>,
) {
  const deleteEntries = overrides.deleteEntries ?? vi.fn();
  const deleteCache = overrides.deleteCache ?? vi.fn();
  return {
    deleteEntries,
    deleteCache,
    domain: { deleteEntries, deleteCache } as unknown as CacheStorageDomain,
  };
}

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  toast.info.mockReset();
});

describe("deleting entries", () => {
  test("sends each entry with the response the person saw, to the cache on screen", async () => {
    const { domain, deleteEntries } = device({
      deleteEntries: vi.fn().mockResolvedValue({ deleted: ["a"], gone: [], changed: [] }),
    });
    await expect(cacheWrites(domain, ORIGIN, "api", vi.fn()).removeEntries([rowA])).resolves.toBe(
      1,
    );
    expect(deleteEntries).toHaveBeenCalledWith(ORIGIN, "api", [{ id: "a", version: "v-a" }]);
    expect(toast.success).toHaveBeenCalledWith("Deleted “a” on the phone");
  });

  test("an entry the app replaced is kept unless the person agrees", async () => {
    const { domain, deleteEntries } = device({
      deleteEntries: vi.fn().mockResolvedValue({ deleted: [], gone: [], changed: ["a"] }),
    });
    const confirm = vi.fn().mockResolvedValue(false);
    await expect(cacheWrites(domain, ORIGIN, "api", confirm).removeEntries([rowA])).resolves.toBe(
      0,
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "This entry changed on the phone" }),
    );
    expect(deleteEntries).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith("Nothing was deleted", {
      description: "The app's new response was kept.",
    });
  });

  test("forces only the changed entries once the person agrees", async () => {
    const deleteEntries = vi
      .fn()
      .mockResolvedValueOnce({ deleted: ["b"], gone: [], changed: ["a"] })
      .mockResolvedValueOnce({ deleted: ["a"], gone: [], changed: [] });
    const { domain } = device({ deleteEntries });
    const removed = await cacheWrites(
      domain,
      ORIGIN,
      "api",
      vi.fn().mockResolvedValue(true),
    ).removeEntries([rowA, rowB]);
    expect(removed).toBe(2);
    expect(deleteEntries).toHaveBeenLastCalledWith(
      ORIGIN,
      "api",
      [{ id: "a", version: "v-a" }],
      true,
    );
    expect(toast.success).toHaveBeenCalledWith("Deleted 2 entries on the phone", {
      description: undefined,
    });
  });

  test("an entry already gone is said, and a failure carries the phone's words", async () => {
    const gone = device({
      deleteEntries: vi.fn().mockResolvedValue({ deleted: [], gone: ["a"], changed: [] }),
    });
    await cacheWrites(gone.domain, ORIGIN, "api", vi.fn()).removeEntries([rowA]);
    expect(toast.info).toHaveBeenCalledWith("“a” was already gone from the phone");
    const failing = device({
      deleteEntries: vi.fn().mockRejectedValue(new Error("The phone did not answer")),
    });
    await expect(
      cacheWrites(failing.domain, ORIGIN, "api", vi.fn()).removeEntries([rowA]),
    ).resolves.toBe(0);
    expect(toast.error).toHaveBeenCalledWith("The entry was not deleted", {
      description: "The phone did not answer",
    });
  });
});

describe("deleting a cache", () => {
  test("a cache that changed since the read is kept unless the person agrees", async () => {
    const deleteCache = vi
      .fn()
      .mockRejectedValueOnce(new CacheStorageChangedError("now 5", 5))
      .mockResolvedValueOnce({ gone: false });
    const { domain } = device({ deleteCache });
    const refuse = vi.fn().mockResolvedValue(false);
    await expect(cacheWrites(domain, ORIGIN, "api", refuse).removeCache(3)).resolves.toBe(false);
    expect(refuse).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "It now holds 5 entries, not the 3 entries you saw. Delete the cache anyway?",
      }),
    );
    expect(deleteCache).toHaveBeenCalledTimes(1);
  });

  test("forces the delete once the person agrees", async () => {
    const deleteCache = vi
      .fn()
      .mockRejectedValueOnce(new CacheStorageChangedError("now 5", 5))
      .mockResolvedValueOnce({ gone: false });
    const { domain } = device({ deleteCache });
    await expect(
      cacheWrites(domain, ORIGIN, "api", vi.fn().mockResolvedValue(true)).removeCache(3),
    ).resolves.toBe(true);
    expect(deleteCache).toHaveBeenLastCalledWith(ORIGIN, "api", 3, true);
    expect(toast.success).toHaveBeenCalledWith("Deleted the cache “api” on the phone");
  });

  test("a cache already gone counts as gone", async () => {
    const { domain } = device({
      deleteCache: vi.fn().mockRejectedValue(new CacheStorageGoneError("gone")),
    });
    await expect(cacheWrites(domain, ORIGIN, "api", vi.fn()).removeCache(3)).resolves.toBe(true);
    expect(toast.info).toHaveBeenCalledWith("The cache “api” was already gone");
  });
});

describe("deletes wait when the phone cannot be trusted to answer, and always ask first", () => {
  function setup(state: { pending: boolean; away: string | null }, answer: boolean) {
    const deleteEntries = vi.fn().mockResolvedValue({ deleted: ["a"], gone: [], changed: [] });
    const deleteCache = vi.fn().mockResolvedValue({ gone: false });
    const confirm = vi.fn().mockResolvedValue(answer);
    const afterCache = vi.fn();
    const writes = useCacheWrites({
      origin: ORIGIN,
      cacheName: "api",
      domain: () => ({ deleteEntries, deleteCache }) as unknown as CacheStorageDomain,
      pending: ref(state.pending),
      away: ref(state.away),
      confirm,
      afterEntries: vi.fn(),
      afterCache,
    });
    return { writes, deleteEntries, deleteCache, confirm, afterCache };
  }

  test("nothing is sent while the entries are still being read", async () => {
    const { writes, deleteEntries, confirm } = setup({ pending: true, away: null }, true);
    await expect(writes.confirmAndRemove([rowA])).resolves.toBe(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteEntries).not.toHaveBeenCalled();
    expect(writes.blockedReason.value).toBe("The entries are still being read.");
  });

  test("nothing is sent while the app is away, and the reason is shown", async () => {
    const { writes, deleteCache } = setup(
      { pending: false, away: "The app is in the background" },
      true,
    );
    await expect(writes.confirmAndRemoveCache(3)).resolves.toBe(false);
    expect(deleteCache).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Nothing was deleted", {
      description: "The app is in the background",
    });
  });

  test("a delete the person cancels sends nothing", async () => {
    const { writes, deleteEntries, deleteCache, confirm } = setup(
      { pending: false, away: null },
      false,
    );
    await writes.confirmAndRemove([rowA]);
    await writes.confirmAndRemoveCache(3);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({ title: "Delete “a”?", danger: true });
    expect(confirm.mock.calls[1]?.[0]).toMatchObject({
      title: "Delete the cache “api”?",
      text: expect.stringContaining("and its 3 entries"),
    });
    expect(deleteEntries).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
  });

  test("a confirmed cache delete reaches the cache on screen with the count seen", async () => {
    const { writes, deleteCache, afterCache } = setup({ pending: false, away: null }, true);
    await expect(writes.confirmAndRemoveCache(3)).resolves.toBe(true);
    expect(deleteCache).toHaveBeenCalledWith(ORIGIN, "api", 3, false);
    expect(afterCache).toHaveBeenCalled();
  });
});
