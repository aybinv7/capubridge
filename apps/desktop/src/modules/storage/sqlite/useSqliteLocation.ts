import { computed } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import { routeParam } from "./sqliteDatabaseRef";

export const SQLITE_ROUTE = "storage-sqlite";
export const SQLITE_FILE_ROUTE = "storage-sqlite-file";

export type SqliteDatabaseView = "overview" | "sql" | "diagram";
export type SqliteTableView = "rows" | "structure" | "sql";

const DATABASE_VIEWS: readonly SqliteDatabaseView[] = ["overview", "sql", "diagram"];
const TABLE_VIEWS: readonly SqliteTableView[] = ["rows", "structure", "sql"];

/** Where a database lives in the address bar: a phone or page database, or an opened file. */
export type SqliteDatabaseTarget = { kind: "device"; path: string } | { kind: "file"; id: string };

/** The route that opens `target` (and a table of it, and a view), for links from other tabs. */
export function sqliteRouteTo(
  target: SqliteDatabaseTarget,
  table = "",
  view: string | null = null,
): RouteLocationRaw {
  const query = view ? { view } : {};
  if (target.kind === "file") {
    return { name: SQLITE_FILE_ROUTE, params: { file: target.id, table }, query };
  }
  return { name: SQLITE_ROUTE, params: { db: target.path, table }, query };
}

/**
 * The SQLite tab's place, both ways: the database (its path for a phone or page database, its
 * id for an opened file, never a bare name that two databases could share), the table, and the
 * view. Router params arrive decoded once; nothing here decodes them again.
 */
export function useSqliteLocation() {
  const route = useRoute();
  const router = useRouter();

  const onFileRoute = computed(() => route.name === SQLITE_FILE_ROUTE);
  const fileId = computed(() => (onFileRoute.value ? routeParam(route.params["file"]) : ""));
  const databaseParam = computed(() => (onFileRoute.value ? "" : routeParam(route.params["db"])));
  const table = computed(() => routeParam(route.params["table"]));

  const target = computed<SqliteDatabaseTarget | null>(() => {
    if (fileId.value) return { kind: "file", id: fileId.value };
    if (databaseParam.value) return { kind: "device", path: databaseParam.value };
    return null;
  });

  const databaseView = computed<SqliteDatabaseView>(() => {
    const asked = routeParam(route.query["view"]);
    return DATABASE_VIEWS.find((view) => view === asked) ?? "overview";
  });
  const tableView = computed<SqliteTableView>(() => {
    const asked = routeParam(route.query["view"]);
    return TABLE_VIEWS.find((view) => view === asked) ?? "rows";
  });

  function open(next: SqliteDatabaseTarget | null, nextTable = "", replace = false) {
    const location = next ? sqliteRouteTo(next, nextTable) : { name: SQLITE_ROUTE };
    void (replace ? router.replace(location) : router.push(location));
  }

  function setView(view: SqliteDatabaseView | SqliteTableView) {
    const current = target.value;
    if (!current) return;
    const landing = table.value ? "rows" : "overview";
    void router.replace(sqliteRouteTo(current, table.value, view === landing ? null : view));
  }

  return {
    onFileRoute,
    fileId,
    databaseParam,
    table,
    target,
    databaseView,
    tableView,
    open,
    setView,
  };
}
