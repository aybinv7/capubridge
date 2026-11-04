import type { RouteRecordRaw } from "vue-router";

export const deviceRoutes = [
  {
    path: "/devices",
    component: () => import("./DevicesPanel.vue"),
    redirect: "/devices/overview",
    children: [
      {
        path: "overview",
        name: "devices-overview",
        component: () => import("./DeviceOverview.vue"),
        meta: { label: "Overview", requires: "device" },
      },
      {
        path: "apps",
        name: "devices-apps",
        component: () => import("./DeviceApps.vue"),
        meta: { label: "Apps", requires: "device" },
      },
      {
        path: "files",
        name: "devices-files",
        component: () => import("./DeviceFiles.vue"),
        meta: { label: "Files", requires: "device" },
      },
      {
        path: "perf",
        name: "devices-performance",
        component: () => import("./DevicePerf.vue"),
        meta: { label: "Performance", requires: "device" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
