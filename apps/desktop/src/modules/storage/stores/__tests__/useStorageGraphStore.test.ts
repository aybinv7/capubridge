import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import {
  diagramScopeKey,
  graphScopeKey,
  migrateScopeKey,
  useStorageGraphStore,
} from "../useStorageGraphStore";

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

  test("two databases of one app keep their own layouts (C4)", () => {
    const store = useStorageGraphStore();
    const orders = diagramScopeKey(
      "R5",
      "com.shop",
      "sqlite",
      "/data/data/com.shop/databases/a.db",
    );
    const cache = diagramScopeKey("R5", "com.shop", "sqlite", "opfs:/cache.sqlite3");
    store.setNodePositions(orders, [["t", { x: 1, y: 1 }]]);
    store.setNodePositions(cache, [["t", { x: 9, y: 9 }]]);
    expect(store.getNodePosition(orders, "t")).toEqual({ x: 1, y: 1 });
    expect(store.getNodePosition(cache, "t")).toEqual({ x: 9, y: 9 });
    expect(orders).not.toBe(cache);
  });

  test("a database's diagram starts once from the app-wide layout, which stays for the others", () => {
    localStorage.setItem(
      "capubridge:storage-graph:v1",
      JSON.stringify({
        [graphScopeKey("192.168.1.5:5555", "https://other.test", "com.shop")]: scope({
          a: { x: 0, y: 0 },
          b: { x: 0, y: 0 },
        }),
        [graphScopeKey("192.168.1.5:5555", "https://app.test", "com.shop")]: scope({
          orders: { x: 10, y: 20 },
        }),
        [graphScopeKey("192.168.1.5:5555", "https://app.test", "com.other")]: scope({
          x: { x: 5, y: 5 },
        }),
      }),
    );
    const store = useStorageGraphStore();
    const legacy = {
      serial: "192.168.1.5:5555",
      packageName: "com.shop",
      origin: "https://app.test",
    };
    const first = diagramScopeKey(legacy.serial, legacy.packageName, "sqlite", "/d/a.db");
    const second = diagramScopeKey(
      legacy.serial,
      legacy.packageName,
      "indexeddb",
      "https://app.test/shop",
    );

    expect(store.adoptLegacyScope(first, legacy)).toBe(true);
    expect(store.getScope(first).positions).toEqual({ orders: { x: 10, y: 20 } });
    store.setNodePositions(first, [["orders", { x: 99, y: 99 }]]);
    expect(store.adoptLegacyScope(first, legacy)).toBe(false);
    expect(store.getNodePosition(first, "orders")).toEqual({ x: 99, y: 99 });

    expect(store.adoptLegacyScope(second, legacy)).toBe(true);
    expect(store.getNodePosition(second, "orders")).toEqual({ x: 10, y: 20 });
  });

  test("without a layout of its origin, the fullest one of the app is used", () => {
    const store = useStorageGraphStore();
    store.replaceScope(
      graphScopeKey("R5", "https://a.test", "com.shop"),
      scope({ a: { x: 1, y: 1 } }),
    );
    store.replaceScope(
      graphScopeKey("R5", "https://b.test", "com.shop"),
      scope({ a: { x: 2, y: 2 }, b: { x: 2, y: 2 } }),
    );
    const key = diagramScopeKey("R5", "com.shop", "sqlite", "/d/a.db");
    store.adoptLegacyScope(key, { serial: "R5", packageName: "com.shop", origin: "" });
    expect(store.getNodePosition(key, "b")).toEqual({ x: 2, y: 2 });
    expect(
      store.adoptLegacyScope(diagramScopeKey("R6", "com.shop", "sqlite", "/d"), {
        serial: "R6",
        packageName: "com.shop",
        origin: "",
      }),
    ).toBe(false);
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

  test("a layout used every day is kept when the oldest are dropped (B2)", () => {
    const store = useStorageGraphStore();
    store.setNodePosition("daily", "users", { x: 1, y: 1 });
    for (let i = 0; i < 99; i++) store.setNodePosition(`once-${i}`, "t", { x: 0, y: 0 });
    store.setNodePosition("daily", "users", { x: 2, y: 2 });
    store.setNodePosition("one-more", "t", { x: 0, y: 0 });
    expect(store.getNodePosition("daily", "users")).toEqual({ x: 2, y: 2 });
    expect(store.getNodePosition("once-0", "t")).toBeUndefined();
  });
});
