import { computed, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useDevicesStore } from "@/stores/devices.store";
import { LOCAL_SQL_SERIAL, useSqlSessionStore } from "@/stores/sqlSession.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { SqliteDbFile } from "@/types/sqlite.types";
import { dataScope, useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import { useSqliteChangeIndex } from "@/modules/storage/changes/useSqliteChangeOverlay";
import { openedFileEntry, useSqliteFilesStore } from "@/modules/storage/stores/useSqliteFilesStore";
import { sqliteQueryRoot } from "./browse/useSqliteRows";
import { addressOf, type SqliteAddress } from "./sqliteAddress";
import { findDatabase } from "./sqliteDatabaseRef";
import { buildSqliteSections, fileSourceId } from "./sqliteTree";
import { useSqliteTables } from "./useSqliteCatalog";
import { useSqliteLocation } from "./useSqliteLocation";
import { useSqliteOpening } from "./useSqliteOpening";
import { useSqliteSnapshotSync } from "./useSqliteSnapshotSync";
import { useSqliteSources, type SqliteDevice } from "./useSqliteSources";

/** A database kept inside the page (OPFS, jeep-sqlite), so it belongs to that page's tab. */
function isInPage(path: string): boolean {
  return path.startsWith("opfs:") || path.startsWith("jeep-sqlite:");
}

export interface SqliteOpenDatabase {
  sourceId: string;
  db: SqliteDbFile;
  fileId: string | null;
}

/**
 * The state of the SQLite tab: which databases exist, which one the address bar opens, where it
 * is read, its tables, the sidebar model, and the check that keeps the open copy current.
 */
export function useSqliteTab() {
  const location = useSqliteLocation();
  const devices = useDevicesStore();
  const targets = useTargetsStore();
  const sessions = useSqlSessionStore();
  const files = useSqliteFilesStore();
  const settings = useDataSidebarSettings();
  const context = useActiveContextStore();
  const queries = useQueryClient();
  const { getDatabaseSummary, getTableSummary } = useSqliteChangeIndex();

  const device = computed<SqliteDevice | null>(() => {
    const target = targets.selectedTarget;
    const serial = devices.selectedDevice?.serial ?? "";
    if (!target || target.source !== "adb" || !target.packageName) return null;
    if (!serial || target.deviceSerial !== serial) return null;
    return { serial, package: target.packageName.trim() };
  });

  const sources = useSqliteSources(device);
  const opening = useSqliteOpening((target, replace) =>
    location.open(target, "", replace ?? false),
  );

  const fileRows = computed(() =>
    files.files.map((file) => ({
      id: file.id,
      sourceId: fileSourceId(file.id),
      db: openedFileEntry(file),
    })),
  );

  const current = computed<SqliteOpenDatabase | null>(() => {
    const target = location.target.value;
    if (!target) return null;
    if (target.kind === "file") {
      const row = fileRows.value.find((entry) => entry.id === target.id);
      return row ? { sourceId: row.sourceId, db: row.db, fileId: row.id } : null;
    }
    const found = findDatabase(target.path, sources.databases.value);
    return found ? { sourceId: found.db.path, db: found.db, fileId: null } : null;
  });

  watch(
    [() => location.target.value, () => sources.databases.value],
    ([target, list]) => {
      if (target?.kind !== "device") return;
      const found = findDatabase(target.path, list);
      if (found?.byName) {
        location.open({ kind: "device", path: found.db.path }, location.table.value, true);
      }
    },
    { immediate: true },
  );

  watch(
    () => targets.selectedTarget?.id ?? null,
    (next, previous) => {
      const target = location.target.value;
      if (!previous || next === previous || target?.kind !== "device") return;
      if (isInPage(target.path)) location.open(null, "", true);
    },
  );

  const missing = computed(() => {
    const target = location.target.value;
    if (!target || current.value) return null;
    if (target.kind === "file") {
      return "Files opened here last only while Capubridge runs. Open the file again to read it.";
    }
    if (sources.loading.value) return null;
    if (isInPage(target.path) && !sources.complete.value) {
      return "This database is in the page, which is not answering right now. Bring the app to the front to list it.";
    }
    return "This database is not in the list any more: the app may have deleted or renamed it.";
  });

  const reach = computed(() => ({ device: device.value, session: sessions.localSession }));
  const address = computed<SqliteAddress | null>(() =>
    current.value ? addressOf(current.value.db, reach.value) : null,
  );
  const tables = useSqliteTables(address);

  const autoOpened = new Set<string>();
  watch(
    [current, address],
    ([open, readable]) => {
      const kind = open?.db.sourceKind;
      if (!open || readable || (kind !== "opfs" && kind !== "jeep-sqlite")) return;
      if (autoOpened.has(open.db.path) || opening.isOpening(open.db)) return;
      autoOpened.add(open.db.path);
      opening.open(open.db, null, true);
    },
    { immediate: true },
  );

  const changeSerial = computed(() => device.value?.serial ?? LOCAL_SQL_SERIAL);
  const changePackage = computed(() => device.value?.package ?? "file");

  function invalidate() {
    void queries.invalidateQueries({ queryKey: sqliteQueryRoot(address.value) });
  }

  const sync = useSqliteSnapshotSync({
    db: computed(() => current.value?.db ?? null),
    address,
    changeSerial,
    changePackage,
    onChanged: invalidate,
  });

  watch(
    () => tables.loaded.value && current.value?.db.path,
    (ready) => {
      if (ready) sync.prime().catch((error) => console.warn("[SQLite] first copy failed", error));
    },
  );

  const scope = computed(() =>
    dataScope(context.device?.serial ?? "", context.target?.packageName ?? "", "sqlite"),
  );

  watch(
    () => current.value?.sourceId,
    (sourceId) => {
      if (sourceId) settings.setExpanded(scope.value, sourceId, true);
    },
    { immediate: true },
  );

  const sections = computed(() =>
    buildSqliteSections({
      databases: sources.databases.value,
      files: fileRows.value,
      open:
        current.value && tables.loaded.value
          ? { sourceId: current.value.sourceId, tables: tables.tables.value }
          : null,
      settings: (sourceId) => settings.source(scope.value, sourceId),
      databaseChanges: (db) => getDatabaseSummary(changeSerial.value, changePackage.value, db.path),
      tableChanges: (db, table) =>
        getTableSummary(changeSerial.value, changePackage.value, db.path, table),
      phoneListed: sources.phoneListed.value,
    }),
  );

  function databaseOf(sourceId: string): SqliteDbFile | null {
    if (sourceId.startsWith("file:")) {
      return fileRows.value.find((row) => row.sourceId === sourceId)?.db ?? null;
    }
    return sources.databases.value.find((db) => db.path === sourceId) ?? null;
  }

  function fileIdOf(sourceId: string): string | null {
    return fileRows.value.find((row) => row.sourceId === sourceId)?.id ?? null;
  }

  return {
    location,
    device,
    sources,
    opening,
    current,
    missing,
    address,
    tables,
    sync,
    scope,
    settings,
    sections,
    fileCount: computed(() => fileRows.value.length),
    changeSerial,
    changePackage,
    reach,
    invalidate,
    databaseOf,
    fileIdOf,
  };
}
