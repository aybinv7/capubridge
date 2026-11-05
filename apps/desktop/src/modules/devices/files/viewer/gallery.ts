import { isFolderEntry, type DeviceFileListEntry } from "../filePaths";

export interface GalleryPosition {
  index: number;
  total: number;
}

/** The files the viewer can step through: every regular file of the folder, in listing order. */
export function galleryEntries(entries: readonly DeviceFileListEntry[]): DeviceFileListEntry[] {
  return entries.filter((entry) => !isFolderEntry(entry) && entry.entryType !== "other");
}

/** Where `path` sits among the gallery, `index` -1 when it is not part of it. */
export function galleryPosition(
  items: readonly DeviceFileListEntry[],
  path: string | null,
): GalleryPosition {
  const index = path === null ? -1 : items.findIndex((item) => item.path === path);
  return { index, total: items.length };
}

/** The neighbour one step away, wrapping at both ends; null when there is nowhere to go. */
export function galleryNeighbour(
  items: readonly DeviceFileListEntry[],
  path: string | null,
  direction: "prev" | "next",
): DeviceFileListEntry | null {
  if (items.length < 2) return null;
  const { index } = galleryPosition(items, path);
  if (index < 0) return null;
  const step = direction === "next" ? 1 : -1;
  return items[(index + step + items.length) % items.length] ?? null;
}
