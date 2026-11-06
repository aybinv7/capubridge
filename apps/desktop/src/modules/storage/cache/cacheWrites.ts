import { toast } from "vue-sonner";
import {
  CacheStorageChangedError,
  CacheStorageGoneError,
  type CacheExpectation,
  type CacheStorageDeleteResult,
  type CacheStorageDomain,
} from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { CacheRow } from "./cacheModel";

function quoted(text: string): string {
  return `“${text}”`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The question every entry delete asks first, naming the entry (or how many) and the cache. */
export function deleteEntriesQuestion(
  rows: readonly CacheRow[],
  cacheName: string,
): ConfirmRequest {
  const single = rows.length === 1 ? rows[0] : undefined;
  return {
    title: single ? `Delete ${quoted(single.name)}?` : `Delete ${rows.length} entries?`,
    text: single
      ? `${single.method} ${single.url} is deleted from the cache ${quoted(cacheName)} on the phone. The app fetches it again the next time it needs it, or fails offline. This cannot be undone.`
      : `${rows.length} entries are deleted from the cache ${quoted(cacheName)} on the phone. The app fetches them again the next time it needs them, or fails offline. This cannot be undone.`,
    confirmLabel: single ? "Delete entry" : `Delete ${rows.length} entries`,
    danger: true,
  };
}

/**
 * The rows with the response fingerprint the phone holds now for those the list read did not
 * reach, read just before the person is asked, so the delete checks what they agreed to.
 */
export async function withVersions(
  domain: CacheStorageDomain,
  origin: string,
  cacheName: string,
  rows: readonly CacheRow[],
): Promise<CacheRow[]> {
  const unread = rows.filter((row) => row.version === "").map((row) => row.id);
  if (unread.length === 0) return [...rows];
  const versions = await domain.versions(origin, cacheName, unread);
  return rows.map((row) =>
    row.version === "" ? { ...row, version: versions[row.id] ?? "" } : row,
  );
}

/** The question a cache delete asks first, with what it holds. */
export function deleteCacheQuestion(cacheName: string, count: number | null): ConfirmRequest {
  const holds = count === null ? "" : ` and its ${plural(count, "entry", "entries")}`;
  return {
    title: `Delete the cache ${quoted(cacheName)}?`,
    text: `The cache${holds} is deleted on the phone. A service worker may build it again on its next install or fetch. This cannot be undone.`,
    confirmLabel: "Delete cache",
    danger: true,
  };
}

function changedEntriesQuestion(count: number): ConfirmRequest {
  return {
    title:
      count === 1 ? "This entry changed on the phone" : `${count} entries changed on the phone`,
    text: "The app saved a new response after the list was read, so it is not what you saw. Delete the new response anyway?",
    confirmLabel: count === 1 ? "Delete it anyway" : "Delete them anyway",
    danger: true,
  };
}

function changedCacheQuestion(cacheName: string, seen: number | null, now: number): ConfirmRequest {
  let was = "";
  if (seen !== null) {
    was =
      seen === now
        ? ", but not the ones you saw"
        : `, not the ${plural(seen, "entry", "entries")} you saw`;
  }
  return {
    title: `${quoted(cacheName)} changed on the phone`,
    text: `It now holds ${plural(now, "entry", "entries")}${was}. Delete the cache anyway?`,
    confirmLabel: "Delete it anyway",
    danger: true,
  };
}

/**
 * Deletes for the cache on screen. The phone refuses what the person did not see (an entry the
 * app replaced, a cache that gained or lost entries); each refusal is asked about in plain words
 * and only then forced. Success is reported after the phone answered.
 */
export function cacheWrites(
  domain: CacheStorageDomain,
  origin: string,
  cacheName: string,
  confirm: (request: ConfirmRequest) => Promise<boolean>,
) {
  /** Deletes `rows`; resolves how many are no longer in the cache (deleted or already gone). */
  async function removeEntries(rows: readonly CacheRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const targets = rows.map((row) => ({ id: row.id, version: row.version }));
    let done: CacheStorageDeleteResult;
    try {
      done = await domain.deleteEntries(origin, cacheName, targets);
    } catch (error) {
      toast.error(rows.length === 1 ? "The entry was not deleted" : "No entry was deleted", {
        description: messageOf(error),
      });
      return 0;
    }
    if (done.changed.length > 0 && (await confirm(changedEntriesQuestion(done.changed.length)))) {
      const again = targets.filter((target) => done.changed.includes(target.id));
      try {
        const forced = await domain.deleteEntries(origin, cacheName, again, true);
        done = {
          deleted: [...done.deleted, ...forced.deleted],
          gone: [...done.gone, ...forced.gone],
          changed: forced.changed,
          shared: [...done.shared, ...forced.shared],
          failed: [...done.failed, ...forced.failed],
          extra: done.extra + forced.extra,
        };
      } catch (error) {
        done = {
          ...done,
          failed: [
            ...done.failed,
            ...again.map((target) => ({ id: target.id, error: messageOf(error) })),
          ],
          changed: [],
        };
      }
    }
    reportEntries(rows, done);
    return done.deleted.length + done.gone.length;
  }

  function reportEntries(rows: readonly CacheRow[], done: CacheStorageDeleteResult) {
    const deleted = done.deleted.length;
    const gone = done.gone.length;
    const kept = done.changed.length;
    const shared = done.shared.length;
    const failed = done.failed.length;
    const single = rows.length === 1 ? rows[0] : undefined;
    if (single && done.extra === 0) {
      if (deleted === 1) toast.success(`Deleted ${quoted(single.name)} on the phone`);
      else if (gone === 1) toast.info(`${quoted(single.name)} was already gone from the phone`);
      else if (shared === 1) {
        toast.info("Nothing was deleted", {
          description:
            "The phone would also delete another entry for the same address that you did not choose.",
        });
      } else if (failed === 1) {
        toast.error("The entry was not deleted", { description: done.failed[0]?.error });
      } else toast.info("Nothing was deleted", { description: "The app's new response was kept." });
      return;
    }
    const parts = [
      gone > 0 ? `${plural(gone, "was", "were")} already gone` : "",
      kept > 0 ? `${kept} changed on the phone and ${kept === 1 ? "was" : "were"} kept` : "",
      shared > 0
        ? `${shared} kept because the phone would also delete entries you did not choose`
        : "",
      failed > 0 ? `${failed} failed: ${done.failed[0]?.error ?? ""}` : "",
      done.extra > 0
        ? `the phone also removed ${plural(done.extra, "other entry", "other entries")} matching the same request`
        : "",
    ].filter(Boolean);
    const description = parts.length ? `${parts.join("; ")}.` : undefined;
    if (deleted > 0) {
      const say = failed > 0 || done.extra > 0 ? toast.error : toast.success;
      say(`Deleted ${plural(deleted, "entry", "entries")} on the phone`, { description });
    } else if (failed > 0) {
      toast.error("No entry was deleted", { description });
    } else {
      toast.info("Nothing was deleted", { description });
    }
  }

  /** Deletes the whole cache; resolves `true` when it is no longer on the phone. */
  async function removeCache(expected: CacheExpectation | null): Promise<boolean> {
    let force = false;
    for (;;) {
      try {
        const result = await domain.deleteCache(origin, cacheName, expected, force);
        if (result.gone) toast.info(`The cache ${quoted(cacheName)} was already gone`);
        else toast.success(`Deleted the cache ${quoted(cacheName)} on the phone`);
        return true;
      } catch (error) {
        if (error instanceof CacheStorageGoneError) {
          toast.info(`The cache ${quoted(cacheName)} was already gone`);
          return true;
        }
        if (error instanceof CacheStorageChangedError && !force) {
          const seen = expected?.count ?? null;
          if (!(await confirm(changedCacheQuestion(cacheName, seen, error.count)))) {
            toast.info("Nothing was deleted", { description: "The cache was kept." });
            return false;
          }
          force = true;
          continue;
        }
        toast.error("The cache was not deleted", { description: messageOf(error) });
        return false;
      }
    }
  }

  return { removeEntries, removeCache };
}
