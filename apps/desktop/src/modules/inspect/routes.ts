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
        meta: { label: "Elements" },
      },
      {
        path: ":pluginId",
        name: "inspect-plugin",
        component: () => import("./InspectPluginRoute.vue"),
        meta: { navigation: false },
      },
    ],
  },
] satisfies RouteRecordRaw[];
