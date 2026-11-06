import { computed, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { CacheStorageDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { withReadTimeout } from "@/modules/storage/frame/useDataPresence";
import { toRow, type CacheRow } from "./cacheModel";

interface CacheEntriesData {
  rows: CacheRow[];
  total: number;
  described: number;
  /** `null` once rows were taken off without a read: a whole-cache delete then checks the count. */
  fingerprint: string | null;
}

const ENTRIES_CACHE_MS = 30_000;
const ENTRY_CACHE_MS = 2_000;

/**
 * Lets TanStack Query drop a read the screen no longer wants: the phone may still finish it,
 * but its answer is ignored and the next read starts at once.
 */
function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Read dropped", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const drop = () => reject(new DOMException("Read dropped", "AbortError"));
    signal.addEventListener("abort", drop, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener("abort", drop));
  });
}

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
  const queryClient = useQueryClient();
  const key = computed(() => [
    "cache-storage-entries",
    targetId.value,
    origin.value,
    cacheName.value,
  ]);
  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<CacheEntriesData> => {
      const page = await withReadTimeout(domain().entries(origin.value, cacheName.value), 15_000);
      return {
        rows: page.entries.map(toRow),
        total: page.total,
        described: page.described,
        fingerprint: page.fingerprint,
      };
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
    fingerprint: computed(() => query.data.value?.fingerprint ?? null),
    loading: computed(() => query.isLoading.value),
    fetching: computed(() => query.isFetching.value),
    /** No rows of this cache are on screen yet. */
    pending: computed(() => query.data.value === undefined),
    error: computed(() => errorText(query.error.value)),
    readAt: computed(() => (query.dataUpdatedAt.value > 0 ? query.dataUpdatedAt.value : null)),
    refetch: () => query.refetch(),
    /** Takes rows off the list on screen after the phone deleted them, without a new read. */
    drop: (ids: readonly string[]) => {
      if (ids.length === 0) return;
      const gone = new Set(ids);
      queryClient.setQueryData<CacheEntriesData>(key.value, (data) => {
        if (!data) return data;
        const rows = data.rows.filter((row) => !gone.has(row.id));
        const removed = data.rows.length - rows.length;
        return { ...data, rows, total: data.total - removed, fingerprint: null };
      });
    },
  };
}

/**
 * One entry in full (headers, and up to `bodyBytes` of its body; 0 reads none), read when the
 * pane shows it. A read the pane moved away from is cancelled, and kept only briefly.
 */
export function useCacheEntry(
  targetId: Ref<string>,
  origin: Ref<string>,
  cacheName: Ref<string>,
  entryId: Ref<string | null>,
  bodyBytes: Ref<number>,
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
      bodyBytes.value,
    ]),
    queryFn: ({ signal }) =>
      withReadTimeout(
        abortable(
          domain().entry(origin.value, cacheName.value, entryId.value ?? "", bodyBytes.value),
          signal,
        ),
      ),
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
