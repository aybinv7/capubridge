// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useTabStateStore } from "../tabState.store";

describe("tabStateStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  test("ensure creates a default state slice for the tool", () => {
    const store = useTabStateStore();
    const state = store.ensure("t1", "storage");
    expect(state.tool).toBe("storage");
    expect(state).toMatchObject({ tool: "storage", subTool: "idb" });
  });

  test("ensure returns existing slice when tool matches", () => {
    const store = useTabStateStore();
    store.ensure("t1", "storage");
    store.patch<{
      tool: "storage";
      subTool:
        | "idb"
        | "localStorage"
        | "cache"
        | "opfs"
        | "sqlite"
        | "localforage"
        | "graph"
        | "changes"
        | "sqlite-wasm";
    }>("t1", { subTool: "localStorage" });
    const again = store.ensure("t1", "storage");
    expect(again).toMatchObject({ tool: "storage", subTool: "localStorage" });
  });

  test("ensure replaces slice if tool changes", () => {
    const store = useTabStateStore();
    store.ensure("t1", "storage");
    const next = store.ensure("t1", "network");
    expect(next.tool).toBe("network");
  });

  test("set + get roundtrip", () => {
    const store = useTabStateStore();
    store.set("t1", { tool: "network", selectedRequestId: "req-42" });
    expect(store.get("t1")).toEqual({ tool: "network", selectedRequestId: "req-42" });
  });

  test("dispose removes slice", () => {
    const store = useTabStateStore();
    store.ensure("t1", "storage");
    store.dispose("t1");
    expect(store.get("t1")).toBeNull();
  });

  test("pruneTo drops slices not in the keep list", () => {
    const store = useTabStateStore();
    store.ensure("t1", "storage");
    store.ensure("t2", "network");
    store.ensure("t3", "inspect");
    store.pruneTo(["t1", "t3"]);
    expect(store.get("t1")).not.toBeNull();
    expect(store.get("t2")).toBeNull();
    expect(store.get("t3")).not.toBeNull();
  });
});
