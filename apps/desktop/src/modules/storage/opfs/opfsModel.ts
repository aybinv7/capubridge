import {
  SAH_POOL_HEADER_DATA_OFFSET,
  type OPFSItem,
  type StorageTechHint,
} from "@capubridge/cdp-protocol";
import { extensionOf } from "@/shared/file-viewer/viewerKinds";

/** What a file is for the app that keeps it, judged by its name and the folder's layout. */
export type OpfsRole = "folder" | "sqlite" | "wal" | "journal" | "shm" | "pool-slot" | "file";

export interface OpfsRow {
  /** The path from the OPFS root: stable, never a position. */
  id: string;
  name: string;
  path: string;
  kind: OPFSItem["kind"];
  role: OpfsRole;
  kindLabel: string;
  size: number | null;
  lastModified: number | null;
  /** The app holds the file open (a live database), so it could not be read. */
  locked: boolean;
  /** Why the phone could not open the file, or `null`. */
  unreadable: string | null;
  /** Lower-case name and kind, built once per read. */
  search: string;
}

const SQLITE_NAME = /\.(sqlite3?|db3?)$/i;

const ROLE_LABELS: Record<Exclude<OpfsRole, "file">, string> = {
  folder: "Folder",
  sqlite: "SQLite database",
  wal: "Write-ahead log",
  journal: "Rollback journal",
  shm: "Shared memory",
  "pool-slot": "SAH-Pool slot",
};

/** Whether a file of this name is a SQLite database the SQLite tab can open. */
export function isSqliteName(name: string): boolean {
  return SQLITE_NAME.test(name);
}

/** The names the folder's SAH-Pool hint calls slots (only when it can be decoded). */
export function poolSlotNames(hints: readonly StorageTechHint[]): ReadonlySet<string> {
  const pool = hints.find((hint) => hint.id === "sqlite-wasm-sah-pool" && hint.inspectable);
  return new Set(pool?.affectedEntries ?? []);
}

/** The role of an item: folders, SQLite files and their companions, pool slots, other files. */
export function roleOf(item: OPFSItem, poolSlots: ReadonlySet<string>): OpfsRole {
  if (item.kind === "directory") return "folder";
  if (SQLITE_NAME.test(item.name)) return "sqlite";
  if (/-wal$/i.test(item.name)) return "wal";
  if (/-journal$/i.test(item.name)) return "journal";
  if (/-shm$/i.test(item.name)) return "shm";
  if (poolSlots.has(item.name) && (item.size ?? 0) >= SAH_POOL_HEADER_DATA_OFFSET) {
    return "pool-slot";
  }
  return "file";
}

/**
 * The kind in words: the role, or the extension ("JSON file"), or "File". A pool slot that holds
 * only its 4 KB header keeps no database.
 */
export function kindLabelOf(role: OpfsRole, name: string, size: number | null = null): string {
  if (role === "pool-slot" && size === SAH_POOL_HEADER_DATA_OFFSET) return "Empty SAH-Pool slot";
  if (role !== "file") return ROLE_LABELS[role];
  const extension = extensionOf(name);
  return extension ? `${extension.toUpperCase()} file` : "File";
}

/** Files the app keeps open while it runs: a database, its journal files, or a pool slot. */
export function isLiveDatabaseRole(role: OpfsRole): boolean {
  return role !== "file" && role !== "folder";
}

/** The rows of one folder listing, each built once. */
export function toRows(items: readonly OPFSItem[], hints: readonly StorageTechHint[]): OpfsRow[] {
  const slots = poolSlotNames(hints);
  return items.map((item) => {
    const role = roleOf(item, slots);
    const kindLabel = kindLabelOf(role, item.name, item.size);
    return {
      id: item.path,
      name: item.name,
      path: item.path,
      kind: item.kind,
      role,
      kindLabel,
      size: item.size,
      lastModified: item.lastModified,
      locked: item.locked === true,
      unreadable: item.unreadable ?? null,
      search: `${item.name}\n${kindLabel}`.toLowerCase(),
    };
  });
}
