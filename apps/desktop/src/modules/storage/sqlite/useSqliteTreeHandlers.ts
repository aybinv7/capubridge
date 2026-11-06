import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import { useSqliteFilesStore } from "@/modules/storage/stores/useSqliteFilesStore";
import { useSqliteUnsavedStore } from "@/modules/storage/stores/useSqliteUnsavedStore";
import { closeOpenedFile } from "./closeOpenedFile";
import type { SqliteColumnInfo, SqliteDbFile } from "@/types/sqlite.types";
import { addressOf } from "./sqliteAddress";
import { exportSqlDump, exportSqliteFile } from "./sqliteImportExport";
import type { useSqliteTab } from "./useSqliteTab";
import { useSqliteWrites } from "./useSqliteWrites";
import type { SqliteStaged } from "./browse/sqliteChangeset";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * What the sidebar, the headers and the palette do in the SQLite tab: open, expand, pin, hide,
 * save copies, forget change marks, and the writes an opened file allows.
 */
export function useSqliteTreeHandlers(
  tab: ReturnType<typeof useSqliteTab>,
  confirm: (request: ConfirmRequest) => Promise<boolean>,
) {
  const router = useRouter();
  const files = useSqliteFilesStore();
  const unsaved = useSqliteUnsavedStore();
  const changes = useSqliteChangesStore();
  const { location, settings, scope } = tab;

  const writes = useSqliteWrites({
    confirm,
    addressOf: (db) => addressOf(db, tab.reach.value),
    changeSerial: () => tab.changeSerial.value,
    changePackage: () => tab.changePackage.value,
    afterWrite: () => tab.invalidate(),
    tableDropped: (db, table) => {
      if (tab.current.value?.db.path === db.path && location.table.value === table) {
        const target = location.target.value;
        if (target) location.open(target, "", true);
      }
    },
  });

  function unreadableReason(db: SqliteDbFile): string | null {
    if (addressOf(db, tab.reach.value)) return null;
    if ((db.sourceKind ?? "native-android") === "native-android") {
      return "The app's phone is not selected, so its files cannot be read.";
    }
    return "Open it first: a page database is copied to this computer when it is opened.";
  }

  function select(sourceId: string, collectionId: string | null) {
    const db = tab.databaseOf(sourceId);
    if (!db) return;
    const fileId = tab.fileIdOf(sourceId);
    if (tab.current.value?.sourceId === sourceId) {
      const target = location.target.value;
      if (target) location.open(target, collectionId ?? "");
      return;
    }
    tab.opening.open(db, fileId);
  }

  function toggle(sourceId: string, expanded: boolean) {
    settings.setExpanded(scope.value, sourceId, expanded);
  }

  function openTable(table: string) {
    const target = location.target.value;
    if (target && table) location.open(target, table);
  }

  async function refresh() {
    try {
      const changed = await tab.sync.refresh(true);
      if (!changed) tab.invalidate();
    } catch (error) {
      toast.error("Could not read the database again", { description: describe(error) });
    }
    void tab.sources.refetch();
  }

  function exportFile(db: SqliteDbFile) {
    if (db.sourceKind === "imported") {
      void writes.saveAs(db);
      return;
    }
    const address = addressOf(db, tab.reach.value);
    if (!address) {
      toast.info(`“${db.name}” cannot be saved yet`, { description: unreadableReason(db) ?? "" });
      return;
    }
    toast.promise(exportSqliteFile(address, db.name), {
      loading: `Saving “${db.name}”…`,
      success: (saved: string | null) =>
        saved ? `Saved “${db.name}” to ${saved}` : "Nothing was saved",
      error: (error: unknown) => `Could not save “${db.name}”: ${describe(error)}`,
    });
  }

  function exportDump(db: SqliteDbFile) {
    const address = addressOf(db, tab.reach.value);
    if (!address) {
      toast.info(`“${db.name}” cannot be saved yet`, { description: unreadableReason(db) ?? "" });
      return;
    }
    toast.promise(exportSqlDump(address, db.name), {
      loading: `Writing “${db.name}” as SQL…`,
      success: (saved: { path: string; rows: number } | null) =>
        saved
          ? `Saved ${saved.rows.toLocaleString("en-US")} rows of “${db.name}” to ${saved.path}`
          : "Nothing was saved",
      error: (error: unknown) => `Could not save “${db.name}” as SQL: ${describe(error)}`,
    });
  }

  /** Closes an opened file, asking first when that drops staged edits or unwritten changes. */
  async function closeFile(sourceId: string) {
    const id = tab.fileIdOf(sourceId);
    if (!id) return;
    try {
      await closeOpenedFile(sourceId, id, {
        confirm,
        files,
        unsaved,
        leave: () => {
          if (tab.current.value?.sourceId === sourceId) location.open(null);
        },
      });
    } catch (error) {
      toast.error("Could not remove the working copy", { description: describe(error) });
    }
  }

  function run(actionId: string, row: DataTreeRow) {
    if (row.kind !== "source" && row.kind !== "collection") return;
    const db = tab.databaseOf(row.source.id);
    if (!db) return;
    const sourceId = row.source.id;
    const serial = tab.changeSerial.value;
    const pkg = tab.changePackage.value;
    if (row.kind === "collection") {
      const table = row.collection.id;
      if (actionId === "pin") settings.toggleItemPinned(scope.value, sourceId, table);
      else if (actionId === "hide") settings.toggleItemHidden(scope.value, sourceId, table);
      else if (actionId === "clear-marks") changes.clearTableChanges(serial, pkg, db.path, table);
      else if (actionId === "clear-rows") void writes.clearTable(db, table);
      else if (actionId === "drop-table") void writes.dropTable(db, table);
      return;
    }
    if (actionId === "refresh") void refresh();
    else if (actionId === "pin") settings.togglePinned(scope.value, sourceId);
    else if (actionId === "hide") settings.toggleHidden(scope.value, sourceId);
    else if (actionId === "export-file") exportFile(db);
    else if (actionId === "save-file") void writes.saveToFile(db);
    else if (actionId === "export-dump") exportDump(db);
    else if (actionId === "import-dump") void writes.replaceWithDump(db);
    else if (actionId === "clear-marks") changes.clearDatabaseChanges(serial, pkg, db.path);
    else if (actionId === "close-file") void closeFile(sourceId);
    else if (actionId === "show-in-opfs") {
      void router.push({ name: "storage-opfs", query: { path: db.sourceOpfsDirectory ?? "" } });
    }
  }

  /** Saves staged edits and new rows of a table of the open file; resolves whether it saved. */
  function saveChanges(
    table: string,
    keyColumns: readonly SqliteColumnInfo[],
    staged: SqliteStaged,
  ): Promise<boolean> {
    const db = tab.current.value?.db;
    return db ? writes.saveChanges(db, table, keyColumns, staged) : Promise.resolve(false);
  }

  return {
    select,
    toggle,
    openTable,
    refresh,
    exportFile,
    exportDump,
    saveFile: writes.saveToFile,
    run,
    saveChanges,
    unreadableReason,
  };
}
