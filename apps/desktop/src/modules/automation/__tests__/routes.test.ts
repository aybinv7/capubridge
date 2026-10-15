import { describe, expect, test } from "vite-plus/test";
import type { RouteRecordRaw } from "vue-router";
import { automationRoutes } from "../routes";

function allRoutes(): RouteRecordRaw[] {
  return automationRoutes;
}

describe("automationRoutes", () => {
  test("there are exactly four routes", () => {
    expect(allRoutes()).toHaveLength(4);
  });

  test("the base automation route renders the workbench", () => {
    const base = allRoutes().find((route) => route.path === "/automation");
    expect(base).toBeDefined();
    expect(typeof base?.component).toBe("function");
  });

  test("the flow route has a :flowId param", () => {
    const flow = allRoutes().find((route) => route.path === "/automation/f/:flowId");
    expect(flow).toBeDefined();
    expect(typeof flow?.component).toBe("function");
  });

  test("the run route has a :runId param", () => {
    const run = allRoutes().find((route) => route.path === "/automation/runs/:runId");
    expect(run).toBeDefined();
    expect(typeof run?.component).toBe("function");
  });

  test("the step route has :runId and :index params and rejects non-numeric index", () => {
    const step = allRoutes().find((route) => route.path === "/automation/runs/:runId/step/:index");
    expect(step).toBeDefined();
    expect(typeof step?.component).toBe("function");
    expect(typeof step?.beforeEnter).toBe("function");
    const guard = step!.beforeEnter as Function;
    const result = guard({ params: { runId: "r1", index: "abc" } }, {}, () => {});
    expect(result).toEqual({ path: "/automation" });
  });

  test("the step route accepts a numeric index", () => {
    const step = allRoutes().find((route) => route.path === "/automation/runs/:runId/step/:index");
    const guard = step!.beforeEnter as Function;
    const result = guard({ params: { runId: "r1", index: "3" } }, {}, () => {});
    expect(result).toBe(true);
  });

  test("every route component is a lazy import", () => {
    for (const route of allRoutes()) {
      expect(typeof route.component).toBe("function");
    }
  });

  test("no route declares a meta label", () => {
    for (const route of allRoutes()) {
      expect(route.meta?.label).toBeUndefined();
    }
  });

  test("no route has children", () => {
    for (const route of allRoutes()) {
      expect(route.children).toBeUndefined();
    }
  });
});
