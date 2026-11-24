import { buildRowKey } from "@/modules/storage/changes/sqliteRowKey";
import type { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import { savedKey, type SqliteStaged } from "./browse/sqliteChangeset";

type RecordChange = ReturnType<typeof useSqliteChangesStore>["recordChange"];

export interface StagedRecordContext {
  serial: string;
  packageName: string;
  dbPath: string;
  table: string;
  keyColumns: readonly SqliteColumnInfo[];
}

/**
 * Puts a saved changeset in the change feed: each deleted row, each edited row, and each new
 * row as `inserted` gives it (read back where it could be, as staged otherwise).
 */
export function recordStagedChanges(
  recordChange: RecordChange,
  context: StagedRecordContext,
  staged: SqliteStaged,
  inserted: readonly Record<string, unknown>[],
) {
  const keyColumns = [...context.keyColumns];
  const base = {
    serial: context.serial,
    packageName: context.packageName,
    dbPath: context.dbPath,
    tableName: context.table,
    source: "capubridge" as const,
  };
  for (const row of staged.deletes.values()) {
    recordChange({
      ...base,
      operation: "delete",
      rowKey: buildRowKey(keyColumns, row),
      beforeValue: { ...row },
      afterValue: null,
    });
  }
  for (const edit of staged.edits.values()) {
    recordChange({
      ...base,
      operation: "update",
      rowKey: buildRowKey(keyColumns, savedKey(edit)),
      beforeValue: { ...edit.original },
      afterValue: savedKey(edit),
    });
  }
  for (const after of inserted) {
    recordChange({
      ...base,
      operation: "add",
      rowKey: buildRowKey(keyColumns, after),
      beforeValue: null,
      afterValue: after,
    });
  }
}
