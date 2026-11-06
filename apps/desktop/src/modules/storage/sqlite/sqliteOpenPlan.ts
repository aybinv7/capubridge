import type { LocalSqlSession } from "@/stores/sqlSession.store";
import type { SqliteDbFile } from "@/types/sqlite.types";
import { isSameSource } from "./sqliteDatabaseList";

/**
 * What opening a database takes:
 * - `show`: it is readable already (a phone file, an opened file, or the pulled copy that is open);
 * - `adopt`: the page is away but an earlier pull of it is still on disk, so that copy opens;
 * - `pull`: copy it from the page now;
 * - `wait`: the page is away and nothing of it was pulled, so it cannot be read yet.
 */
export type SqliteOpenPlan = "show" | "adopt" | "pull" | "wait";

/**
 * Decides how to open `db`. An unreachable page database never asks the page first (that is
 * what failed before: it promised "the last copy" and then stat'ed the phone, C24).
 */
export function openPlanFor(
  db: SqliteDbFile,
  session: LocalSqlSession | null,
  hasCachedCopy: boolean,
): SqliteOpenPlan {
  const kind = db.sourceKind ?? "native-android";
  if (kind === "native-android" || kind === "imported") return "show";
  if (session && isSameSource(db, session)) return "show";
  if (!db.unreachable) return "pull";
  return kind === "opfs" && hasCachedCopy ? "adopt" : "wait";
}
