import type { RouteRecordRaw } from "vue-router";

export const recordingRoutes = [
  {
    path: "/replay",
    name: "replay",
    component: () => import("./ReplayView.vue"),
  },
] satisfies RouteRecordRaw[];
