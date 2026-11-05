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
        component: () => import("./overview/AppOverview.vue"),
        meta: { label: "Overview", requires: "app-target" },
      },
      {
        path: "performance",
        name: "app-performance",
        component: () => import("./perf/AppPerformance.vue"),
        meta: { label: "Performance", requires: "app-target" },
      },
      {
        path: "data-usage",
        redirect: { name: "app-performance", hash: "#totals" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
