import type { RouteRecordRaw } from "vue-router";

export const networkRoutes = [
  {
    path: "/network",
    component: () => import("./NetworkPanel.vue"),
    redirect: "/network/requests",
    children: [
      {
        path: "requests",
        name: "network-requests",
        component: () => import("./requests/NetworkRequests.vue"),
        meta: { label: "Requests", requires: "target" },
      },
      {
        path: "mock",
        name: "network-mock",
        component: () => import("./mock/NetworkMock.vue"),
        meta: { label: "Mocking", maturity: "experimental" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
