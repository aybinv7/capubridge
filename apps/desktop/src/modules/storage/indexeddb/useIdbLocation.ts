import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export type IdbMode = "live" | "file";

const LIVE = "storage-indexeddb";
const FILE = "storage-indexeddb-snapshot";

function param(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

/**
 * Where the IndexedDB tab is: a live database on the phone or an opened export file, and the
 * store inside it. Route params arrive decoded from vue-router and are used as they are.
 */
export function useIdbLocation() {
  const route = useRoute();
  const router = useRouter();

  const mode = computed<IdbMode>(() => (route.name === FILE ? "file" : "live"));
  const database = computed(() => param(route.params["db"]));
  const store = computed(() => param(route.params["store"]));

  function open(target: IdbMode, databaseOrFile: string, storeName = "") {
    const params: Record<string, string> = {};
    if (databaseOrFile) params["db"] = databaseOrFile;
    if (databaseOrFile && storeName) params["store"] = storeName;
    void router.push({ name: target === "file" ? FILE : LIVE, params });
  }

  function replaceRoot(target: IdbMode = "live") {
    void router.replace({ name: target === "file" ? FILE : LIVE });
  }

  return { mode, database, store, open, replaceRoot };
}
