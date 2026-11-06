import { EMPTY_TABS, readTabs, type SqliteTabsState } from "./sqliteTabs";

/** What Capubridge keeps per SQLite database between runs: its tabs and the tables opened last. */
export interface SqliteWorkspace {
  /** Tables opened most recently first. */
  recents: string[];
  tabs: SqliteTabsState;
  /** When the database was last used here (ms), to prune the oldest first. */
  touchedAt: number;
}

export type SqliteWorkspaces = Record<string, SqliteWorkspace>;

export const RECENTS_CAP = 10;
export const WORKSPACES_CAP = 30;

export function emptyWorkspace(now: number): SqliteWorkspace {
  return { recents: [], tabs: EMPTY_TABS, touchedAt: now };
}

/** The table first, without its earlier place, capped. */
export function pushRecent(recents: readonly string[], table: string, cap = RECENTS_CAP): string[] {
  return [table, ...recents.filter((entry) => entry !== table)].slice(0, cap);
}

/** Keeps the most recently used databases only. */
export function pruneWorkspaces(
  workspaces: SqliteWorkspaces,
  cap = WORKSPACES_CAP,
): SqliteWorkspaces {
  const entries = Object.entries(workspaces);
  if (entries.length <= cap) return workspaces;
  entries.sort(([, left], [, right]) => right.touchedAt - left.touchedAt);
  return Object.fromEntries(entries.slice(0, cap));
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** Reads what was stored, keeping only well-formed entries (a corrupt one is dropped, not fatal). */
export function readWorkspaces(value: unknown): SqliteWorkspaces {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const kept: SqliteWorkspaces = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "object" || entry === null) continue;
    const recents: unknown = Reflect.get(entry, "recents");
    const touchedAt: unknown = Reflect.get(entry, "touchedAt");
    if (!isStringList(recents) || typeof touchedAt !== "number") continue;
    kept[key] = {
      recents: recents.slice(0, RECENTS_CAP),
      tabs: readTabs(Reflect.get(entry, "tabs")),
      touchedAt,
    };
  }
  return kept;
}

/**
 * The identity a database's workspace is kept under: the sidebar scope (device and app) and its
 * path, or the picked file's own path for a file opened here, so it survives opening it again.
 */
export function sqliteWorkspaceKey(
  scope: string,
  sourceId: string,
  db: { sourceKind?: string; sourceFilePath?: string | null; name: string },
): string {
  if (db.sourceKind === "imported") return `file::${db.sourceFilePath ?? db.name}`;
  return `${scope}::${sourceId}`;
}
