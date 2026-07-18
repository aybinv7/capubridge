import type { RouteRecordRaw } from "vue-router";

export const browserPreviewRoutes = [
  {
    path: "/preview",
    name: "browser-preview",
    component: () => import("./BrowserPreviewPanel.vue"),
  },
] satisfies RouteRecordRaw[];
