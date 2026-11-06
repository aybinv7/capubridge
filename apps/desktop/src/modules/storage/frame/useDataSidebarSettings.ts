import { ref } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";
import type { DataKind } from "./dataFrame.types";

const STORAGE_KEY = "capubridge:data-sidebar:v1";
const LEGACY_IDB_KEY = "idb-sidebar-settings";
const LEGACY_SQLITE_KEY = "sqlite-sidebar-settings";
const MAX_SOURCES = 400;

/** Sidebar choices for one source (a database), kept per phone and app. */
export interface SourceSettings {
  pinned: boolean;
  hidden: boolean;
  expanded: boolean;
  pinnedItems: string[];
  hiddenItems: string[];
}

interface PersistedSettings {
  version: 1;
  sources: Record<string, SourceSettings>;
  showHidden: Record<string, boolean>;
  /** The old IndexedDB settings, moved here once so the old key can go. */
  legacy?: LegacyIdbSettings;
  /** The old SQLite settings (keyed by database path), moved here once too. */
  legacySqlite?: LegacySqliteSettings;
}

interface LegacySqliteSettings {
  pinnedDbs?: string[];
  hiddenDbs?: string[];
  pinnedTables?: string[];
  hiddenTables?: string[];
  showHiddenDbs?: boolean;
  showHiddenTables?: boolean;
  expandedDbs?: string[];
}

interface LegacyIdbSettings {
  pinnedDbs?: string[];
  hiddenDbs?: string[];
  pinnedStores?: string[];
  hiddenStores?: string[];
  showHidden?: boolean;
  showHiddenDbs?: boolean;
  expandedDbs?: string[];
}

const EMPTY: SourceSettings = {
  pinned: false,
  hidden: false,
  expanded: false,
  pinnedItems: [],
  hiddenItems: [],
};

function isPersisted(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PersistedSettings>;
  return (
    candidate.version === 1 &&
    typeof candidate.sources === "object" &&
    typeof candidate.showHidden === "object"
  );
}

function readLegacy<T>(key: string): T | null {
  return readPersisted<T | null>(key, null, (value) => typeof value === "object" && value !== null);
}

/** The SQLite sidebar's old settings for one database path, or `null` when it had none. */
function legacySqliteSeed(
  legacy: LegacySqliteSettings | null,
  path: string,
): SourceSettings | null {
  if (!legacy) return null;
  const prefix = `${path}::`;
  const items = (list: string[] | undefined) =>
    (list ?? [])
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length));
  const seed: SourceSettings = {
    pinned: legacy.pinnedDbs?.includes(path) ?? false,
    hidden: legacy.hiddenDbs?.includes(path) ?? false,
    expanded: legacy.expandedDbs?.includes(path) ?? false,
    pinnedItems: items(legacy.pinnedTables),
    hiddenItems: items(legacy.hiddenTables),
  };
  const empty =
    !seed.pinned &&
    !seed.hidden &&
    !seed.expanded &&
    !seed.pinnedItems.length &&
    !seed.hiddenItems.length;
  return empty ? null : seed;
}

/** `serial::package::kind` — choices never leak from one phone or app to another. */
export function dataScope(serial: string, packageName: string, kind: DataKind): string {
  return `${serial || "-"}::${packageName || "-"}::${kind}`;
}

/**
 * The IndexedDB sidebar's old settings, keyed `origin::db` and `db::store`, read as the
 * starting point for a database this store has not seen yet. Nothing is written by reading.
 */
function legacySeed(legacy: LegacyIdbSettings | null, sourceId: string): SourceSettings | null {
  if (!legacy) return null;
  const db = sourceId.split("::").slice(1).join("::");
  if (!db) return null;
  const prefix = `${db}::`;
  const items = (list: string[] | undefined) =>
    (list ?? [])
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length));
  const seed: SourceSettings = {
    pinned: legacy.pinnedDbs?.includes(sourceId) ?? false,
    hidden: legacy.hiddenDbs?.includes(sourceId) ?? false,
    expanded: legacy.expandedDbs?.includes(db) ?? false,
    pinnedItems: items(legacy.pinnedStores),
    hiddenItems: items(legacy.hiddenStores),
  };
  const empty =
    !seed.pinned &&
    !seed.hidden &&
    !seed.expanded &&
    !seed.pinnedItems.length &&
    !seed.hiddenItems.length;
  return empty ? null : seed;
}

export const useDataSidebarSettings = defineStore("data-sidebar-settings", () => {
  const stored = ref<PersistedSettings>(
    readPersisted<PersistedSettings>(
      STORAGE_KEY,
      { version: 1, sources: {}, showHidden: {} },
      isPersisted,
    ),
  );
  const moves: Array<[string, "legacy" | "legacySqlite"]> = [
    [LEGACY_IDB_KEY, "legacy"],
    [LEGACY_SQLITE_KEY, "legacySqlite"],
  ];
  for (const [key, field] of moves) {
    const old = readLegacy<LegacyIdbSettings & LegacySqliteSettings>(key);
    if (!old) continue;
    if (!stored.value[field]) {
      stored.value = { ...stored.value, [field]: old };
      writePersisted(STORAGE_KEY, stored.value);
    }
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Could not remove old Data sidebar settings", key, error);
    }
  }
  const legacy = stored.value.legacy ?? null;
  const legacySqlite = stored.value.legacySqlite ?? null;

  function keyOf(scope: string, sourceId: string): string {
    return `${scope}::${sourceId}`;
  }

  function source(scope: string, sourceId: string): SourceSettings {
    const entry = stored.value.sources[keyOf(scope, sourceId)];
    if (entry) return entry;
    if (scope.endsWith("::indexeddb")) return legacySeed(legacy, sourceId) ?? EMPTY;
    if (scope.endsWith("::sqlite")) return legacySqliteSeed(legacySqlite, sourceId) ?? EMPTY;
    return EMPTY;
  }

  function persist() {
    const keys = Object.keys(stored.value.sources);
    if (keys.length > MAX_SOURCES) {
      const next = { ...stored.value.sources };
      for (const key of keys.slice(0, keys.length - MAX_SOURCES)) delete next[key];
      stored.value = { ...stored.value, sources: next };
    }
    writePersisted(STORAGE_KEY, stored.value);
  }

  function update(scope: string, sourceId: string, patch: Partial<SourceSettings>) {
    const key = keyOf(scope, sourceId);
    const next = { ...source(scope, sourceId), ...patch };
    const sources = { ...stored.value.sources };
    delete sources[key];
    sources[key] = next;
    stored.value = { ...stored.value, sources };
    persist();
  }

  function toggleItem(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
  }

  function togglePinned(scope: string, sourceId: string) {
    update(scope, sourceId, { pinned: !source(scope, sourceId).pinned });
  }

  function toggleHidden(scope: string, sourceId: string) {
    update(scope, sourceId, { hidden: !source(scope, sourceId).hidden });
  }

  function setExpanded(scope: string, sourceId: string, expanded: boolean) {
    if (source(scope, sourceId).expanded === expanded) return;
    update(scope, sourceId, { expanded });
  }

  function toggleItemPinned(scope: string, sourceId: string, item: string) {
    update(scope, sourceId, { pinnedItems: toggleItem(source(scope, sourceId).pinnedItems, item) });
  }

  function toggleItemHidden(scope: string, sourceId: string, item: string) {
    update(scope, sourceId, { hiddenItems: toggleItem(source(scope, sourceId).hiddenItems, item) });
  }

  function showHidden(scope: string): boolean {
    const value = stored.value.showHidden[scope];
    if (value !== undefined) return value;
    if (scope.endsWith("::indexeddb")) return Boolean(legacy?.showHidden || legacy?.showHiddenDbs);
    if (scope.endsWith("::sqlite")) {
      return Boolean(legacySqlite?.showHiddenDbs || legacySqlite?.showHiddenTables);
    }
    return false;
  }

  function setShowHidden(scope: string, value: boolean) {
    stored.value = { ...stored.value, showHidden: { ...stored.value.showHidden, [scope]: value } };
    persist();
  }

  return {
    source,
    togglePinned,
    toggleHidden,
    setExpanded,
    toggleItemPinned,
    toggleItemHidden,
    showHidden,
    setShowHidden,
  };
});
