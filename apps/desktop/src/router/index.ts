import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { registeredFeatureRoutes } from "@/app/feature-registry";
import {
  dispatchDrawerOpenRequest,
  drawerRequestFor,
  queueDrawerOpenRequest,
} from "@/lib/drawer/drawerEvents";

const shellRoutes: RouteRecordRaw[] = [
  { path: "/", redirect: "/devices" },
  ...registeredFeatureRoutes,
  {
    path: "/console/:tab?",
    component: { render: () => null },
    beforeEnter: (to, from) => {
      const value = Array.isArray(to.params.tab) ? to.params.tab[0] : to.params.tab;
      const request = drawerRequestFor(value);

      queueDrawerOpenRequest(request);
      dispatchDrawerOpenRequest(request);

      return from.matched.length > 0 ? from.fullPath : "/devices";
    },
  },
  { path: "/:pathMatch(.*)*", redirect: "/devices" },
];

export default createRouter({
  history: createWebHashHistory(),
  routes: shellRoutes,
});
