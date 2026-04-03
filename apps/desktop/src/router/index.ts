import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/devices" },
  {
    path: "/devices",
    component: () => import("@/modules/devices/DevicesPanel.vue"),
  },
  {
    path: "/storage",
    component: () => import("@/modules/storage/StoragePanel.vue"),
  },
  {
    path: "/network",
    component: () => import("@/modules/network/NetworkPanel.vue"),
  },
  {
    path: "/console",
    component: () => import("@/modules/console/ConsolePanel.vue"),
  },
  {
    path: "/hybrid",
    component: () => import("@/modules/hybrid/HybridPanel.vue"),
  },
  {
    path: "/settings",
    component: () => import("@/modules/settings/SettingsPanel.vue"),
  },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
