import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { OPFSDomain, OPFSFilesDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { withReadTimeout } from "@/modules/storage/frame/useDataPresence";

const FOLDER_CACHE_MS = 30_000;
const WALK_TIMEOUT_MS = 15_000;

/** The error of a read as a sentence, or `null`. */
export function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/** The OPFS domains of a target, or a plain error when its DevTools link is gone. */
export function useOpfsDomains(targetId: Ref<string>) {
  const { getClient } = useCDP();
  function client() {
    const found = getClient(targetId.value);
    if (!found) throw new Error("The DevTools link to this page is closed");
    return found;
  }
  return {
    files: () => new OPFSFilesDomain(client()),
    bytes: () => new OPFSDomain(client()),
  };
}

function readAtOf(updatedAt: number): number | null {
  return updatedAt > 0 ? updatedAt : null;
}

/** Every folder of the page's OPFS, for the sidebar. Reads wait while `paused`. */
export function useOpfsFolders(targetId: Ref<string>, paused: Ref<boolean>) {
  const domains = useOpfsDomains(targetId);
  const query = useQuery({
    queryKey: computed(() => ["opfs-folders", targetId.value]),
    queryFn: () => withReadTimeout(domains.files().folders(), WALK_TIMEOUT_MS),
    enabled: computed(() => Boolean(targetId.value) && !paused.value),
    retry: false,
  });
  return {
    tree: computed(() => query.data.value),
    loading: computed(() => query.isLoading.value),
    fetching: computed(() => query.isFetching.value),
    error: computed(() => errorText(query.error.value)),
    readAt: computed(() => readAtOf(query.dataUpdatedAt.value)),
    refetch: () => query.refetch(),
  };
}

/**
 * The entries of one folder. Rows of another folder never stay on screen while this one is read,
 * so a delete can only reach the folder its rows were read from.
 */
export function useOpfsFolder(
  targetId: Ref<string>,
  origin: Ref<string>,
  path: Ref<string>,
  paused: Ref<boolean>,
) {
  const domains = useOpfsDomains(targetId);
  const query = useQuery({
    queryKey: computed(() => ["opfs-folder", targetId.value, origin.value, path.value]),
    queryFn: () => withReadTimeout(domains.files().folder(path.value, origin.value || null)),
    enabled: computed(() => Boolean(targetId.value && origin.value) && !paused.value),
    gcTime: FOLDER_CACHE_MS,
    retry: false,
  });
  return {
    listing: computed(() => query.data.value),
    loading: computed(() => query.isLoading.value),
    fetching: computed(() => query.isFetching.value),
    /** No rows of this folder are on screen yet. */
    pending: computed(() => query.data.value === undefined),
    error: query.error,
    readAt: computed(() => readAtOf(query.dataUpdatedAt.value)),
    refetch: () => query.refetch(),
  };
}

/** The databases a SAH-Pool folder holds, decoded from each slot's header. */
export function useOpfsPool(
  targetId: Ref<string>,
  path: Ref<string>,
  enabled: Ref<boolean>,
  paused: Ref<boolean>,
) {
  const domains = useOpfsDomains(targetId);
  const query = useQuery({
    queryKey: computed(() => ["opfs-sah-pool", targetId.value, path.value]),
    queryFn: () => withReadTimeout(domains.bytes().listSahPoolDatabases(path.value)),
    enabled: computed(() => Boolean(targetId.value) && enabled.value && !paused.value),
    gcTime: FOLDER_CACHE_MS,
    retry: false,
  });
  return {
    databases: computed(() => query.data.value ?? []),
    loading: computed(() => query.isLoading.value),
    pending: computed(() => query.data.value === undefined),
    error: computed(() => errorText(query.error.value)),
    refetch: () => query.refetch(),
  };
}
