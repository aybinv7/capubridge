import type { ColumnFilterOperator } from "../browse/sqliteQuery";

export type SqliteTabKind = "overview" | "table" | "sql" | "diagram";
export type SqliteTabView = "rows" | "structure" | "sql";

/** What a table tab was narrowed and ordered by, kept so a tab comes back as it was left. */
export interface SqliteQueryState {
  search: string;
  where: string;
  filters: { column: string; operator: ColumnFilterOperator; value?: unknown }[];
  orderBy: string | null;
  orderDir: "ASC" | "DESC" | null;
  groupBy: string | null;
  page: number;
  pageSize: number;
  hidden: string[];
}

export interface SqliteTab {
  id: string;
  kind: SqliteTabKind;
  table?: string;
  view?: SqliteTabView;
  /** A preview tab (italic) is replaced by the next table opened with a single click. */
  preview: boolean;
  query?: SqliteQueryState;
  /** When it was last shown (ms), to let the least used go first past the cap. */
  usedAt: number;
}

export interface SqliteTabsState {
  /** Closable tabs in strip order; the Overview is always first and is not in this list. */
  tabs: SqliteTab[];
  activeId: string;
  /** Closed tabs, most recent first, for Reopen closed tab. */
  closed: SqliteTab[];
}

export const OVERVIEW_ID = "overview";
export const TABS_CAP = 12;
export const CLOSED_CAP = 10;

export const EMPTY_TABS: SqliteTabsState = { tabs: [], activeId: OVERVIEW_ID, closed: [] };

export type SqliteTabSpec =
  | { kind: "table"; table: string; view?: SqliteTabView }
  | { kind: "sql" }
  | { kind: "diagram" }
  | { kind: "overview" };

export function tabIdOf(spec: SqliteTabSpec): string {
  return spec.kind === "table" ? `table:${spec.table}` : spec.kind;
}

/** The default query of a table tab: what a tab with no invested change looks like. */
export const DEFAULT_QUERY: SqliteQueryState = {
  search: "",
  where: "",
  filters: [],
  orderBy: null,
  orderDir: null,
  groupBy: null,
  page: 0,
  pageSize: 50,
  hidden: [],
};

/** Whether the person invested in a tab's query (a search, a filter, a sort, a hidden column…). */
export function investedIn(query: SqliteQueryState): boolean {
  return (
    query.search !== "" ||
    query.where !== "" ||
    query.filters.length > 0 ||
    query.orderBy !== null ||
    query.groupBy !== null ||
    query.pageSize !== DEFAULT_QUERY.pageSize ||
    query.hidden.length > 0
  );
}

function capped(state: SqliteTabsState, keep: ReadonlySet<string>): SqliteTabsState {
  if (state.tabs.length <= TABS_CAP) return state;
  const removable = state.tabs
    .filter((tab) => tab.id !== state.activeId && !keep.has(tab.id))
    .sort((a, b) => a.usedAt - b.usedAt);
  const drop = new Set(removable.slice(0, state.tabs.length - TABS_CAP).map((tab) => tab.id));
  return { ...state, tabs: state.tabs.filter((tab) => !drop.has(tab.id)) };
}

/**
 * Opens a tab, VS Code's way. An open tab is activated, never duplicated (and kept when asked).
 * A new table tab opened as a preview replaces the current preview in place; anything else is
 * added right of the active tab. Past the cap the least recently used tab goes, never the active
 * one nor one in `protect` (staged edits).
 */
export function openTab(
  state: SqliteTabsState,
  spec: SqliteTabSpec,
  options: { preview: boolean; now: number; protect?: ReadonlySet<string> },
): SqliteTabsState {
  const id = tabIdOf(spec);
  if (spec.kind === "overview") return { ...state, activeId: OVERVIEW_ID };
  const view = spec.kind === "table" ? spec.view : undefined;
  const existing = state.tabs.find((tab) => tab.id === id);
  if (existing) {
    const updated: SqliteTab = {
      ...existing,
      preview: existing.preview && options.preview,
      usedAt: options.now,
      ...(view ? { view } : {}),
    };
    return {
      ...state,
      tabs: state.tabs.map((tab) => (tab.id === id ? updated : tab)),
      activeId: id,
    };
  }
  const tab: SqliteTab = {
    id,
    kind: spec.kind,
    ...(spec.kind === "table" ? { table: spec.table, view: view ?? "rows" } : {}),
    preview: spec.kind === "table" && options.preview,
    usedAt: options.now,
  };
  const previewAt = tab.preview ? state.tabs.findIndex((entry) => entry.preview) : -1;
  let tabs: SqliteTab[];
  if (previewAt >= 0) {
    tabs = state.tabs.map((entry, index) => (index === previewAt ? tab : entry));
  } else {
    const activeAt = state.tabs.findIndex((entry) => entry.id === state.activeId);
    tabs = [...state.tabs];
    tabs.splice(activeAt + 1, 0, tab);
  }
  return capped({ ...state, tabs, activeId: id }, options.protect ?? new Set());
}

export function keepTab(state: SqliteTabsState, id: string): SqliteTabsState {
  if (!state.tabs.some((tab) => tab.id === id && tab.preview)) return state;
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, preview: false } : tab)),
  };
}

export function activateTab(state: SqliteTabsState, id: string, now: number): SqliteTabsState {
  if (id === OVERVIEW_ID) return { ...state, activeId: OVERVIEW_ID };
  if (!state.tabs.some((tab) => tab.id === id)) return state;
  return {
    ...state,
    activeId: id,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, usedAt: now } : tab)),
  };
}

function rememberClosed(closed: readonly SqliteTab[], gone: readonly SqliteTab[]): SqliteTab[] {
  const ids = new Set(gone.map((tab) => tab.id));
  return [...[...gone].reverse(), ...closed.filter((tab) => !ids.has(tab.id))].slice(0, CLOSED_CAP);
}

/** Closes tabs; the focus moves to the tab right of the active one, else left, else Overview. */
export function closeTabs(state: SqliteTabsState, ids: ReadonlySet<string>): SqliteTabsState {
  const gone = state.tabs.filter((tab) => ids.has(tab.id));
  if (gone.length === 0) return state;
  const tabs = state.tabs.filter((tab) => !ids.has(tab.id));
  let activeId = state.activeId;
  if (ids.has(state.activeId)) {
    const at = state.tabs.findIndex((tab) => tab.id === state.activeId);
    const right = state.tabs.slice(at + 1).find((tab) => !ids.has(tab.id));
    const left = state.tabs
      .slice(0, at)
      .reverse()
      .find((tab) => !ids.has(tab.id));
    activeId = right?.id ?? left?.id ?? OVERVIEW_ID;
  }
  return { tabs, activeId, closed: rememberClosed(state.closed, gone) };
}

export function othersThan(state: SqliteTabsState, id: string): Set<string> {
  return new Set(state.tabs.filter((tab) => tab.id !== id).map((tab) => tab.id));
}

export function rightOf(state: SqliteTabsState, id: string): Set<string> {
  const at = state.tabs.findIndex((tab) => tab.id === id);
  return new Set(state.tabs.slice(at + 1).map((tab) => tab.id));
}

/** Reopens the last closed tab as a kept tab, next to the active one. */
export function reopenClosed(state: SqliteTabsState, now: number): SqliteTabsState {
  const [last, ...rest] = state.closed;
  if (!last) return state;
  const reopened = openTab({ ...state, closed: rest }, specOf(last), { preview: false, now });
  return {
    ...reopened,
    tabs: reopened.tabs.map((tab) =>
      tab.id === last.id && last.query ? { ...tab, query: last.query } : tab,
    ),
  };
}

export function specOf(tab: SqliteTab): SqliteTabSpec {
  if (tab.kind === "table") return { kind: "table", table: tab.table ?? "", view: tab.view };
  return { kind: tab.kind };
}

/** Drops table tabs whose tables are gone; says how many went. */
export function dropMissing(
  state: SqliteTabsState,
  tables: ReadonlySet<string>,
): { state: SqliteTabsState; dropped: number } {
  const gone = new Set(
    state.tabs
      .filter((tab) => tab.kind === "table" && !tables.has(tab.table ?? ""))
      .map((tab) => tab.id),
  );
  if (gone.size === 0) return { state, dropped: 0 };
  const closed = closeTabs(state, gone);
  return {
    state: { ...closed, closed: closed.closed.filter((tab) => !gone.has(tab.id)) },
    dropped: gone.size,
  };
}

export function updateTab(
  state: SqliteTabsState,
  id: string,
  patch: Partial<Pick<SqliteTab, "view" | "query" | "preview">>,
): SqliteTabsState {
  if (!state.tabs.some((tab) => tab.id === id)) return state;
  return { ...state, tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)) };
}

/** The tab after (or before) the active one, wrapping, Overview included. */
export function neighbourId(state: SqliteTabsState, step: 1 | -1): string {
  const ids = [OVERVIEW_ID, ...state.tabs.map((tab) => tab.id)];
  const at = Math.max(0, ids.indexOf(state.activeId));
  return ids[(at + step + ids.length) % ids.length] ?? OVERVIEW_ID;
}

const KINDS: readonly SqliteTabKind[] = ["table", "sql", "diagram"];

function readTab(value: unknown): SqliteTab | null {
  if (typeof value !== "object" || value === null) return null;
  const id: unknown = Reflect.get(value, "id");
  const kind: unknown = Reflect.get(value, "kind");
  const table: unknown = Reflect.get(value, "table");
  const view: unknown = Reflect.get(value, "view");
  const preview: unknown = Reflect.get(value, "preview");
  const usedAt: unknown = Reflect.get(value, "usedAt");
  const query: unknown = Reflect.get(value, "query");
  if (typeof id !== "string" || !KINDS.includes(kind as SqliteTabKind)) return null;
  if (kind === "table" && typeof table !== "string") return null;
  return {
    id,
    kind: kind as SqliteTabKind,
    ...(typeof table === "string" ? { table } : {}),
    ...(view === "rows" || view === "structure" || view === "sql" ? { view } : {}),
    preview: preview === true,
    usedAt: typeof usedAt === "number" ? usedAt : 0,
    ...(isQueryState(query) ? { query } : {}),
  };
}

function isQueryState(value: unknown): value is SqliteQueryState {
  if (typeof value !== "object" || value === null) return false;
  const get = (key: string): unknown => Reflect.get(value, key);
  return (
    typeof get("search") === "string" &&
    typeof get("where") === "string" &&
    Array.isArray(get("filters")) &&
    typeof get("page") === "number" &&
    typeof get("pageSize") === "number" &&
    Array.isArray(get("hidden"))
  );
}

/** Reads stored tabs, keeping the well-formed ones; anything else starts on the Overview. */
export function readTabs(value: unknown): SqliteTabsState {
  if (typeof value !== "object" || value === null) return EMPTY_TABS;
  const list = (key: string): SqliteTab[] => {
    const raw: unknown = Reflect.get(value, key);
    return Array.isArray(raw)
      ? raw.map(readTab).filter((tab): tab is SqliteTab => tab !== null)
      : [];
  };
  const tabs = list("tabs").slice(0, TABS_CAP);
  const activeId: unknown = Reflect.get(value, "activeId");
  return {
    tabs,
    activeId:
      typeof activeId === "string" && tabs.some((tab) => tab.id === activeId)
        ? activeId
        : OVERVIEW_ID,
    closed: list("closed").slice(0, CLOSED_CAP),
  };
}
