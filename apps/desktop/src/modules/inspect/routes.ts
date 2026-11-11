import type { RouteRecordRaw } from "vue-router";

export const inspectRoutes = [
  {
    path: "/inspect",
    component: () => import("./InspectPanel.vue"),
    redirect: "/inspect/elements",
    children: [
      {
        path: "elements",
        name: "inspect-elements",
        component: () => import("./ElementsInspector.vue"),
        meta: { label: "Elements", requires: "target" },
      },
      { path: "vue", redirect: "/devtools/vue" },
      { path: "react", redirect: "/devtools/react" },
    ],
  },
] satisfies RouteRecordRaw[];
