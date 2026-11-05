import type { RouteRecordRaw } from "vue-router";
import { OPEN_IDB_EXPORT_COMMAND } from "./useDataAppCommands";

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
        path: "localstorage",
        name: "storage-localstorage",
        component: () => import("./localstorage/LSExplorer.vue"),
        meta: { label: "Local storage", requires: "target" },
      },
      {
        path: "localforage",
        name: "storage-localforage",
        component: () => import("./localforage/LocalForageExplorer.vue"),
        meta: { label: "LocalForage", requires: "target" },
      },
      {
        path: "cache",
        name: "storage-cache",
        component: () => import("./cache/CacheExplorer.vue"),
        meta: { label: "Cache", requires: "target" },
      },
      {
        path: "opfs",
        name: "storage-opfs",
        component: () => import("./opfs/OPFSExplorer.vue"),
        meta: { label: "OPFS", requires: "target" },
      },
      {
        path: "sqlite/:db?/:table?",
        name: "storage-sqlite",
        component: () => import("./sqlite/SqliteExplorer.vue"),
        meta: { label: "SQLite" },
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
