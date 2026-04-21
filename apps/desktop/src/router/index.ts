import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { dispatchDockOpenRequest, queueDockOpenRequest } from "@/lib/dock-events";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/devices" },

  // ── Devices ──────────────────────────────────────────────────────────────
  {
    path: "/devices",
    component: () => import("@/modules/devices/DevicesPanel.vue"),
    redirect: "/devices/overview",
    children: [
      {
        path: "overview",
        name: "devices-overview",
        component: () => import("@/modules/devices/DeviceOverview.vue"),
      },
      {
        path: "apps",
        name: "devices-apps",
        component: () => import("@/modules/devices/DeviceApps.vue"),
      },
      {
        path: "files",
        name: "devices-files",
        component: () => import("@/modules/devices/DeviceFiles.vue"),
      },
      {
        path: "perf",
        name: "devices-performance",
        component: () => import("@/modules/devices/DevicePerf.vue"),
      },
    ],
  },

  // ── Storage ──────────────────────────────────────────────────────────────
  {
    path: "/storage",
    component: () => import("@/modules/storage/StoragePanel.vue"),
    redirect: "/storage/indexeddb",
    children: [
      {
        path: "indexeddb/:db?/:store?",
        name: "storage-indexeddb",
        component: () => import("@/modules/storage/indexeddb/IDBExplorer.vue"),
      },

      {
        path: "localforage",
        name: "storage-localforage",
        component: () => import("@/modules/storage/localforage/LocalForageExplorer.vue"),
      },
      {
        path: "localstorage",
        name: "storage-localstorage",
        component: () => import("@/modules/storage/localstorage/LSExplorer.vue"),
      },
      {
        path: "cache",
        name: "storage-cache",
        component: () => import("@/modules/storage/cache/CacheExplorer.vue"),
      },
      {
        path: "opfs",
        name: "storage-opfs",
        component: () => import("@/modules/storage/opfs/OPFSExplorer.vue"),
      },
      {
        path: "sqlite/:db?/:table?",
        name: "storage-sqlite",
        component: () => import("@/modules/storage/sqlite/SqliteExplorer.vue"),
      },
      {
        path: "changes",
        name: "storage-changes",
        component: () => import("@/modules/storage/changes/IndexedDBChangesExplorer.vue"),
      },
    ],
  },

  // ── Network ──────────────────────────────────────────────────────────────
  {
    path: "/network",
    component: () => import("@/modules/network/NetworkPanel.vue"),
    redirect: "/network/requests",
    children: [
      {
        path: "requests",
        name: "network-requests",
        component: () => import("@/modules/network/NetworkRequests.vue"),
      },
      {
        path: "websocket",
        name: "network-websocket",
        component: () => import("@/modules/network/NetworkWebSocket.vue"),
      },
      {
        path: "throttle",
        name: "network-throttle",
        component: () => import("@/modules/network/NetworkThrottle.vue"),
      },
      {
        path: "mock",
        name: "network-mock",
        component: () => import("@/modules/network/NetworkMock.vue"),
      },
    ],
  },

  {
    path: "/console/:tab?",
    component: { render: () => null },
    beforeEnter: (to, from) => {
      const value = Array.isArray(to.params.tab) ? to.params.tab[0] : to.params.tab;
      const tab =
        value === "console" || value === "output"
          ? "console"
          : value === "repl" || value === "exceptions"
            ? value
            : "logcat";

      queueDockOpenRequest(tab);
      dispatchDockOpenRequest(tab);

      return from.matched.length > 0 ? from.fullPath : "/devices";
    },
  },

  // ── Capacitor ────────────────────────────────────────────────────────────
  {
    path: "/capacitor",
    component: () => import("@/modules/capacitor/CapacitorPanel.vue"),
    redirect: "/capacitor/bridge",
    children: [
      {
        path: "bridge",
        name: "capacitor-bridge",
        component: () => import("@/modules/capacitor/CapacitorBridge.vue"),
      },
      {
        path: "plugins",
        name: "capacitor-plugins",
        component: () => import("@/modules/capacitor/CapacitorPlugins.vue"),
      },
      {
        path: "config",
        name: "capacitor-config",
        component: () => import("@/modules/capacitor/CapacitorConfig.vue"),
      },
      {
        path: "permissions",
        name: "capacitor-permissions",
        component: () => import("@/modules/capacitor/CapacitorPermissions.vue"),
      },
      {
        path: "deeplinks",
        name: "capacitor-deeplinks",
        component: () => import("@/modules/capacitor/CapacitorDeeplinks.vue"),
      },
    ],
  },

  // ── Inspect ──────────────────────────────────────────────────────────────
  {
    path: "/inspect",
    component: () => import("@/modules/inspect/InspectPanel.vue"),
    redirect: "/inspect/elements",
    children: [
      {
        path: "elements",
        name: "inspect-elements",
        component: () => import("@/modules/inspect/ElementsInspector.vue"),
      },
      {
        path: ":pluginId",
        name: "inspect-plugin",
        component: () => import("@/modules/inspect/InspectPluginRoute.vue"),
      },
    ],
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  {
    path: "/settings",
    component: () => import("@/modules/settings/SettingsPanel.vue"),
    redirect: "/settings/general",
    children: [
      {
        path: "general",
        name: "settings-general",
        component: () => import("@/modules/settings/SettingsGeneral.vue"),
      },
      {
        path: "adb",
        name: "settings-adb",
        component: () => import("@/modules/settings/SettingsAdb.vue"),
      },
      {
        path: "chrome",
        name: "settings-chrome",
        component: () => import("@/modules/settings/SettingsChrome.vue"),
      },
      {
        path: "theme",
        name: "settings-theme",
        component: () => import("@/modules/settings/SettingsTheme.vue"),
      },
      {
        path: "shortcuts",
        name: "settings-shortcuts",
        component: () => import("@/modules/settings/SettingsShortcuts.vue"),
      },
    ],
  },

  // ── Catch-all ────────────────────────────────────────────────────────────
  { path: "/:pathMatch(.*)*", redirect: "/devices" },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
