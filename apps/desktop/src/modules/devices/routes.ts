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
        meta: { label: "Overview" },
      },
      {
        path: "apps",
        name: "devices-apps",
        component: () => import("./DeviceApps.vue"),
        meta: { label: "Apps" },
      },
      {
        path: "files",
        name: "devices-files",
        component: () => import("./DeviceFiles.vue"),
        meta: { label: "Files" },
      },
      {
        path: "perf",
        name: "devices-performance",
        component: () => import("./DevicePerf.vue"),
        meta: { label: "Performance" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
