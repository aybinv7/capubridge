import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { CacheStorageDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { withReadTimeout } from "@/modules/storage/frame/useDataPresence";
import { toRow } from "./cacheModel";

const ENTRIES_CACHE_MS = 30_000;
const ENTRY_CACHE_MS = 15_000;

/** The error of a read as a sentence, or `null`. */
export function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/** The Cache storage domain of a target, or a plain error when its DevTools link is gone. */
export function useCacheDomain(targetId: Ref<string>) {
  const { getClient } = useCDP();
  return function domain(): CacheStorageDomain {
    const client = getClient(targetId.value);
    if (!client) throw new Error("The DevTools link to this page is closed");
    return new CacheStorageDomain(client);
  };
}

/** The page's caches with their counts. Reads wait while `paused`. */
export function useCacheCatalog(targetId: Ref<string>, paused: Ref<boolean>) {
  const domain = useCacheDomain(targetId);
  const query = useQuery({
    queryKey: computed(() => ["cache-storage", targetId.value]),
    queryFn: () => withReadTimeout(domain().catalog()),
    enabled: computed(() => Boolean(targetId.value) && !paused.value),
    retry: false,
  });
  return {
    catalog: computed(() => query.data.value),
    loading: computed(() => query.isLoading.value),
    fetching: computed(() => query.isFetching.value),
    error: computed(() => errorText(query.error.value)),
    readAt: computed(() => (query.dataUpdatedAt.value > 0 ? query.dataUpdatedAt.value : null)),
    refetch: () => query.refetch(),
  };
}

/**
 * The entries of one cache. Rows of another cache never stay on screen while this one is read,
 * so a delete can only reach the cache its rows were read from.
 */
export function useCacheEntries(
  targetId: Ref<string>,
  origin: Ref<string>,
  cacheName: Ref<string>,
  paused: Ref<boolean>,
) {
  const domain = useCacheDomain(targetId);
  const query = useQuery({
    queryKey: computed(() => [
      "cache-storage-entries",
      targetId.value,
      origin.value,
      cacheName.value,
    ]),
    queryFn: async () => {
      const page = await withReadTimeout(domain().entries(origin.value, cacheName.value), 15_000);
      return { rows: page.entries.map(toRow), total: page.total, described: page.described };
    },
    enabled: computed(
      () => Boolean(targetId.value && origin.value && cacheName.value) && !paused.value,
    ),
    gcTime: ENTRIES_CACHE_MS,
    retry: false,
  });
  return {
    rows: computed(() => query.data.value?.rows ?? []),
    total: computed(() => query.data.value?.total ?? null),
    described: computed(() => query.data.value?.described ?? null),
    loading: computed(() => query.isLoading.value),
    fetching: computed(() => query.isFetching.value),
    /** No rows of this cache are on screen yet. */
    pending: computed(() => query.data.value === undefined),
    error: computed(() => errorText(query.error.value)),
    readAt: computed(() => (query.dataUpdatedAt.value > 0 ? query.dataUpdatedAt.value : null)),
    refetch: () => query.refetch(),
  };
}

/** One entry in full (headers and the start of its body), read when the pane shows it. */
export function useCacheEntry(
  targetId: Ref<string>,
  origin: Ref<string>,
  cacheName: Ref<string>,
  entryId: Ref<string | null>,
  paused: Ref<boolean>,
) {
  const domain = useCacheDomain(targetId);
  const query = useQuery({
    queryKey: computed(() => [
      "cache-storage-entry",
      targetId.value,
      origin.value,
      cacheName.value,
      entryId.value ?? "",
    ]),
    queryFn: () =>
      withReadTimeout(domain().entry(origin.value, cacheName.value, entryId.value ?? "")),
    enabled: computed(() => Boolean(targetId.value && entryId.value) && !paused.value),
    gcTime: ENTRY_CACHE_MS,
    retry: false,
  });
  return {
    detail: computed(() => query.data.value),
    loading: computed(() => query.isLoading.value),
    fetching: computed(() => query.isFetching.value),
    error: query.error,
    refetch: () => query.refetch(),
  };
}
