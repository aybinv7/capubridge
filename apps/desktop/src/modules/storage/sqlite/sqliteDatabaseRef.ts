import type { SqliteDbFile } from "@/types/sqlite.types";

/** A route param or query value as one string; vue-router has already decoded it. */
export function routeParam(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

export interface FoundDatabase {
  db: SqliteDbFile;
  /** The link named the database the old way (by file name); the address bar is corrected once. */
  byName: boolean;
}

const KIND_ORDER = ["native-android", "opfs", "jeep-sqlite", "imported"] as const;

/**
 * The database a route points at. Paths are identities (`/data/data/…/x.db`, `opfs:/…`,
 * `jeep-sqlite:…`), so two databases called `app.db` never collide. Links written before
 * that (Device › Files, bookmarks) carry a bare name: it is matched once, a phone database
 * first, and only when exactly one database of that kind has the name.
 */
export function findDatabase(
  param: string,
  databases: readonly SqliteDbFile[],
): FoundDatabase | null {
  if (!param) return null;
  const exact = databases.find((db) => db.path === param);
  if (exact) return { db: exact, byName: false };
  for (const kind of KIND_ORDER) {
    const named = databases.filter(
      (db) => (db.sourceKind ?? "native-android") === kind && db.name === param,
    );
    if (named.length === 1 && named[0]) return { db: named[0], byName: true };
    if (named.length > 1) return null;
  }
  return null;
}
