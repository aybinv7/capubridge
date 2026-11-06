import { toast } from "vue-sonner";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import {
  useSqliteFilesStore,
  type SqliteOpenedFile,
} from "@/modules/storage/stores/useSqliteFilesStore";
import { buildRowKey } from "@/modules/storage/changes/sqliteRowKey";
import type { SqliteColumnInfo, SqliteDbFile } from "@/types/sqlite.types";
import { sqliteReadOnlyReason } from "./browse/sqliteWriteAccess";
import type { SqliteAddress } from "./sqliteAddress";
import { importSqlDump, pickSqlDump } from "./sqliteImportExport";
import { applyChangeset, runQuery, runWrite } from "./sqliteReads";
import {
  changesetStatements,
  savedKey,
  stagedCount,
  type SqliteStaged,
} from "./browse/sqliteChangeset";
import { readBackChangeset } from "./browse/sqliteReadBack";
import { quoteIdent, sqlLiteral } from "./sqlText";
import { firstSaveText, useSqliteFileSave } from "./useSqliteFileSave";

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

function changesText(count: number): string {
  return count === 1 ? "1 change" : `${count} changes`;
}

/**
 * Changes to a file opened on this computer: clear a table, drop it, delete rows, replace the
 * whole file with an SQL dump, save staged edits. Each asks first and each checks the database
 * it acts on, never the one that happens to be open; a phone or page copy is refused before
 * anything runs (M1). Each change is made in the working copy, then written over the picked
 * file (S2): the confirmation names that path, and the toast says where it was saved.
 */
export function useSqliteWrites(deps: SqliteWriteDeps) {
  const changes = useSqliteChangesStore();
  const files = useSqliteFilesStore();
  const fileSave = useSqliteFileSave(deps.confirm);

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

  function openedFile(db: SqliteDbFile): SqliteOpenedFile | null {
    const file = files.byPath(db.path);
    if (!file) toast.error(`“${db.name}” is not open`);
    return file;
  }

  /** The working copy and its file, or `null` (and a toast) when `db` cannot be changed. */
  function target(db: SqliteDbFile): { address: SqliteAddress; file: SqliteOpenedFile } | null {
    const address = writableAddress(db);
    if (!address) return null;
    const file = openedFile(db);
    return file ? { address, file } : null;
  }

  /**
   * Writes the working copy over the picked file and says where. `done` names the change made
   * in the working copy; `title` words the success with the path written.
   */
  async function saveFile(
    file: SqliteOpenedFile,
    done: string,
    title: (path: string) => string = (path) => `${done} and saved ${path}`,
    checked?: string,
  ) {
    const result = await fileSave.writeBack(file, done);
    if (!result) return;
    toast.success(title(result.path), {
      description: [checked, `The earlier version is kept as ${result.backup}.`]
        .filter(Boolean)
        .join(" "),
    });
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
    const at = target(db);
    if (!at) return;
    const confirmed = await deps.confirm({
      title: `Delete every row of “${table}”?`,
      text: `Every row of “${table}” is deleted; the table stays. ${firstSaveText(at.file)}`,
      confirmLabel: "Delete every row",
      danger: true,
    });
    if (!confirmed) return;
    files.confirmSave(at.file.id);
    try {
      await runWrite(at.address, `DELETE FROM ${quoteIdent(table)}`);
      note(db, `Cleared all rows from "${table}"`, table);
      await saveFile(at.file, `Deleted every row of “${table}”`);
    } catch (error) {
      toast.error(`Could not clear “${table}”`, { description: describe(error) });
    } finally {
      deps.afterWrite(db);
    }
  }

  async function dropTable(db: SqliteDbFile, table: string) {
    const at = target(db);
    if (!at) return;
    const confirmed = await deps.confirm({
      title: `Drop the table “${table}”?`,
      text: `The table “${table}” and all its rows leave the file. ${firstSaveText(at.file)}`,
      confirmLabel: "Drop the table",
      danger: true,
    });
    if (!confirmed) return;
    files.confirmSave(at.file.id);
    try {
      await runWrite(at.address, `DROP TABLE ${quoteIdent(table)}`);
      note(db, `Dropped table "${table}"`, table);
      deps.tableDropped(db, table);
      await saveFile(at.file, `Dropped “${table}”`);
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
    const at = target(db);
    if (!at) return;
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
      text: `${single ? "The row is" : `${records.length} rows are`} deleted from “${table}”. ${firstSaveText(at.file)}`,
      confirmLabel: single ? "Delete row" : `Delete ${records.length} rows`,
      danger: true,
    });
    if (!confirmed) return;
    files.confirmSave(at.file.id);
    try {
      await runWrite(at.address, `DELETE FROM ${quoteIdent(table)} WHERE ${where}`);
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
      await saveFile(at.file, single ? "Deleted the row" : `Deleted ${records.length} rows`);
    } catch (error) {
      toast.error("Could not delete the rows", { description: describe(error) });
    } finally {
      deps.afterWrite(db);
    }
  }

  /**
   * Saves staged cell edits and new rows of one table to an opened file: all in one transaction
   * in the working copy, read back, then written over the picked file (asked once, naming the
   * path). Returns whether the changes left the staging (they are in the working copy).
   */
  async function saveChanges(
    db: SqliteDbFile,
    table: string,
    keyColumns: readonly SqliteColumnInfo[],
    staged: SqliteStaged,
  ): Promise<boolean> {
    const count = stagedCount(staged);
    if (count === 0) return true;
    const at = target(db);
    if (!at) return false;
    if (!(await fileSave.confirmFirstSave(at.file))) return false;
    const keyNames = keyColumns.map((column) => column.name);
    let statements: string[];
    try {
      statements = changesetStatements(table, keyNames, staged);
    } catch (error) {
      toast.error("These changes cannot be saved", { description: describe(error) });
      return false;
    }
    let inserted: (number | null)[];
    try {
      inserted = (await applyChangeset(at.address, statements)).insertedRowIds;
    } catch (error) {
      toast.error("Nothing was saved", { description: describe(error) });
      return false;
    }
    const done = `Saved ${changesText(count)}`;
    const title = (path: string) => `Saved ${changesText(count)} to ${path}`;
    try {
      const back = await readBackChangeset(
        (sql) => runQuery(at.address, sql),
        table,
        keyNames,
        staged,
        inserted,
      );
      for (const edit of staged.edits.values()) {
        changes.recordChange({
          operation: "update",
          serial: deps.changeSerial(),
          packageName: deps.changePackage(),
          dbPath: db.path,
          tableName: table,
          rowKey: buildRowKey([...keyColumns], savedKey(edit)),
          beforeValue: { ...edit.original },
          afterValue: savedKey(edit),
        });
      }
      for (const insert of back.inserted) {
        const after = insert.row ?? {
          ...staged.inserts.find((entry) => entry.id === insert.id)?.values,
        };
        changes.recordChange({
          operation: "add",
          serial: deps.changeSerial(),
          packageName: deps.changePackage(),
          dbPath: db.path,
          tableName: table,
          rowKey: buildRowKey([...keyColumns], after),
          beforeValue: null,
          afterValue: after,
        });
      }
      if (back.differences.length > 0) {
        const shown = back.differences
          .slice(0, 3)
          .map((entry) => `${entry.column}: wrote ${entry.wrote}, reads ${entry.reads}`)
          .join("; ");
        const many = back.differences.length;
        toast.warning(
          `${many} saved ${many === 1 ? "value reads" : "values read"} back differently`,
          { description: shown },
        );
        await saveFile(at.file, done, title);
      } else {
        await saveFile(
          at.file,
          done,
          title,
          back.unchecked > 0
            ? `Read back and checked, except ${back.unchecked} ${back.unchecked === 1 ? "row" : "rows"}.`
            : "Read back and checked.",
        );
      }
    } catch (error) {
      toast.warning("The saved rows could not be read back", { description: describe(error) });
      await saveFile(at.file, done, title);
    } finally {
      deps.afterWrite(db);
    }
    return true;
  }

  /** Replaces an opened file with an SQL dump picked from this computer, all or nothing. */
  async function replaceWithDump(db: SqliteDbFile) {
    const at = target(db);
    if (!at) return;
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
      text: `Every table, view and trigger is replaced by what “${picked.name}” builds. If the SQL fails part way, nothing changes. ${firstSaveText(at.file)}`,
      confirmLabel: "Replace the file",
      danger: true,
    });
    if (!confirmed) return;
    files.confirmSave(at.file.id);
    const toastId = toast.loading(`Replaying “${picked.name}”…`);
    try {
      await importSqlDump(at.address, picked.sql);
      note(db, `Replaced with "${picked.name}"`);
      toast.dismiss(toastId);
      await saveFile(at.file, `Replaced the contents with “${picked.name}”`);
    } catch (error) {
      toast.error("Nothing was changed", { id: toastId, description: describe(error) });
    } finally {
      deps.afterWrite(db);
    }
  }

  /** Writes an opened file whose changes are only in its working copy, after a failed save. */
  function saveToFile(db: SqliteDbFile): Promise<boolean> {
    const file = files.byPath(db.path);
    return file ? fileSave.saveToFile(file) : Promise.resolve(false);
  }

  /** Writes an opened file's working copy to another file the person picks. */
  async function saveAs(db: SqliteDbFile): Promise<void> {
    const file = files.byPath(db.path);
    if (file) await fileSave.saveAs(file);
  }

  return { clearTable, dropTable, deleteRows, saveChanges, replaceWithDump, saveToFile, saveAs };
}
