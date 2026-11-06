import type { SqliteDbFile } from "@/types/sqlite.types";

/**
 * Why this database cannot be changed here, or `null` when it can. Only a file opened on this
 * computer is its own source: every phone database is read through a pulled copy that the next
 * read replaces, so a change there would look saved while the phone never got it. The answer
 * depends on this database alone, never on whichever other one happens to be open.
 */
export function sqliteReadOnlyReason(db: Pick<SqliteDbFile, "sourceKind"> | null): string | null {
  if (!db) return "No database is open.";
  if (db.sourceKind === "imported") return null;
  if ((db.sourceKind ?? "native-android") === "native-android") {
    return "A copy pulled from the phone: changes here would never reach the app's database, so it is read-only.";
  }
  return "A copy read from the page: changes here would never reach the app's database, so it is read-only.";
}

/** Whether this one database may be changed, cleared or replaced here. */
export function canWriteDatabase(db: Pick<SqliteDbFile, "sourceKind">): boolean {
  return sqliteReadOnlyReason(db) === null;
}
