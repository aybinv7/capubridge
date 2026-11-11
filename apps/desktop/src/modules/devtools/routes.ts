import type { RouteRecordRaw } from "vue-router";

export const devtoolsRoutes = [
  {
    path: "/devtools",
    component: () => import("./DevtoolsPanel.vue"),
    redirect: "/devtools/chrome",
    children: [
      {
        path: "chrome",
        name: "devtools-chrome",
        component: () => import("./BrowserDevtoolsRoute.vue"),
        meta: {
          label: "Chrome DevTools",
          requires: "target",
          keywords: ["console", "sources", "performance", "memory", "application", "lighthouse"],
        },
      },
      {
        path: "vue",
        name: "devtools-vue",
        component: () => import("./FrameworkDevtoolsRoute.vue"),
        props: { framework: "vue" },
        meta: { label: "Vue", requires: "target", keywords: ["components", "pinia", "router"] },
      },
      {
        path: "react",
        name: "devtools-react",
        component: () => import("./FrameworkDevtoolsRoute.vue"),
        props: { framework: "react" },
        meta: { label: "React", requires: "target", keywords: ["components", "profiler", "hooks"] },
      },
    ],
  },
] satisfies RouteRecordRaw[];
