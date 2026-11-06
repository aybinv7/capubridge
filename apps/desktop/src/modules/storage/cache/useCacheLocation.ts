import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export const CACHE_STORAGE_ROUTE = "storage-cache-storage";

function param(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

/** The cache the tab shows (`?cache=`), kept in the address so links and Back work. */
export function useCacheLocation() {
  const route = useRoute();
  const router = useRouter();

  const cache = computed(() => param(route.query["cache"]));

  /** Opens a cache, or the overview with `null`. */
  function open(name: string | null) {
    if ((name ?? "") === cache.value) return;
    void router.push({ name: CACHE_STORAGE_ROUTE, query: name ? { cache: name } : {} });
  }

  return { cache, open };
}
