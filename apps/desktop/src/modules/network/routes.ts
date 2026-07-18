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
        component: () => import("./NetworkRequests.vue"),
        meta: { label: "Requests" },
      },
      {
        path: "mock",
        name: "network-mock",
        component: () => import("./NetworkMock.vue"),
        meta: { label: "Mocking", maturity: "experimental" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
