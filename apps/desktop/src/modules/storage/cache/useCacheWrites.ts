import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { CacheExpectation, CacheStorageDomain } from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { CacheRow } from "./cacheModel";
import {
  cacheWrites,
  deleteCacheQuestion,
  deleteEntriesQuestion,
  withVersions,
} from "./cacheWrites";

/**
 * Deletes for the cache on screen. The origin and the cache are fixed for the life of the
 * screen that shows them, so a delete can only reach the cache its rows were read from. Deletes
 * wait while the entries are still being read and while the app is away, and say why.
 */
export function useCacheWrites(options: {
  origin: string;
  cacheName: string;
  domain: () => CacheStorageDomain;
  /** No rows of this cache are on screen yet. */
  pending: Ref<boolean>;
  /** Why the phone cannot answer now, or `null`. */
  away: Ref<string | null>;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  /** After entries were deleted: which are gone, and whether the list can be patched (`exact`). */
  afterEntries: (removed: readonly string[], exact: boolean) => void;
  afterCache: () => void;
}) {
  const busy = ref(false);

  const blockedReason = computed(() => {
    if (options.away.value) return options.away.value;
    if (options.pending.value) return "The entries are still being read.";
    return null;
  });

  function writer(onRemoved?: (ids: readonly string[], exact: boolean) => void) {
    const blocked = blockedReason.value;
    if (blocked) {
      toast.info("Nothing was deleted", { description: blocked });
      return null;
    }
    try {
      return cacheWrites(
        options.domain(),
        options.origin,
        options.cacheName,
        options.confirm,
        onRemoved,
      );
    } catch (error) {
      toast.error("Nothing was deleted", {
        description: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async function run<T>(task: () => Promise<T>): Promise<T> {
    busy.value = true;
    try {
      return await task();
    } finally {
      busy.value = false;
    }
  }

  /** Asks first, naming the entries and the cache; deletes only on yes. Resolves how many left. */
  async function confirmAndRemove(rows: readonly CacheRow[]): Promise<number> {
    if (rows.length === 0 || busy.value) return 0;
    if (blockedReason.value) {
      toast.info("Nothing was deleted", { description: blockedReason.value });
      return 0;
    }
    let seen: CacheRow[];
    try {
      seen = await run(() =>
        withVersions(options.domain(), options.origin, options.cacheName, rows),
      );
    } catch (error) {
      toast.error("Nothing was deleted", {
        description: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
    if (!(await options.confirm(deleteEntriesQuestion(seen, options.cacheName)))) return 0;
    let removedIds: readonly string[] = [];
    let exact = false;
    const writes = writer((ids, complete) => {
      removedIds = ids;
      exact = complete;
    });
    if (!writes) return 0;
    const removed = await run(() => writes.removeEntries(seen));
    options.afterEntries(removedIds, exact);
    return removed;
  }

  /** Asks first with what the cache holds; deletes it only on yes, if it still holds that. */
  async function confirmAndRemoveCache(expected: CacheExpectation | null): Promise<boolean> {
    if (busy.value) return false;
    if (blockedReason.value) {
      toast.info("Nothing was deleted", { description: blockedReason.value });
      return false;
    }
    const count = expected?.count ?? null;
    if (!(await options.confirm(deleteCacheQuestion(options.cacheName, count)))) return false;
    const writes = writer();
    if (!writes) return false;
    const removed = await run(() => writes.removeCache(expected));
    if (removed) options.afterCache();
    else options.afterEntries([], false);
    return removed;
  }

  return { blockedReason, busy, confirmAndRemove, confirmAndRemoveCache };
}
