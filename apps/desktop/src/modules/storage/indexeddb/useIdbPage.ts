import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain, type IDBRecord } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { cellToText } from "@/shared/components/data/grid";
import { withReadTimeout } from "@/modules/storage/frame/useDataPresence";
import { indexedDbProtocolPageSize } from "./idbPaging";
import type { IdbOpenDatabase } from "./useIdbCatalog";

const FILE_READ_ONLY = "Opened from a file: it is read-only here.";
const STORE_SEARCH_LIMIT = 500;
/** Pages of other offsets are dropped soon after they leave the screen. */
const PAGE_CACHE_MS = 15_000;

export interface StoreSearchState {
  needle: string;
  running: boolean;
  records: IDBRecord[];
  scanned: number;
  capped: "count" | "time" | "limit" | "cancelled" | null;
  error: string | null;
}

/**
 * Whether a page read for `previous` may stay on screen while `next` is read: only for the same
 * phone, origin, database and store (another page or page size of it), never across stores.
 */
export function keepsPreviousPage(previous: readonly unknown[], next: readonly unknown[]): boolean {
  return [1, 2, 3, 4].every((index) => previous[index] === next[index]);
}

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/**
 * The records of one store, a page at a time: live pages come from the phone (the previous
 * page stays on screen while the next one is read), file pages from the opened export. A
 * whole-store search replaces the page with its matches until it is cleared.
 */
export function useIdbPage(options: {
  targetId: Ref<string>;
  open: Ref<IdbOpenDatabase | null>;
  store: Ref<string>;
  /** No reads while true (the app is away from the screen); they run again after. */
  paused?: Ref<boolean>;
}) {
  const { getClient } = useCDP();
  const page = ref(0);
  const pageSize = ref(50);
  const storeSearch = shallowRef<StoreSearchState | null>(null);
  let searchTicket = 0;
  let runningToken: string | null = null;

  const isLive = computed(() => options.open.value?.mode === "live");
  const database = computed(() => options.open.value?.name ?? "");
  const origin = computed(() => options.open.value?.origin ?? "");

  function domain(): IDBDomain {
    const client = getClient(options.targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new IDBDomain(client);
  }

  const queryKey = computed(() => [
    "idb-records",
    options.targetId.value,
    origin.value,
    database.value,
    options.store.value,
    page.value,
    pageSize.value,
  ]);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      withReadTimeout(
        domain().getData({
          securityOrigin: origin.value,
          databaseName: database.value,
          objectStoreName: options.store.value,
          skipCount: page.value * pageSize.value,
          pageSize: pageSize.value,
        }),
      ),
    enabled: computed(
      () =>
        isLive.value &&
        !options.paused?.value &&
        Boolean(options.targetId.value && origin.value && database.value && options.store.value),
    ),
    gcTime: PAGE_CACHE_MS,
    placeholderData: (previous, previousQuery) =>
      previous && previousQuery && keepsPreviousPage(previousQuery.queryKey, queryKey.value)
        ? previous
        : undefined,
    retry: false,
  });

  const fileStore = computed(() => {
    const file = options.open.value?.file;
    return file?.data.database.stores.find((store) => store.name === options.store.value);
  });

  function fromFile(record: { key: unknown; value: unknown }): IDBRecord {
    return {
      key: record.key as IDBValidKey,
      value: record.value,
      editable: false,
      readOnlyReason: FILE_READ_ONLY,
    };
  }

  const pageRecords = computed<IDBRecord[]>(() => {
    if (!isLive.value) {
      const all = fileStore.value?.records ?? [];
      const start = page.value * pageSize.value;
      return all.slice(start, start + pageSize.value).map(fromFile);
    }
    return query.data.value?.records ?? [];
  });

  const hasMore = computed(() => {
    if (!isLive.value)
      return (page.value + 1) * pageSize.value < (fileStore.value?.records.length ?? 0);
    return query.data.value?.hasMore ?? false;
  });

  const records = computed<IDBRecord[]>(() => storeSearch.value?.records ?? pageRecords.value);

  watch([() => options.open.value?.id, options.store], () => {
    page.value = 0;
    clearStoreSearch();
  });

  function setPage(next: number) {
    page.value = Math.max(0, next);
  }

  function setPageSize(size: number) {
    pageSize.value = indexedDbProtocolPageSize(size);
    page.value = 0;
  }

  function searchFile(needle: string): StoreSearchState {
    const lower = needle.toLowerCase();
    const all = fileStore.value?.records ?? [];
    const matches = all.filter(
      (record) =>
        cellToText(record.key).toLowerCase().includes(lower) ||
        cellToText(record.value).toLowerCase().includes(lower),
    );
    return {
      needle,
      running: false,
      records: matches.slice(0, STORE_SEARCH_LIMIT).map(fromFile),
      scanned: all.length,
      capped: matches.length > STORE_SEARCH_LIMIT ? "limit" : null,
      error: null,
    };
  }

  /** Searches every record of the store on the phone (bounded by count and time). */
  async function searchWholeStore(needle: string) {
    const trimmed = needle.trim();
    if (!trimmed) return;
    if (!isLive.value) {
      storeSearch.value = searchFile(trimmed);
      return;
    }
    cancelRunningSearch();
    searchTicket += 1;
    const ticket = searchTicket;
    const token = `search-${Date.now().toString(36)}-${ticket}`;
    runningToken = token;
    storeSearch.value = {
      needle: trimmed,
      running: true,
      records: [],
      scanned: 0,
      capped: null,
      error: null,
    };
    try {
      const result = await domain().searchStore({
        securityOrigin: origin.value,
        databaseName: database.value,
        objectStoreName: options.store.value,
        needle: trimmed,
        limit: STORE_SEARCH_LIMIT,
        token,
      });
      if (runningToken === token) runningToken = null;
      if (ticket !== searchTicket) return;
      storeSearch.value = { needle: trimmed, running: false, error: null, ...result };
    } catch (error) {
      if (runningToken === token) runningToken = null;
      if (ticket !== searchTicket) return;
      storeSearch.value = {
        needle: trimmed,
        running: false,
        records: [],
        scanned: 0,
        capped: null,
        error: errorText(error),
      };
    }
  }

  function cancelRunningSearch() {
    const token = runningToken;
    runningToken = null;
    if (!token) return;
    const client = getClient(options.targetId.value);
    if (!client) return;
    new IDBDomain(client).cancelSearch(token).catch((error: unknown) => {
      console.warn("Could not stop the store search on the phone", error);
    });
  }

  function clearStoreSearch() {
    cancelRunningSearch();
    searchTicket += 1;
    storeSearch.value = null;
  }

  onScopeDispose(cancelRunningSearch);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    hasMore,
    records,
    pageRecords,
    isLive,
    storeSearch,
    searchWholeStore,
    clearStoreSearch,
    /** The page on screen is the previous one of this store, kept while the next is read. */
    placeholder: computed(() => isLive.value && query.isPlaceholderData.value),
    loading: computed(() => isLive.value && query.isLoading.value),
    fetching: computed(() => isLive.value && query.isFetching.value),
    error: computed(() => (isLive.value ? errorText(query.error.value) : null)),
    readAt: computed(() => (isLive.value ? query.dataUpdatedAt.value || null : null)),
    refetch: () => (isLive.value ? query.refetch() : Promise.resolve()),
    domain,
  };
}
