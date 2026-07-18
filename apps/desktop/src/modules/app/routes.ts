import type { RouteRecordRaw } from "vue-router";

export const appRoutes = [
  {
    path: "/app",
    component: () => import("./AppPanel.vue"),
    redirect: "/app/overview",
    children: [
      {
        path: "overview",
        name: "app-overview",
        component: () => import("./AppInspectorPanel.vue"),
        meta: { label: "Overview" },
      },
      {
        path: "performance",
        name: "app-performance",
        component: () => import("./AppPerformancePage.vue"),
        meta: { label: "Performance" },
      },
      {
        path: "data-usage",
        name: "app-data-usage",
        component: () => import("./AppDataUsagePage.vue"),
        meta: { label: "Data Usage" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
