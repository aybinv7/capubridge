import type { RouteRecordRaw } from "vue-router";
import { describe, expect, test } from "vite-plus/test";
import { commandPaletteFeatures, featureRegistry, isRouteEnabled } from "@/app/feature-registry";
import { deriveRouteEntries, type RouteSource } from "../routeEntries";

const view = () => Promise.resolve({});

const source: RouteSource = {
  id: "storage",
  label: "Data",
  path: "/storage",
  routes: [
    {
      path: "/storage",
      component: view,
      children: [
        {
          path: "sqlite/:db?/:table?",
          name: "storage-sqlite",
          component: view,
          meta: { label: "SQLite", requires: "data" },
        },
        {
          path: "indexeddb-snapshot/:db?",
          name: "storage-indexeddb-snapshot",
          component: view,
          meta: { label: "IndexedDB", navigation: false },
        },
        { path: "cache", name: "storage-cache", redirect: "/storage/cache-storage" },
        { path: "other-thing", name: "storage-other-thing", component: view },
        {
          path: "mock",
          name: "storage-mock",
          component: view,
          meta: { label: "Mock", maturity: "experimental" },
        },
        { path: ":plugin", name: "storage-plugin", component: view, meta: { label: "Plugin" } },
        { path: "nameless", component: view, meta: { label: "Nameless" } },
      ],
    },
  ] satisfies RouteRecordRaw[],
};

const enabled = (route: RouteRecordRaw) => route.meta?.maturity !== "experimental";

describe("deriveRouteEntries", () => {
  const entries = deriveRouteEntries([source], enabled);

  test("one entry per navigable child, titled with its parent", () => {
    expect(entries.map((entry) => entry.title)).toEqual(["Data › SQLite", "Data › Other Thing"]);
  });

  test("reads the path without its params, and the gate need", () => {
    expect(entries[0]).toMatchObject({
      id: "route.storage-sqlite",
      path: "/storage/sqlite",
      requires: "data",
      label: "SQLite",
      featureId: "storage",
    });
    expect(entries[1]?.requires).toBe("none");
  });

  test("falls back to the route name when there is no label", () => {
    expect(entries[1]?.label).toBe("Other Thing");
  });

  test("skips navigation: false, redirects, dynamic and nameless routes", () => {
    const titles = entries.map((entry) => entry.title);
    expect(titles.join()).not.toMatch(/IndexedDB|Cache|Plugin|Nameless/);
  });

  test("skips routes the predicate refuses, and brings them back when it allows them", () => {
    expect(entries.some((entry) => entry.label === "Mock")).toBe(false);
    const all = deriveRouteEntries([source], () => true);
    expect(all.some((entry) => entry.label === "Mock")).toBe(true);
  });

  test("a feature with no child routes has no entries", () => {
    const lone: RouteSource = {
      id: "replay",
      label: "Replay",
      path: "/replay",
      routes: [{ path: "/replay", name: "replay", component: view }],
    };
    expect(deriveRouteEntries([lone], enabled)).toEqual([]);
  });
});

describe("the app's own routes", () => {
  const titles = deriveRouteEntries(commandPaletteFeatures, (route) =>
    isRouteEnabled(route, false),
  ).map((entry) => entry.title);

  test("offers the sub-tabs the screens show", () => {
    expect(titles).toContain("Data › SQLite");
    expect(titles).toContain("Data › IndexedDB");
    expect(titles).toContain("Device › Files");
    expect(titles).toContain("Network › Requests");
    expect(titles).toContain("Settings › Appearance");
  });

  test("leaves out experimental tabs until they are enabled", () => {
    expect(titles).not.toContain("Network › Mocking");
    const withExperimental = deriveRouteEntries(commandPaletteFeatures, () => true).map(
      (entry) => entry.title,
    );
    expect(withExperimental).toContain("Network › Mocking");
  });

  test("leaves out hidden features and navigation: false routes", () => {
    const hidden = featureRegistry.filter((feature) => feature.maturity === "hidden");
    for (const feature of hidden) {
      expect(titles.some((title) => title.startsWith(`${feature.label} ›`))).toBe(false);
    }
    expect(titles.filter((title) => title === "Data › IndexedDB")).toHaveLength(1);
    expect(titles.filter((title) => title === "Data › SQLite")).toHaveLength(1);
  });
});
