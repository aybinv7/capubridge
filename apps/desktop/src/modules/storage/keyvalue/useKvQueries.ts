import { computed, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { KeyValueDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { withReadTimeout } from "@/modules/storage/frame/useDataPresence";
import {
  areaEntries,
  forageEntries,
  patchEntries,
  type KvChange,
  type KvReadResult,
  type KvSource,
} from "./kvModel";

const ENTRIES_CACHE_MS = 30_000;
const CATALOG_FRESH_MS = 10_000;

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/** The key-value domain of a target, or a plain error when its DevTools link is gone. */
export function useKvDomain(targetId: Ref<string>) {
  const { getClient } = useCDP();
  return function domain(): KeyValueDomain {
    const client = getClient(targetId.value);
    if (!client) throw new Error("The DevTools link to this page is closed");
    return new KeyValueDomain(client);
  };
}

const plainDatabases = new Map<string, readonly string[]>();

/**
 * Every key-value source of the page, read again on demand. Reads wait while `paused`. The
 * databases found not to be LocalForage are remembered per target, so a read again does not
 * open them a second time (a new version of one is looked at again).
 */
export function useKvCatalog(targetId: Ref<string>, paused: Ref<boolean>) {
  const domain = useKvDomain(targetId);
  const query = useQuery({
    queryKey: computed(() => ["kv-sources", targetId.value]),
    queryFn: async () => {
      const target = targetId.value;
      const found = await withReadTimeout(
        domain().discover({ skip: plainDatabases.get(target) ?? [] }),
      );
      plainDatabases.set(target, found.plainDatabases);
      return found;
    },
    enabled: computed(() => Boolean(targetId.value) && !paused.value),
    staleTime: CATALOG_FRESH_MS,
    retry: false,
  });
  return {
    discovery: computed(() => query.data.value),
    loading: computed(() => query.isLoading.value),
    error: computed(() => errorText(query.error.value)),
    refetch: () => query.refetch(),
  };
}

async function readSource(domain: KeyValueDomain, source: KvSource): Promise<KvReadResult> {
  if (source.kind === "forage") {
    const page = await domain.readForage(source.origin, source.database ?? "", source.store ?? "");
    return { entries: forageEntries(page), more: page.more, total: page.total };
  }
  const entries = areaEntries(await domain.readArea(source.origin, source.kind));
  return { entries, more: false, total: entries.length };
}

/**
 * The keys of one list. The rows of another list never stay on screen while this one is read,
 * so an edit can only be made to the list it was read from.
 */
export function useKvEntries(
  targetId: Ref<string>,
  source: Ref<KvSource | null>,
  paused: Ref<boolean>,
) {
  const domain = useKvDomain(targetId);
  const queryClient = useQueryClient();
  const key = computed(() => ["kv-entries", targetId.value, source.value?.id ?? ""]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => {
      const current = source.value;
      if (!current) throw new Error("No list is open");
      return withReadTimeout(readSource(domain(), current));
    },
    enabled: computed(() => Boolean(targetId.value && source.value) && !paused.value),
    gcTime: ENTRIES_CACHE_MS,
    retry: false,
  });
  return {
    entries: computed(() => query.data.value?.entries ?? []),
    more: computed(() => query.data.value?.more ?? false),
    total: computed(() => query.data.value?.total ?? null),
    loading: computed(() => query.isLoading.value),
    fetching: computed(() => query.isFetching.value),
    /** No rows of this list are on screen yet. */
    pending: computed(() => query.data.value === undefined),
    error: computed(() => errorText(query.error.value)),
    readAt: computed(() => (query.dataUpdatedAt.value > 0 ? query.dataUpdatedAt.value : null)),
    refetch: () => query.refetch(),
    /**
     * Follows a write on the list on screen without reading every value again; reads again
     * only when the list cannot be patched (a LocalForage save, or a partial read).
     */
    apply: (change: KvChange) => {
      const current = query.data.value;
      const kind = source.value?.kind;
      const next =
        current && kind && !current.more ? patchEntries(current.entries, change, kind) : null;
      if (!current || !next) {
        void query.refetch();
        return;
      }
      queryClient.setQueryData<KvReadResult>(key.value, {
        entries: next,
        more: false,
        total: next.length,
      });
    },
  };
}
