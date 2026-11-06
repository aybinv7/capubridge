import { computed, watch } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { toast } from "vue-sonner";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { useSqliteTabsStore } from "@/modules/storage/stores/useSqliteTabsStore";
import { useSqliteUnsavedStore } from "@/modules/storage/stores/useSqliteUnsavedStore";
import { leaveQuestion } from "../sqliteUnsavedQuestion";
import { sqliteRouteTo, type SqliteTableView } from "../useSqliteLocation";
import type { useSqliteTab } from "../useSqliteTab";
import {
  EMPTY_TABS,
  investedIn,
  neighbourId,
  othersThan,
  OVERVIEW_ID,
  rightOf,
  tabIdOf,
  type SqliteQueryState,
  type SqliteTab,
  type SqliteTabSpec,
} from "./sqliteTabs";
import { sqliteWorkspaceKey } from "./sqliteWorkspace";

/**
 * The open database's tabs, kept in step with the address bar both ways. The address bar shows
 * the active tab, so deep links and reloads land on a tab; opening a table or a database tab
 * pushes a history entry and switching between open tabs replaces it, so Back goes to the table
 * you came from rather than through every tab you glanced at. A database opened again comes
 * back on the tab it was left on, and tabs of tables that are gone are dropped once, with a word.
 * Closing a tab with staged edits asks first; switching never does.
 */
export function useSqliteTabs(options: {
  tab: ReturnType<typeof useSqliteTab>;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
}) {
  const store = useSqliteTabsStore();
  const unsaved = useSqliteUnsavedStore();
  const router = useRouter();
  const { location, current, tables } = options.tab;

  const key = computed(() => {
    const open = current.value;
    return open ? sqliteWorkspaceKey(options.tab.scope.value, open.sourceId, open.db) : null;
  });
  const state = computed(() => (key.value ? store.tabs(key.value) : EMPTY_TABS));
  const tableNames = computed(() => new Set(tables.tables.value.map((table) => table.name)));

  const routeSpec = computed<SqliteTabSpec>(() => {
    const table = location.table.value;
    if (table) return { kind: "table", table, view: location.tableView.value };
    const view = location.databaseView.value;
    return view === "overview" ? { kind: "overview" } : { kind: view };
  });
  const activeId = computed(() => tabIdOf(routeSpec.value));

  const stagedTabs = computed(() => {
    const open = current.value;
    if (!open) return new Set<string>();
    return new Set(unsaved.stagedIn(open.sourceId).map((entry) => `table:${entry.table}`));
  });

  function routeOf(tab: SqliteTab | null): RouteLocationRaw | null {
    const target = location.target.value;
    if (!target) return null;
    if (!tab) return sqliteRouteTo(target);
    if (tab.kind === "table") {
      return sqliteRouteTo(
        target,
        tab.table ?? "",
        tab.view && tab.view !== "rows" ? tab.view : null,
      );
    }
    return sqliteRouteTo(target, "", tab.kind);
  }

  function tabById(id: string): SqliteTab | null {
    return state.value.tabs.find((tab) => tab.id === id) ?? null;
  }

  function go(id: string, push: boolean) {
    const route = routeOf(id === OVERVIEW_ID ? null : tabById(id));
    if (route) void (push ? router.push(route) : router.replace(route));
  }

  watch(
    [key, routeSpec],
    ([next, spec], [previous]) => {
      if (!next) return;
      if (next !== previous && spec.kind === "overview") {
        const stored = store.tabs(next);
        if (
          stored.activeId !== OVERVIEW_ID &&
          stored.tabs.some((tab) => tab.id === stored.activeId)
        ) {
          go(stored.activeId, false);
          return;
        }
      }
      store.open(next, spec, { preview: true, protect: stagedTabs.value });
    },
    { immediate: true },
  );

  let prunedFor: string | null = null;
  watch(
    [key, () => tables.loaded.value, tableNames],
    ([next, loaded, names]) => {
      if (!next || !loaded || prunedFor === next) return;
      prunedFor = next;
      const dropped = store.prune(next, names);
      if (dropped > 0) {
        toast.info(
          dropped === 1
            ? "1 tab closed: its table is gone"
            : `${dropped} tabs closed: their tables are gone`,
        );
      }
      const table = location.table.value;
      if (table && !names.has(table)) go(store.tabs(next).activeId, false);
    },
    { immediate: true },
  );

  watch(stagedTabs, (staged) => {
    const open = key.value;
    if (open) for (const id of staged) store.keep(open, id);
  });

  /** Opens a table in the preview tab, or as a kept tab (double-click, Enter, quick open). */
  function openTable(table: string, opts: { keep?: boolean; view?: SqliteTableView } = {}) {
    const open = key.value;
    if (!open || !table) return;
    store.open(
      open,
      { kind: "table", table, view: opts.view ?? "rows" },
      {
        preview: opts.keep !== true,
        protect: stagedTabs.value,
      },
    );
    go(`table:${table}`, location.table.value !== table);
  }

  /** Opens (or shows) the database's Overview, SQL or Diagram tab. */
  function openDatabaseTab(kind: "overview" | "sql" | "diagram") {
    const open = key.value;
    if (!open) return;
    const isNew = kind !== "overview" && !tabById(kind);
    store.open(open, { kind }, { preview: false, protect: stagedTabs.value });
    go(kind, isNew);
  }

  function select(id: string) {
    const open = key.value;
    if (!open || id === activeId.value) return;
    store.activate(open, id);
    go(id, false);
  }

  function keep(id: string) {
    if (key.value) store.keep(key.value, id);
  }

  /** Closes tabs, asking once when that drops staged edits. */
  async function close(ids: ReadonlySet<string>) {
    const open = key.value;
    const db = current.value;
    if (!open || !db || ids.size === 0) return;
    const tablesClosing = state.value.tabs
      .filter((tab) => ids.has(tab.id) && tab.kind === "table")
      .map((tab) => tab.table ?? "");
    const staged = unsaved
      .stagedIn(db.sourceId)
      .filter((entry) => tablesClosing.includes(entry.table));
    const question = leaveQuestion(
      staged,
      ids.size === 1 ? "Closing the tab drops them." : "Closing the tabs drops them.",
    );
    if (question) {
      if (!(await options.confirm(question))) return;
      for (const entry of staged) unsaved.discardIn(db.sourceId, entry.table);
    }
    const wasActive = ids.has(activeId.value);
    store.close(open, ids);
    if (wasActive) go(store.tabs(open).activeId, false);
  }

  function closeActive() {
    if (activeId.value !== OVERVIEW_ID) void close(new Set([activeId.value]));
  }

  function closeOthers(id: string) {
    void close(othersThan(state.value, id));
  }

  function closeToRight(id: string) {
    void close(rightOf(state.value, id));
  }

  function closeAll() {
    void close(new Set(state.value.tabs.map((tab) => tab.id)));
  }

  function reopen() {
    const open = key.value;
    if (!open) return;
    const tab = store.reopen(open);
    if (tab) go(tab.id, true);
  }

  function cycle(step: 1 | -1) {
    select(neighbourId({ ...state.value, activeId: activeId.value }, step));
  }

  /** A table tab's query changed: remember it, and keep the tab once the person invested in it. */
  function rememberQuery(table: string, query: SqliteQueryState) {
    const open = key.value;
    if (!open) return;
    const id = `table:${table}`;
    store.patch(open, id, { query });
    if (investedIn(query)) store.keep(open, id);
  }

  function queryOf(table: string): SqliteQueryState | undefined {
    return tabById(`table:${table}`)?.query;
  }

  return {
    state,
    activeId,
    stagedTabs,
    openTable,
    openDatabaseTab,
    select,
    keep,
    close,
    closeActive,
    closeOthers,
    closeToRight,
    closeAll,
    reopen,
    cycle,
    rememberQuery,
    queryOf,
  };
}
