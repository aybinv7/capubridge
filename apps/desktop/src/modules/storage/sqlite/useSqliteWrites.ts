import { toast } from "vue-sonner";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import { buildRowKey } from "@/modules/storage/changes/sqliteRowKey";
import type { SqliteColumnInfo, SqliteDbFile } from "@/types/sqlite.types";
import { sqliteReadOnlyReason } from "./browse/sqliteWriteAccess";
import type { SqliteAddress } from "./sqliteAddress";
import { importSqlDump, pickSqlDump } from "./sqliteImportExport";
import { runWrite } from "./sqliteReads";
import { quoteIdent, sqlLiteral } from "./sqlText";

export interface SqliteWriteDeps {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  addressOf: (db: SqliteDbFile) => SqliteAddress | null;
  changeSerial: () => string;
  changePackage: () => string;
  /** Runs after a write, so the tables and rows on screen are read again. */
  afterWrite: (db: SqliteDbFile) => void;
  /** A table was dropped; leave it if it is the one open. */
  tableDropped: (db: SqliteDbFile, table: string) => void;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Changes to a file opened on this computer: clear a table, drop it, delete rows, replace the
 * whole file with an SQL dump. Each asks first and each checks the database it acts on, never
 * the one that happens to be open; a phone or page copy is refused before anything runs (M1).
 */
export function useSqliteWrites(deps: SqliteWriteDeps) {
  const changes = useSqliteChangesStore();

  function writableAddress(db: SqliteDbFile): SqliteAddress | null {
    const reason = sqliteReadOnlyReason(db);
    if (reason !== null) {
      toast.info("This database is read-only here", { description: reason });
      return null;
    }
    const address = deps.addressOf(db);
    if (!address) toast.error(`“${db.name}” is not open`);
    return address;
  }

  function note(db: SqliteDbFile, message: string, tableName?: string) {
    changes.recordSystemChange({
      serial: deps.changeSerial(),
      packageName: deps.changePackage(),
      dbPath: db.path,
      message,
      ...(tableName ? { tableName } : {}),
    });
  }

  async function clearTable(db: SqliteDbFile, table: string) {
    const address = writableAddress(db);
    if (!address) return;
    const confirmed = await deps.confirm({
      title: `Delete every row of “${table}”?`,
      text: `Every row of “${table}” in the file “${db.name}” on this computer is deleted. The table stays. This cannot be undone.`,
      confirmLabel: "Delete every row",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await runWrite(address, `DELETE FROM ${quoteIdent(table)}`);
      note(db, `Cleared all rows from "${table}"`, table);
      toast.success(`Deleted every row of “${table}”`);
    } catch (error) {
      toast.error(`Could not clear “${table}”`, { description: describe(error) });
    } finally {
      deps.afterWrite(db);
    }
  }

  async function dropTable(db: SqliteDbFile, table: string) {
    const address = writableAddress(db);
    if (!address) return;
    const confirmed = await deps.confirm({
      title: `Drop the table “${table}”?`,
      text: `The table “${table}” and all its rows leave the file “${db.name}” on this computer. This cannot be undone.`,
      confirmLabel: "Drop the table",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await runWrite(address, `DROP TABLE ${quoteIdent(table)}`);
      note(db, `Dropped table "${table}"`, table);
      deps.tableDropped(db, table);
      toast.success(`Dropped “${table}”`);
    } catch (error) {
      toast.error(`Could not drop “${table}”`, { description: describe(error) });
    } finally {
      deps.afterWrite(db);
    }
  }

  /** Deletes rows by primary key; a table without one has no row to address. */
  async function deleteRows(
    db: SqliteDbFile,
    table: string,
    keyColumns: readonly SqliteColumnInfo[],
    records: readonly Record<string, unknown>[],
  ) {
    if (records.length === 0) return;
    const address = writableAddress(db);
    if (!address) return;
    if (keyColumns.length === 0) {
      toast.error("These rows cannot be deleted", {
        description: "The table has no primary key, so a row cannot be told apart.",
      });
      return;
    }
    let where: string;
    try {
      where = records
        .map(
          (record) =>
            `(${keyColumns.map((column) => `${quoteIdent(column.name)} = ${sqlLiteral(record[column.name])}`).join(" AND ")})`,
        )
        .join(" OR ");
    } catch (error) {
      toast.error("These rows cannot be deleted", { description: describe(error) });
      return;
    }
    const single = records.length === 1;
    const confirmed = await deps.confirm({
      title: single ? "Delete this row?" : `Delete ${records.length} rows?`,
      text: `${single ? "The row is" : `${records.length} rows are`} deleted from “${table}” in the file “${db.name}” on this computer. This cannot be undone.`,
      confirmLabel: single ? "Delete row" : `Delete ${records.length} rows`,
      danger: true,
    });
    if (!confirmed) return;
    try {
      await runWrite(address, `DELETE FROM ${quoteIdent(table)} WHERE ${where}`);
      for (const record of records) {
        changes.recordChange({
          operation: "delete",
          serial: deps.changeSerial(),
          packageName: deps.changePackage(),
          dbPath: db.path,
          tableName: table,
          rowKey: buildRowKey([...keyColumns], record),
          beforeValue: { ...record },
          afterValue: null,
        });
      }
      toast.success(single ? "Deleted the row" : `Deleted ${records.length} rows`);
    } catch (error) {
      toast.error("Could not delete the rows", { description: describe(error) });
    } finally {
      deps.afterWrite(db);
    }
  }

  /** Replaces an opened file with an SQL dump picked from this computer, all or nothing. */
  async function replaceWithDump(db: SqliteDbFile) {
    const address = writableAddress(db);
    if (!address) return;
    let picked;
    try {
      picked = await pickSqlDump();
    } catch (error) {
      toast.error("Could not read the SQL file", { description: describe(error) });
      return;
    }
    if (!picked) return;
    const confirmed = await deps.confirm({
      title: `Replace “${db.name}” with “${picked.name}”?`,
      text: `Every table, view and trigger of the file “${db.name}” on this computer is replaced by what “${picked.name}” builds. If the SQL fails part way, the file stays as it is.`,
      confirmLabel: "Replace the file",
      danger: true,
    });
    if (!confirmed) return;
    const toastId = toast.loading(`Replaying “${picked.name}”…`);
    try {
      await importSqlDump(address, picked.sql);
      note(db, `Replaced with "${picked.name}"`);
      toast.success(`Replaced “${db.name}” with “${picked.name}”`, { id: toastId });
    } catch (error) {
      toast.error("Nothing was changed", { id: toastId, description: describe(error) });
    } finally {
      deps.afterWrite(db);
    }
  }

  return { clearTable, dropTable, deleteRows, replaceWithDump };
}
