import type { SqliteDbFile, SqliteSourceDescriptor, SqliteSourceTech } from "@/types/sqlite.types";

const DESCRIPTORS: Record<SqliteSourceTech, SqliteSourceDescriptor> = {
  "native-android": {
    label: "native",
    title: "Native Android SQLite",
    description:
      "A database file inside the app's private data directory on the device, read over ADB. This is what the Android SDK and Room write to.",
  },
  "sqlite-wasm-opfsdb": {
    label: "opfs",
    title: "SQLite WASM — direct OPFS",
    description:
      "The database is stored as its own file in the Origin Private File System, with the SQLite header at byte 0.",
    packageName: "@sqlite.org/sqlite-wasm",
  },
  "sqlite-wasm-sah-pool": {
    label: "sah-pool",
    title: "SQLite WASM — SAH-Pool",
    description:
      "The database lives inside an opaque pool slot: a 4096-byte header holding the logical path and flags, then the SQLite payload. CapuBridge strips that header for you.",
    packageName: "@sqlite.org/sqlite-wasm",
  },
  "wa-sqlite-opfs": {
    label: "wa-sqlite",
    title: "wa-sqlite — OPFS VFS",
    description:
      "An OPFS database with -wal or -journal companion files alongside it, typical of wa-sqlite's OPFS virtual file systems.",
    packageName: "wa-sqlite",
  },
  "jeep-sqlite": {
    label: "jeep",
    title: "Capacitor jeep-sqlite",
    description:
      "The database is serialised into an IndexedDB record by the jeep-sqlite web shim that backs @capacitor-community/sqlite in a browser context.",
    packageName: "jeep-sqlite",
  },
  imported: {
    label: "file",
    title: "Imported file",
    description: "Opened from a file on this machine. It has no live source on the device.",
  },
};

export function sqliteSourceTech(db: SqliteDbFile): SqliteSourceTech {
  if (db.sourceTech) return db.sourceTech;
  if (db.sourceKind === "jeep-sqlite") return "jeep-sqlite";
  if (db.sourceKind === "imported") return "imported";
  if (db.sourceKind === "opfs") {
    return db.stripSahPoolHeader ? "sqlite-wasm-sah-pool" : "sqlite-wasm-opfsdb";
  }
  return "native-android";
}

export function sqliteSourceDescriptor(db: SqliteDbFile): SqliteSourceDescriptor {
  return DESCRIPTORS[sqliteSourceTech(db)];
}
