import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { OpfsDanglingRows } from "@/runtime/ipc/contracts/storage";
import { PAUSE_COST } from "@/modules/storage/useAppPause";
import { LIVE_COST } from "@/modules/storage/useLiveSqlite";
import type { SqliteTableInfo } from "@/types/sqlite.types";
import { quoteIdent } from "./sqlText";

/** What a bulk change does to the tables picked. */
export type TableChange = "empty" | "drop";

const BACKUP =
  "A copy of the database as it was is kept on this computer for 14 days (the last 5 of each database).";

const LINKED =
  "Foreign keys are not enforced for this: rows of other tables that point to them are kept, and you are told how many.";

function quoted(text: string): string {
  return `“${text}”`;
}

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

/**
 * The SQL of a change to `tables`: emptying skips views (they hold no rows); dropping drops a
 * view as a view. One statement per table, applied together in one transaction.
 */
export function tablesSql(
  tables: readonly Pick<SqliteTableInfo, "name" | "tableType">[],
  change: TableChange,
): string {
  const statements = tables.flatMap((table) => {
    const name = quoteIdent(table.name);
    if (change === "empty") return table.tableType === "view" ? [] : [`DELETE FROM ${name};`];
    return [table.tableType === "view" ? `DROP VIEW ${name};` : `DROP TABLE ${name};`];
  });
  return statements.join("\n");
}

/** The question before emptying or dropping tables of the app's database. */
export function tablesQuestion(
  database: string,
  tables: readonly Pick<SqliteTableInfo, "name" | "tableType">[],
  change: TableChange,
): ConfirmRequest {
  const single = tables.length === 1 ? tables[0] : undefined;
  const what = single ? quoted(single.name) : count(tables.length, "table", "tables");
  const action =
    change === "empty"
      ? `Every row of ${what} is deleted in ${quoted(database)} on the phone; the ${single ? "table stays" : "tables stay"}.`
      : `${single ? quoted(single.name) : `These ${what}`} and all ${single ? "its" : "their"} rows leave ${quoted(database)} on the phone. The app may fail where it expects ${single ? "it" : "them"} until it creates ${single ? "it" : "them"} again.`;
  return {
    title:
      change === "empty"
        ? `Delete every row of ${what}?`
        : `Drop ${single ? quoted(single.name) : what}?`,
    text: [action, LINKED, LIVE_COST, BACKUP].join(" "),
    confirmLabel:
      change === "empty" ? "Delete every row" : single ? "Drop the table" : "Drop the tables",
    danger: true,
    ...(single ? {} : { details: tables.map((table) => table.name) }),
  };
}

/** The question before saving staged edits, new rows and deletes of a table to the phone. */
export function saveEditsQuestion(
  database: string,
  table: string,
  changes: number,
): ConfirmRequest {
  return {
    title: `Save ${count(changes, "change", "changes")} to ${quoted(table)} on the phone?`,
    text: [
      `They are written to ${quoted(database)} together: if the app changed or removed one of these rows since it was read here, nothing is saved.`,
      LIVE_COST,
      BACKUP,
    ].join(" "),
    confirmLabel: "Save to the phone",
    danger: false,
  };
}

/** The question before emptying every table of the app's database. */
export function emptyDatabaseQuestion(database: string): ConfirmRequest {
  return {
    title: `Delete every row of ${quoted(database)}?`,
    text: [
      `Every table of ${quoted(database)} is emptied on the phone, including tables made since it was last read here; tables, indexes, views and triggers stay.`,
      LIVE_COST,
      BACKUP,
    ].join(" "),
    confirmLabel: "Delete every row",
    danger: true,
  };
}

/** The question when the app's connection could not be used: make the change paused instead? */
export function pauseInsteadQuestion(database: string, reason: string): ConfirmRequest {
  return {
    title: `Pause the app to change ${quoted(database)}?`,
    text: [
      `The app's own connection to it could not be used: ${reason} Nothing was changed yet.`,
      PAUSE_COST,
    ].join(" "),
    confirmLabel: "Pause the app and change it",
    danger: true,
  };
}

/** The question before erasing the app's database; it asks for the name to be typed. */
export function deleteDatabaseQuestion(database: string, sahPool: boolean): ConfirmRequest {
  const how = sahPool
    ? "Its SAH-Pool slot, and the slots of its journals, are emptied the way the pool empties them, so the pool keeps its size."
    : "Its file and its journals are deleted.";
  return {
    title: `Delete the database ${quoted(database)}?`,
    text: [
      `${quoted(database)} is erased from the app's OPFS on the phone. ${how} When the app starts again it finds no database, and makes a new one if it is built to. This cannot be undone.`,
      PAUSE_COST,
    ].join(" "),
    confirmLabel: "Delete the database",
    danger: true,
    requireConfirmText: database,
  };
}

/**
 * What a change left pointing at rows it removed, in a sentence, or `""` when nothing was: the
 * largest three, then how many other tables.
 */
export function danglingNote(dangling: readonly OpfsDanglingRows[]): string {
  if (dangling.length === 0) return "";
  const largest = [...dangling].sort((a, b) => b.rows - a.rows);
  const named = largest
    .slice(0, 3)
    .map(
      (entry) =>
        `${count(entry.rows, "row", "rows")} of ${quoted(entry.table)} into ${quoted(entry.parent)}`,
    )
    .join(", ");
  const rest = largest.length - 3;
  const more = rest > 0 ? `, and rows of ${count(rest, "other table", "other tables")}` : "";
  return `Left pointing at rows that are gone: ${named}${more}.`;
}
