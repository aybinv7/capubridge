import { ref } from "vue";
import type { LiveSqliteOutcome } from "@capubridge/cdp-protocol";
import { toast } from "@/lib/toast";
import { invokeCommand } from "@/runtime/ipc/client";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { useOpfsSnapshotCache } from "@/modules/storage/opfsSnapshotCache";
import { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import { useAppPause } from "@/modules/storage/useAppPause";
import { useLiveSqlite } from "@/modules/storage/useLiveSqlite";
import type { SqliteColumnInfo, SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import { changesetStatements, stagedCount, type SqliteStaged } from "./browse/sqliteChangeset";
import { changesOnPage } from "./browse/sqliteWriteAccess";
import {
  danglingNote,
  deleteDatabaseQuestion,
  emptyDatabaseQuestion,
  pauseInsteadQuestion,
  saveEditsQuestion,
  tablesQuestion,
  tablesSql,
  type TableChange,
} from "./opfsSqliteQuestions";
import { liveChangeOf, liveFilename, type OpfsSqliteChange } from "./opfsSqliteLive";
import { recordStagedChanges } from "./sqliteStagedRecords";

export interface OpfsSqliteWriteDeps {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  changeSerial: () => string;
  changePackage: () => string;
  /** The database changed on the phone: read it again. */
  changed: (db: SqliteDbFile) => void;
  /** The database was erased on the phone: leave it and list the databases again. */
  erased: (db: SqliteDbFile) => void;
}

type Table = Pick<SqliteTableInfo, "name" | "tableType">;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function quoted(text: string): string {
  return `“${text}”`;
}

function plural(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

/**
 * Changes to an app's own SQLite database in the page's OPFS: save staged row edits, empty or
 * drop tables (one or many), empty every table, or erase the database. Changes go through the
 * app's own connection while it runs (see `useLiveSqlite`), after a copy is pulled to keep; when
 * that connection cannot be used, and to erase the database, the app is paused (see
 * `useAppPause`) and Rust changes a fresh copy and writes it back. Each asks first, and refuses
 * a database of another page than the one selected.
 */
export function useOpfsSqliteWrites(deps: OpfsSqliteWriteDeps) {
  const pause = useAppPause();
  const live = useLiveSqlite();
  const snapshots = useOpfsSnapshotCache();
  const changes = useSqliteChangesStore();
  const running = ref(false);

  function refusal(db: SqliteDbFile): string | null {
    if (!changesOnPage(db)) return "Only a database in the page's OPFS can be changed this way.";
    if (running.value) return "Another change to the app's database is still running.";
    if (db.sourceTargetId && db.sourceTargetId !== pause.targetId()) {
      return "It belongs to another page than the one selected. Select that page first.";
    }
    return null;
  }

  function allowed(db: SqliteDbFile): boolean {
    const reason = refusal(db);
    if (reason) toast.info(`${quoted(db.name)} was not changed`, { description: reason });
    return reason === null;
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

  async function whilePaused<T>(
    db: SqliteDbFile,
    work: (wsUrl: string, path: string) => Promise<T>,
  ) {
    const path = db.sourceOpfsPath ?? "";
    const wsUrl = pause.wsUrl();
    running.value = true;
    try {
      return await pause.paused(() => work(wsUrl, path));
    } finally {
      running.value = false;
      forget(db);
    }
  }

  function forget(db: SqliteDbFile) {
    if (db.sourceTargetId) snapshots.forget(db.sourceTargetId, db.sourceOpfsPath ?? "");
  }

  /** Applies `change` with the app paused; resolves whether it reached the phone. */
  async function rewritePaused(
    db: SqliteDbFile,
    change: OpfsSqliteChange,
    done: string,
  ): Promise<boolean> {
    const toastId = toast.loading(`Pausing the app to change ${quoted(db.name)}…`);
    try {
      const result = await whilePaused(db, (wsUrl, path) =>
        invokeCommand("opfs_rewrite_sqlite", {
          wsUrl,
          path,
          label: db.name,
          stripSahPoolHeader: Boolean(db.stripSahPoolHeader),
          sql: change.sql ?? null,
          emptyEveryTable: change.emptyEveryTable ?? false,
          changes: change.changes ? change.changes.map((sql) => ({ sql })) : null,
        }),
      );
      const left = danglingNote(result.dangling);
      const report = {
        id: toastId,
        description: `${left ? `${left} ` : ""}The app started again. The database as it was is kept at ${result.backup}.`,
      };
      if (left) toast.warning(done, report);
      else toast.success(done, report);
      deps.changed(db);
      return true;
    } catch (error) {
      toast.error(`The change to ${quoted(db.name)} did not go through`, {
        id: toastId,
        description: describe(error),
      });
      return false;
    }
  }

  /** A copy of the database as it is now, pulled to this computer before a live change. */
  async function keepCopy(db: SqliteDbFile): Promise<string> {
    const pulled = await invokeCommand("opfs_backup_sqlite", {
      wsUrl: pause.wsUrl(),
      path: db.sourceOpfsPath ?? "",
      label: db.name,
      stripSahPoolHeader: Boolean(db.stripSahPoolHeader),
    });
    return pulled.path;
  }

  /**
   * Makes `change` through the app's own connection once a copy to keep is pulled. When that
   * connection cannot be used, asks, then makes it with the app paused. SQLite refusing the
   * change is final: pausing would fail the same way. Resolves whether it reached the phone.
   */
  async function write(db: SqliteDbFile, change: OpfsSqliteChange, done: string): Promise<boolean> {
    const toastId = toast.loading(`Changing ${quoted(db.name)} through the app's connection…`);
    running.value = true;
    let backup: string;
    let outcome: LiveSqliteOutcome;
    try {
      try {
        backup = await keepCopy(db);
      } catch (error) {
        toast.error(`${quoted(db.name)} was not changed`, {
          id: toastId,
          description: `A copy to keep could not be read first: ${describe(error)}`,
        });
        return false;
      }
      outcome = await live
        .apply(liveFilename(db), liveChangeOf(change))
        .catch(
          (error: unknown): LiveSqliteOutcome => ({ status: "failed", message: describe(error) }),
        );
    } finally {
      running.value = false;
    }
    if (outcome.status === "done") {
      forget(db);
      const left = danglingNote(outcome.dangling);
      const report = {
        id: toastId,
        description: `${left ? `${left} ` : ""}The app kept running; it sees the change the next time it reads. The database as it was is kept at ${backup}.`,
      };
      if (left) toast.warning(done, report);
      else toast.success(done, report);
      deps.changed(db);
      return true;
    }
    if (outcome.status === "failed") {
      forget(db);
      toast.error(`The change to ${quoted(db.name)} did not go through`, {
        id: toastId,
        description: outcome.message,
      });
      deps.changed(db);
      return false;
    }
    toast.dismiss(toastId);
    if (!(await deps.confirm(pauseInsteadQuestion(db.name, outcome.reason)))) {
      toast.info(`${quoted(db.name)} was not changed`);
      return false;
    }
    return rewritePaused(db, change, done);
  }

  /**
   * Saves staged cell edits, new rows and deletes of `table` to the phone in one change, all or
   * nothing. Resolves whether they were saved, so the staging can let them go.
   */
  async function saveChanges(
    db: SqliteDbFile,
    table: string,
    keyColumns: readonly SqliteColumnInfo[],
    staged: SqliteStaged,
  ): Promise<boolean> {
    const count = stagedCount(staged);
    if (count === 0) return true;
    if (!allowed(db)) return false;
    let statements: string[];
    try {
      statements = changesetStatements(
        table,
        keyColumns.map((column) => column.name),
        staged,
      );
    } catch (error) {
      toast.error("These changes cannot be saved", { description: describe(error) });
      return false;
    }
    if (!(await deps.confirm(saveEditsQuestion(db.name, table, count)))) return false;
    const saved = await write(
      db,
      { changes: statements },
      `Saved ${plural(count, "change", "changes")} to ${quoted(table)} on the phone`,
    );
    if (!saved) return false;
    recordStagedChanges(
      changes.recordChange,
      {
        serial: deps.changeSerial(),
        packageName: deps.changePackage(),
        dbPath: db.path,
        table,
        keyColumns,
      },
      staged,
      staged.inserts.map((insert) => ({ ...insert.values })),
    );
    return true;
  }

  /** Empties or drops `tables`, asking first unless the picker that chose them already asked. */
  async function changeTables(
    db: SqliteDbFile,
    tables: readonly Table[],
    change: TableChange,
    asked = false,
  ) {
    if (tables.length === 0 || !allowed(db)) return;
    if (!asked && !(await deps.confirm(tablesQuestion(db.name, tables, change)))) return;
    const sql = tablesSql(tables, change);
    if (!sql) {
      toast.info("Nothing was changed", { description: "Views hold no rows of their own." });
      return;
    }
    const single = tables.length === 1 ? tables[0] : undefined;
    const what = single ? quoted(single.name) : `${tables.length} tables`;
    const names = tables.map((table) => `"${table.name}"`).join(", ");
    const saved = await write(
      db,
      { sql },
      change === "empty"
        ? `Deleted every row of ${what} on the phone`
        : `Dropped ${what} on the phone`,
    );
    if (!saved) return;
    note(
      db,
      change === "empty"
        ? `Cleared all rows from ${names} on the phone`
        : `Dropped ${names} on the phone`,
      single?.name,
    );
  }

  async function emptyDatabase(db: SqliteDbFile) {
    if (!allowed(db) || !(await deps.confirm(emptyDatabaseQuestion(db.name)))) return;
    const saved = await write(
      db,
      { emptyEveryTable: true },
      `Deleted every row of ${quoted(db.name)} on the phone`,
    );
    if (saved) note(db, "Cleared all rows of every table on the phone");
  }

  async function deleteDatabase(db: SqliteDbFile) {
    if (!allowed(db)) return;
    const sahPool = Boolean(db.stripSahPoolHeader);
    if (!(await deps.confirm(deleteDatabaseQuestion(db.name, sahPool)))) return;
    const toastId = toast.loading(`Pausing the app to delete ${quoted(db.name)}…`);
    try {
      const result = await whilePaused(db, (wsUrl, path) =>
        invokeCommand("opfs_erase_sqlite", { wsUrl, path, stripSahPoolHeader: sahPool }),
      );
      const journals = result.erased.length - 1;
      toast.success(`Deleted ${quoted(db.name)} on the phone`, {
        id: toastId,
        description: `${journals > 0 ? `Its ${journals === 1 ? "journal" : `${journals} journals`} went too. ` : ""}The app started again.`,
      });
      deps.erased(db);
    } catch (error) {
      toast.error(`${quoted(db.name)} was not deleted`, {
        id: toastId,
        description: describe(error),
      });
    }
  }

  return { running, refusal, saveChanges, changeTables, emptyDatabase, deleteDatabase };
}
