import { ref, watch } from "vue";

const STORAGE_KEY = "sqlite-sidebar-settings";

interface SqliteSidebarSettings {
  pinnedDbs: string[];
  hiddenDbs: string[];
  pinnedTables: string[];
  hiddenTables: string[];
  showHiddenDbs: boolean;
  showHiddenTables: boolean;
  expandedDbs: string[];
}

function dbKey(dbPath: string): string {
  return dbPath;
}

function tableKey(dbPath: string, tableName: string): string {
  return `${dbPath}::${tableName}`;
}

function load(): SqliteSidebarSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore parse errors */
  }
  return {
    pinnedDbs: [],
    hiddenDbs: [],
    pinnedTables: [],
    hiddenTables: [],
    showHiddenDbs: false,
    showHiddenTables: false,
    expandedDbs: [],
  };
}

const _loaded = load();
const pinnedDbs = ref<Set<string>>(new Set(_loaded.pinnedDbs));
const hiddenDbs = ref<Set<string>>(new Set(_loaded.hiddenDbs));
const showHiddenDbs = ref(_loaded.showHiddenDbs);
const pinnedTables = ref<Set<string>>(new Set(_loaded.pinnedTables));
const hiddenTables = ref<Set<string>>(new Set(_loaded.hiddenTables));
const showHiddenTables = ref(_loaded.showHiddenTables);
const expandedDbs = ref<Set<string>>(new Set(_loaded.expandedDbs));

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      pinnedDbs: [...pinnedDbs.value],
      hiddenDbs: [...hiddenDbs.value],
      pinnedTables: [...pinnedTables.value],
      hiddenTables: [...hiddenTables.value],
      showHiddenDbs: showHiddenDbs.value,
      showHiddenTables: showHiddenTables.value,
      expandedDbs: [...expandedDbs.value],
    }),
  );
}

watch(
  [pinnedDbs, hiddenDbs, pinnedTables, hiddenTables, showHiddenDbs, showHiddenTables, expandedDbs],
  persist,
  { deep: true },
);

function toggle<T>(set: Set<T>, value: T) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

export function useSqliteSidebarSettings() {
  function togglePinDb(dbPath: string) {
    const next = new Set(pinnedDbs.value);
    toggle(next, dbKey(dbPath));
    pinnedDbs.value = next;
  }
  function isDbPinned(dbPath: string) {
    return pinnedDbs.value.has(dbKey(dbPath));
  }
  function toggleHideDb(dbPath: string) {
    const next = new Set(hiddenDbs.value);
    toggle(next, dbKey(dbPath));
    hiddenDbs.value = next;
  }
  function isDbHidden(dbPath: string) {
    return hiddenDbs.value.has(dbKey(dbPath));
  }

  function togglePinTable(dbPath: string, tableName: string) {
    const next = new Set(pinnedTables.value);
    toggle(next, tableKey(dbPath, tableName));
    pinnedTables.value = next;
  }
  function isTablePinned(dbPath: string, tableName: string) {
    return pinnedTables.value.has(tableKey(dbPath, tableName));
  }
  function toggleHideTable(dbPath: string, tableName: string) {
    const next = new Set(hiddenTables.value);
    toggle(next, tableKey(dbPath, tableName));
    hiddenTables.value = next;
  }
  function isTableHidden(dbPath: string, tableName: string) {
    return hiddenTables.value.has(tableKey(dbPath, tableName));
  }

  function toggleExpanded(dbPath: string) {
    const next = new Set(expandedDbs.value);
    toggle(next, dbKey(dbPath));
    expandedDbs.value = next;
  }
  function isDbExpanded(dbPath: string) {
    return expandedDbs.value.has(dbKey(dbPath));
  }
  function expandDb(dbPath: string) {
    if (!expandedDbs.value.has(dbKey(dbPath))) {
      const next = new Set(expandedDbs.value);
      next.add(dbKey(dbPath));
      expandedDbs.value = next;
    }
  }

  return {
    pinnedDbs,
    hiddenDbs,
    showHiddenDbs,
    pinnedTables,
    hiddenTables,
    showHiddenTables,
    expandedDbs,
    togglePinDb,
    isDbPinned,
    toggleHideDb,
    isDbHidden,
    togglePinTable,
    isTablePinned,
    toggleHideTable,
    isTableHidden,
    toggleExpanded,
    isDbExpanded,
    expandDb,
  };
}
