/** Places in Data where the app's own storage can be read. */
export interface DataLink {
  route: string;
  label: string;
}

export const DATA_LINKS: readonly DataLink[] = [
  { route: "storage-indexeddb", label: "IndexedDB" },
  { route: "storage-localstorage", label: "Local storage" },
  { route: "storage-sqlite", label: "SQLite" },
  { route: "storage-opfs", label: "OPFS" },
];
