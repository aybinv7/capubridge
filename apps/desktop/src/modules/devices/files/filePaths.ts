import type { FileEntry } from "@/types/adb.types";
import { compareText } from "../shared/collator";
import { parseDeviceDate } from "../shared/dates";

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
  if (key === "size") return a.size - b.size || compareText(a.name, b.name);
  if (key === "modified") {
    const timeA = parseDeviceDate(a.modified) ?? Number.NEGATIVE_INFINITY;
    const timeB = parseDeviceDate(b.modified) ?? Number.NEGATIVE_INFINITY;
    return (timeA === timeB ? 0 : timeA < timeB ? -1 : 1) || compareText(a.name, b.name);
  }
  return compareText(a.name, b.name);
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

export interface EntryFilter {
  showHidden: boolean;
  query: string;
}

/** The entries of `dir` with their absolute paths. */
export function entriesWithPaths(
  entries: readonly FileEntry[],
  dir: string,
): DeviceFileListEntry[] {
  return entries.map((entry) => ({ ...entry, path: joinPath(dir, entry.name) }));
}

/** Drops dot files unless asked and keeps names containing the query; order is kept. */
export function filterEntries<T extends FileEntry>(
  entries: readonly T[],
  options: EntryFilter,
): T[] {
  const query = options.query.trim().toLowerCase();
  if (options.showHidden && !query) return entries.slice();
  return entries.filter(
    (entry) =>
      (options.showHidden || !entry.name.startsWith(".")) &&
      (!query || entry.name.toLowerCase().includes(query)),
  );
}

/** Entries of the open folder, without dot files unless asked, filtered by name. */
export function visibleEntries(
  entries: readonly FileEntry[],
  dir: string,
  options: EntryFilter,
): DeviceFileListEntry[] {
  return filterEntries(entriesWithPaths(entries, dir), options);
}
