import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { registeredFeatureRoutes } from "@/app/feature-registry";
import { dispatchDockOpenRequest, queueDockOpenRequest } from "@/lib/dock-events";

const shellRoutes: RouteRecordRaw[] = [
  { path: "/", redirect: "/devices" },
  ...registeredFeatureRoutes,
  {
    path: "/console/:tab?",
    component: { render: () => null },
    beforeEnter: (to, from) => {
      const value = Array.isArray(to.params.tab) ? to.params.tab[0] : to.params.tab;
      const tab =
        value === "console" || value === "output"
          ? "console"
          : value === "repl" || value === "exceptions"
            ? value
            : "logcat";

      queueDockOpenRequest(tab);
      dispatchDockOpenRequest(tab);

      return from.matched.length > 0 ? from.fullPath : "/devices";
    },
  },
  { path: "/:pathMatch(.*)*", redirect: "/devices" },
];

export default createRouter({
  history: createWebHashHistory(),
  routes: shellRoutes,
});
