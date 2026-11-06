import { describe, expect, test } from "vite-plus/test";
import type { RouteLocationNormalized } from "vue-router";
import { createDataPlaces } from "../dataPlaces";

function at(name: string, query: Record<string, string> = {}): RouteLocationNormalized {
  return { name, query, params: {} } as unknown as RouteLocationNormalized;
}

describe("each Data tab remembers where it was left (U6)", () => {
  test("coming back from another tab opens the cache or folder left open", () => {
    const places = createDataPlaces();
    places.remember("t1", at("storage-cache-storage", { cache: "api" }));
    expect(places.restore("t1", at("storage-cache-storage"), at("storage-opfs"))).toMatchObject({
      name: "storage-cache-storage",
      query: { cache: "api" },
    });
  });

  test("never undoes opening the landing from inside the tab, nor crosses targets", () => {
    const places = createDataPlaces();
    places.remember("t1", at("storage-opfs", { path: "logs" }));
    expect(
      places.restore("t1", at("storage-opfs"), at("storage-opfs", { path: "logs" })),
    ).toBeNull();
    expect(places.restore("t2", at("storage-opfs"), at("storage-keyvalue"))).toBeNull();
    expect(
      places.restore("t1", at("storage-opfs", { path: "other" }), at("storage-keyvalue")),
    ).toBeNull();
  });
});
