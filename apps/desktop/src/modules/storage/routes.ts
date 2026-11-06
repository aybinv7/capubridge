import type { RouteRecordRaw } from "vue-router";
import { OPEN_IDB_EXPORT_COMMAND, OPEN_SQLITE_FILE_COMMAND } from "./useDataAppCommands";

export const storageRoutes = [
  {
    path: "/storage",
    component: () => import("./StoragePanel.vue"),
    redirect: "/storage/indexeddb",
    children: [
      {
        path: "indexeddb/:db?/:store?",
        name: "storage-indexeddb",
        component: () => import("./indexeddb/IndexedDBView.vue"),
        meta: {
          label: "IndexedDB",
          requires: "target",
          ownsBringToFront: true,
          gateCommand: {
            commandId: OPEN_IDB_EXPORT_COMMAND,
            label: "Open an IndexedDB export…",
            hint: "Read a saved export with no phone",
          },
        },
      },
      {
        path: "indexeddb-snapshot/:db?/:store?",
        name: "storage-indexeddb-snapshot",
        component: () => import("./indexeddb/IndexedDBView.vue"),
        meta: { label: "IndexedDB", navigation: false, tabPath: "/storage/indexeddb" },
      },
      {
        path: "keyvalue",
        name: "storage-keyvalue",
        component: () => import("./keyvalue/KeyValueView.vue"),
        meta: { label: "Key-value", requires: "target", ownsBringToFront: true },
      },
      {
        path: "localstorage",
        name: "storage-localstorage",
        redirect: (to) => ({ name: "storage-keyvalue", query: { ...to.query, source: "local" } }),
        meta: { navigation: false },
      },
      {
        path: "localforage",
        name: "storage-localforage",
        redirect: (to) => ({ name: "storage-keyvalue", query: { ...to.query, source: "forage" } }),
        meta: { navigation: false },
      },
      {
        path: "cache-storage",
        name: "storage-cache-storage",
        component: () => import("./cache/CacheStorageView.vue"),
        meta: { label: "Cache storage", requires: "target", ownsBringToFront: true },
      },
      {
        path: "cache",
        name: "storage-cache",
        redirect: (to) => ({ name: "storage-cache-storage", query: to.query }),
        meta: { navigation: false },
      },
      {
        path: "opfs",
        name: "storage-opfs",
        component: () => import("./opfs/OpfsView.vue"),
        meta: { label: "OPFS", requires: "target", ownsBringToFront: true },
      },
      {
        path: "sqlite/:db?/:table?",
        name: "storage-sqlite",
        component: () => import("./sqlite/SqliteView.vue"),
        meta: {
          label: "SQLite",
          requires: "data",
          gateCommand: {
            commandId: OPEN_SQLITE_FILE_COMMAND,
            label: "Open a SQLite file…",
            hint: "Read a database file with no phone",
          },
        },
      },
      {
        path: "sqlite-file/:file/:table?",
        name: "storage-sqlite-file",
        component: () => import("./sqlite/SqliteView.vue"),
        meta: { label: "SQLite", navigation: false, tabPath: "/storage/sqlite" },
      },
      {
        path: "graph",
        name: "storage-graph",
        component: () => import("./graph/StorageGraphExplorer.vue"),
        meta: { label: "Graph" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
