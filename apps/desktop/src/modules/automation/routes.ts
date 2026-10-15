import type { RouteRecordRaw } from "vue-router";

export const automationRoutes = [
  {
    path: "/automation",
    component: () => import("./AutomationWorkbench.vue"),
  },
  {
    path: "/automation/f/:flowId",
    component: () => import("./AutomationWorkbench.vue"),
  },
  {
    path: "/automation/runs/:runId",
    component: () => import("./AutomationWorkbench.vue"),
  },
  {
    path: "/automation/runs/:runId/step/:index",
    component: () => import("./AutomationWorkbench.vue"),
    beforeEnter: (to) => {
      const index = Number(to.params.index);
      if (!Number.isFinite(index) || index < 0 || !Number.isInteger(index)) {
        return { path: "/automation" };
      }
      return true;
    },
  },
] satisfies RouteRecordRaw[];
