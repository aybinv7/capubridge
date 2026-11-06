import { readPersisted, writePersisted } from "@/lib/persisted";
import type { DiagramKind } from "@/modules/storage/stores/useStorageGraphStore";

const LAST_PLACE_KEY = "capubridge:diagram-last-place:v1";
const INCLUDE_OTHER_KEY = "capubridge:diagram-include-other:v1";

/**
 * Where the old Graph tab's address (`/storage/graph`) leads: the last database diagram shown,
 * else the SQLite tab. A file opened on this computer is never remembered: it is gone after a
 * restart.
 */
export function lastDiagramPath(): string {
  const path = readPersisted<string>(LAST_PLACE_KEY, "", (value) => typeof value === "string");
  return path.startsWith("/storage/") ? path : "/storage/sqlite";
}

export function rememberDiagramPath(path: string): void {
  if (!path.startsWith("/storage/") || !path.includes("view=diagram")) return;
  if (path.startsWith("/storage/sqlite-file/")) return;
  if (path.startsWith("/storage/indexeddb-snapshot/")) return;
  writePersisted(LAST_PLACE_KEY, path);
}

function isFlags(value: unknown): value is Record<string, boolean> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether a kind's diagrams show the app's other data, as last chosen. */
export function readIncludeOther(kind: DiagramKind): boolean {
  return readPersisted<Record<string, boolean>>(INCLUDE_OTHER_KEY, {}, isFlags)[kind] === true;
}

export function writeIncludeOther(kind: DiagramKind, value: boolean): void {
  const flags = readPersisted<Record<string, boolean>>(INCLUDE_OTHER_KEY, {}, isFlags);
  writePersisted(INCLUDE_OTHER_KEY, { ...flags, [kind]: value });
}
