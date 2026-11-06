import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { normalizePath } from "./opfsSources";

export const OPFS_ROUTE = "storage-opfs";

function param(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

/**
 * The folder the tab shows (`?path=`), both ways: links such as the SQLite source badge land on
 * it, and every folder opened here is written back, so Back and reload return to it.
 */
export function useOpfsLocation() {
  const route = useRoute();
  const router = useRouter();

  const path = computed(() => normalizePath(param(route.query["path"])));

  /** Opens a folder; the root with `""`. */
  function open(next: string) {
    const target = normalizePath(next);
    if (target === path.value) return;
    void router.push({ name: OPFS_ROUTE, query: target ? { path: target } : {} });
  }

  return { path, open };
}
