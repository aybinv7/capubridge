export type FilesView = "list" | "grid";
export type SearchScope = "folder" | "device";

export const FILE_ROW_HEIGHT = 30;
export const FILE_TILE = { width: 112, height: 104 } as const;
export const TREE_ROW_HEIGHT = 26;

/** How often the open folder is read again; 0 means only when asked. */
export const REFRESH_INTERVALS = [
  { value: 0, label: "Manual" },
  { value: 3000, label: "Every 3 s" },
  { value: 5000, label: "Every 5 s" },
  { value: 10000, label: "Every 10 s" },
  { value: 15000, label: "Every 15 s" },
  { value: 30000, label: "Every 30 s" },
] as const;

/**
 * Places a hybrid-app developer opens most, above the folder tree. Shared storage is named by its
 * real folder: `/sdcard` is a link, and listing a link shows the link instead of its contents.
 */
export const FILE_PLACES = [
  { key: "storage", label: "Phone storage", path: "/storage/emulated/0" },
  { key: "downloads", label: "Downloads", path: "/storage/emulated/0/Download" },
  { key: "app-data", label: "Apps' shared data", path: "/storage/emulated/0/Android/data" },
  { key: "tmp", label: "Temporary", path: "/data/local/tmp" },
  { key: "root", label: "Whole phone", path: "/" },
] as const;
