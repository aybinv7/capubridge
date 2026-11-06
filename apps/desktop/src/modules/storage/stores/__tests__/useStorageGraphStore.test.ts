import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { graphScopeKey, migrateScopeKey, useStorageGraphStore } from "../useStorageGraphStore";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  setActivePinia(createPinia());
});

const scope = (positions: Record<string, { x: number; y: number }>) => ({
  positions,
  notes: [],
  manualEdges: [],
  annotations: {},
  groups: [],
});

describe("useStorageGraphStore", () => {
  test("reading a scope writes nothing (C3)", async () => {
    const store = useStorageGraphStore();
    const read = store.getScope(graphScopeKey("R5", "https://app.test", "com.shop"));
    expect(read.groups).toEqual([]);
    expect(Object.keys(store.scopes)).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(localStorage.getItem("capubridge:storage-graph:v1")).toBeNull();
  });

  test("a layout saved under a page id loads after a reload changed the page id (C4)", () => {
    const old = "storage-graph:R5:E3B0C442:https://app.test:com.shop";
    expect(migrateScopeKey(old)).toBe(graphScopeKey("R5", "https://app.test", "com.shop"));
    localStorage.setItem(
      "capubridge:storage-graph:v1",
      JSON.stringify({
        [old]: scope({ orders: { x: 10, y: 20 } }),
        "storage-graph:R5:OLDER:https://app.test:com.shop": scope({}),
      }),
    );
    const store = useStorageGraphStore();
    const key = graphScopeKey("R5", "https://app.test", "com.shop");
    expect(store.getScope(key).positions).toEqual({ orders: { x: 10, y: 20 } });
    expect(Object.keys(store.scopes)).toEqual([key]);
  });

  test("many positions are saved in one write", () => {
    const store = useStorageGraphStore();
    const key = graphScopeKey("R5", "o", "p");
    store.setNodePositions(key, [
      ["a", { x: 1, y: 2 }],
      ["b", { x: 3, y: 4 }],
    ]);
    expect(store.getNodePosition(key, "b")).toEqual({ x: 3, y: 4 });
  });
});
