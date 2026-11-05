import type { FileEntry } from "@/types/adb.types";

/** A listing entry with its absolute path on the phone. */
export interface DeviceFileListEntry extends FileEntry {
  path: string;
}

export type FileSortKey = "name" | "size" | "modified";

export interface FileSort {
  key: FileSortKey;
  desc: boolean;
}

/** An absolute path without a trailing slash; empty input is the root. */
export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  const absolute = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const clean = absolute.length > 1 ? absolute.replace(/\/+$/, "") : absolute;
  return clean || "/";
}

export function joinPath(base: string, name: string): string {
  return base === "/" ? `/${name}` : `${base}/${name}`;
}

export function parentPath(path: string): string {
  if (path === "/") return "/";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

export function fileNameFromPath(path: string): string {
  if (path === "/") return "/";
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function isFolderEntry(entry: Pick<FileEntry, "entryType">): boolean {
  return entry.entryType === "dir" || entry.entryType === "symlink";
}

/** One crumb per folder from the root down to `dir`. */
export function breadcrumbs(dir: string): Array<{ label: string; path: string }> {
  const crumbs = [{ label: "/", path: "/" }];
  let current = "";
  for (const part of dir.split("/").filter(Boolean)) {
    current += `/${part}`;
    crumbs.push({ label: part, path: current });
  }
  return crumbs;
}

/** Every folder from the root down to `dir`, root first. */
export function ancestorPaths(dir: string): string[] {
  return breadcrumbs(normalizePath(dir)).map((crumb) => crumb.path);
}

function compareBy(key: FileSortKey, a: DeviceFileListEntry, b: DeviceFileListEntry): number {
  if (key === "size") return a.size - b.size || a.name.localeCompare(b.name);
  if (key === "modified")
    return a.modified.localeCompare(b.modified) || a.name.localeCompare(b.name);
  return a.name.localeCompare(b.name);
}

/** Folders always come first; within each group entries follow the chosen column. */
export function sortEntries(
  entries: readonly DeviceFileListEntry[],
  sort: FileSort = { key: "name", desc: false },
): DeviceFileListEntry[] {
  return [...entries].sort((a, b) => {
    const folderA = isFolderEntry(a);
    const folderB = isFolderEntry(b);
    if (folderA !== folderB) return folderA ? -1 : 1;
    const order = compareBy(sort.key, a, b);
    return sort.desc ? -order : order;
  });
}

/** Entries of the open folder, without dot files unless asked, filtered by name. */
export function visibleEntries(
  entries: readonly FileEntry[],
  dir: string,
  options: { showHidden: boolean; query: string },
): DeviceFileListEntry[] {
  const query = options.query.trim().toLowerCase();
  return entries
    .filter((entry) => options.showHidden || !entry.name.startsWith("."))
    .filter((entry) => !query || entry.name.toLowerCase().includes(query))
    .map((entry) => ({ ...entry, path: joinPath(dir, entry.name) }));
}
