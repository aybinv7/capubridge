import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export type IdbMode = "live" | "file";

/** What a database shows when no store is open. */
export type IdbDatabaseView = "overview" | "diagram";

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
  const databaseView = computed<IdbDatabaseView>(() =>
    param(route.query["view"]) === "diagram" ? "diagram" : "overview",
  );

  function open(target: IdbMode, databaseOrFile: string, storeName = "") {
    const params: Record<string, string> = {};
    if (databaseOrFile) params["db"] = databaseOrFile;
    if (databaseOrFile && storeName) params["store"] = storeName;
    void router.push({ name: target === "file" ? FILE : LIVE, params });
  }

  /** Shows the open database's overview or diagram, in the address bar so Back returns to it. */
  function setDatabaseView(view: IdbDatabaseView) {
    void router.replace({
      name: route.name ?? LIVE,
      params: route.params,
      query: view === "overview" ? {} : { view },
    });
  }

  /** The address of a store of a database, for links from the diagram. */
  function storePath(target: IdbMode, databaseOrFile: string, storeName: string): string {
    return router.resolve({
      name: target === "file" ? FILE : LIVE,
      params: { db: databaseOrFile, store: storeName },
    }).fullPath;
  }

  function replaceRoot(target: IdbMode = "live") {
    void router.replace({ name: target === "file" ? FILE : LIVE });
  }

  return { mode, database, store, databaseView, open, setDatabaseView, storePath, replaceRoot };
}
