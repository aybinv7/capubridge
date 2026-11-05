export type FilesView = "list" | "grid";
export type SearchScope = "folder" | "device";

export const FILE_ROW_HEIGHT = 30;
export const FILE_LIST_COLUMNS = "grid-cols-[minmax(0,1fr)_6rem_10rem_4rem]";
export const FILE_TILE = { width: 112, height: 104 } as const;
export const TREE_ROW_HEIGHT = 26;

/** Where Files opens on a phone it has not opened before: the phone's shared storage. */
export const HOME_FOLDER = "/storage/emulated/0";

/** How often the open folder is read again; 0 means only when asked. */
export const REFRESH_INTERVALS = [
  { value: 0, label: "Off" },
  { value: 3000, label: "3 s" },
  { value: 5000, label: "5 s" },
  { value: 10000, label: "10 s" },
  { value: 15000, label: "15 s" },
  { value: 30000, label: "30 s" },
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
