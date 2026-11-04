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
      {
        path: ":pluginId",
        name: "inspect-plugin",
        component: () => import("./InspectPluginRoute.vue"),
        meta: { navigation: false, requires: "target" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
