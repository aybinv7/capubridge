import type { LiveSqliteChange } from "@capubridge/cdp-protocol";
import type { SqliteDbFile } from "@/types/sqlite.types";

/** A change to the app's database, as SQL, every table emptied, or staged row statements. */
export interface OpfsSqliteChange {
  sql?: string;
  emptyEveryTable?: boolean;
  changes?: readonly string[];
}

/**
 * The name the app opened the database by: a SAH-Pool slot holds it in its header (the name
 * Capubridge lists it under), a plain OPFS file is opened by its path.
 */
export function liveFilename(
  db: Pick<SqliteDbFile, "name" | "sourceOpfsPath" | "stripSahPoolHeader">,
): string {
  return db.stripSahPoolHeader ? db.name : (db.sourceOpfsPath ?? db.name);
}

/** The same change, for the app's own connection. */
export function liveChangeOf(change: OpfsSqliteChange): LiveSqliteChange {
  if (change.emptyEveryTable) return { kind: "every-table" };
  if (change.changes) return { kind: "changeset", statements: change.changes };
  return { kind: "sql", sql: change.sql ?? "" };
}
