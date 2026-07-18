import type { RouteRecordRaw } from "vue-router";

export const storageRoutes = [
  {
    path: "/storage",
    component: () => import("./StoragePanel.vue"),
    redirect: "/storage/indexeddb",
    children: [
      {
        path: "indexeddb/:db?/:store?",
        name: "storage-indexeddb",
        component: () => import("./indexeddb/IDBExplorer.vue"),
        meta: { label: "IndexedDB" },
      },
      {
        path: "indexeddb-snapshot/:db?/:store?",
        name: "storage-indexeddb-snapshot",
        component: () => import("./indexeddb/IDBExplorer.vue"),
        meta: { label: "IndexedDB Snapshot", navigation: false },
      },
      {
        path: "localforage",
        name: "storage-localforage",
        component: () => import("./localforage/LocalForageExplorer.vue"),
        meta: { label: "LocalForage" },
      },
      {
        path: "localstorage",
        name: "storage-localstorage",
        component: () => import("./localstorage/LSExplorer.vue"),
        meta: { label: "LocalStorage" },
      },
      {
        path: "cache",
        name: "storage-cache",
        component: () => import("./cache/CacheExplorer.vue"),
        meta: { label: "Cache" },
      },
      {
        path: "opfs",
        name: "storage-opfs",
        component: () => import("./opfs/OPFSExplorer.vue"),
        meta: { label: "OPFS" },
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
      {
        path: "changes",
        name: "storage-changes",
        component: () => import("./changes/IndexedDBChangesExplorer.vue"),
        meta: { label: "Changes" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
