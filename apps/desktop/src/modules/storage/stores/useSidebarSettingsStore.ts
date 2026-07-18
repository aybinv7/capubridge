import { ref, watch } from "vue";

const STORAGE_KEY = "idb-sidebar-settings";

interface SidebarSettings {
  pinnedDbs: string[]; // "origin::dbName"
  hiddenDbs: string[]; // "origin::dbName"
  pinnedStores: string[]; // "dbName::storeName"
  hiddenStores: string[]; // "dbName::storeName"
  showHiddenDbs: boolean;
  showHidden: boolean;
  expandedDbs: string[];
}

function load(): SidebarSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to restore IndexedDB sidebar settings", error);
  }
  return {
    pinnedDbs: [],
    hiddenDbs: [],
    pinnedStores: [],
    hiddenStores: [],
    showHiddenDbs: false,
    showHidden: false,
    expandedDbs: [],
  };
}

function save(s: SidebarSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// Module-level singletons so state is shared across component mounts
const _loaded = load();
const pinnedDbs = ref<Set<string>>(new Set(_loaded.pinnedDbs));
const hiddenDbs = ref<Set<string>>(new Set(_loaded.hiddenDbs));
const showHiddenDbs = ref(_loaded.showHiddenDbs);
const pinnedStores = ref<Set<string>>(new Set(_loaded.pinnedStores));
const hiddenStores = ref<Set<string>>(new Set(_loaded.hiddenStores));
const showHidden = ref(_loaded.showHidden);
const expandedDbs = ref<Set<string>>(new Set(_loaded.expandedDbs));

function persist() {
  save({
    pinnedDbs: [...pinnedDbs.value],
    hiddenDbs: [...hiddenDbs.value],
    pinnedStores: [...pinnedStores.value],
    hiddenStores: [...hiddenStores.value],
    showHiddenDbs: showHiddenDbs.value,
    showHidden: showHidden.value,
    expandedDbs: [...expandedDbs.value],
  });
}

watch(
  [pinnedDbs, hiddenDbs, showHiddenDbs, pinnedStores, hiddenStores, showHidden, expandedDbs],
  persist,
  { deep: true },
);

export function useSidebarSettings() {
  function dbKey(origin: string, db: string) {
    return `${origin}::${db}`;
  }

  function togglePinDb(origin: string, db: string) {
    const key = dbKey(origin, db);
    const next = new Set(pinnedDbs.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    pinnedDbs.value = next;
  }

  function toggleHideDb(origin: string, db: string) {
    const key = dbKey(origin, db);
    const next = new Set(hiddenDbs.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    hiddenDbs.value = next;
  }

  function isDbPinned(origin: string, db: string) {
    return pinnedDbs.value.has(dbKey(origin, db));
  }

  function isDbHidden(origin: string, db: string) {
    return hiddenDbs.value.has(dbKey(origin, db));
  }

  function storeKey(db: string, store: string) {
    return `${db}::${store}`;
  }

  function togglePin(db: string, store: string) {
    const key = storeKey(db, store);
    const next = new Set(pinnedStores.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    pinnedStores.value = next;
  }

  function toggleHide(db: string, store: string) {
    const key = storeKey(db, store);
    const next = new Set(hiddenStores.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    hiddenStores.value = next;
  }

  function isPinned(db: string, store: string) {
    return pinnedStores.value.has(storeKey(db, store));
  }

  function isHidden(db: string, store: string) {
    return hiddenStores.value.has(storeKey(db, store));
  }

  function toggleDb(name: string) {
    const next = new Set(expandedDbs.value);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    expandedDbs.value = next;
  }

  return {
    pinnedDbs,
    hiddenDbs,
    showHiddenDbs,
    pinnedStores,
    hiddenStores,
    showHidden,
    expandedDbs,
    togglePinDb,
    toggleHideDb,
    isDbPinned,
    isDbHidden,
    togglePin,
    toggleHide,
    toggleDb,
    isPinned,
    isHidden,
  };
}
