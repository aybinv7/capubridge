// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useTabsStore } from "../tabs.store";
import type { TabScope } from "@/types/tabs.types";

const targetA: TabScope = { kind: "target", serial: "ABC123", webviewId: "com.acme" };
const targetB: TabScope = { kind: "target", serial: "XYZ789", webviewId: "com.acme" };
const singleton: TabScope = { kind: "singleton" };

describe("tabsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  test("openTab creates a new tab and focuses it", () => {
    const store = useTabsStore();
    const tab = store.openTab("storage", targetA);
    expect(store.tabs).toHaveLength(1);
    expect(store.activeTabId).toBe(tab.id);
    expect(tab.title).toContain("Storage");
  });

  test("openTab dedupes by (tool, scope) — focuses existing", () => {
    const store = useTabsStore();
    const a = store.openTab("storage", targetA);
    const b = store.openTab("storage", targetA);
    expect(store.tabs).toHaveLength(1);
    expect(a.id).toBe(b.id);
  });

  test("different scopes produce distinct tabs", () => {
    const store = useTabsStore();
    store.openTab("storage", targetA);
    store.openTab("storage", targetB);
    expect(store.tabs).toHaveLength(2);
  });

  test("different tools on the same scope produce distinct tabs", () => {
    const store = useTabsStore();
    store.openTab("storage", targetA);
    store.openTab("network", targetA);
    expect(store.tabs).toHaveLength(2);
  });

  test("closeTab removes and picks neighbour for active", () => {
    const store = useTabsStore();
    const t1 = store.openTab("storage", targetA);
    const t2 = store.openTab("network", targetA);
    store.focusTab(t1.id);
    store.closeTab(t1.id);
    expect(store.activeTabId).toBe(t2.id);
  });

  test("closeTab on the only tab sets activeTabId to null", () => {
    const store = useTabsStore();
    const t = store.openTab("settings", singleton);
    store.closeTab(t.id);
    expect(store.tabs).toHaveLength(0);
    expect(store.activeTabId).toBeNull();
  });

  test("moveTab reorders", () => {
    const store = useTabsStore();
    const a = store.openTab("storage", targetA);
    const b = store.openTab("storage", targetB);
    const c = store.openTab("settings", singleton);
    store.moveTab(a.id, 2);
    expect(store.tabs.map((t) => t.id)).toEqual([b.id, c.id, a.id]);
  });

  test("nextTab / prevTab cycle", () => {
    const store = useTabsStore();
    const a = store.openTab("storage", targetA);
    const b = store.openTab("storage", targetB);
    store.focusTab(a.id);
    store.nextTab();
    expect(store.activeTabId).toBe(b.id);
    store.nextTab();
    expect(store.activeTabId).toBe(a.id);
    store.prevTab();
    expect(store.activeTabId).toBe(b.id);
  });

  test("jumpTo focuses tab at given index", () => {
    const store = useTabsStore();
    store.openTab("storage", targetA);
    const b = store.openTab("storage", targetB);
    store.jumpTo(1);
    expect(store.activeTabId).toBe(b.id);
  });

  test("closeOthers keeps only the given tab", () => {
    const store = useTabsStore();
    store.openTab("storage", targetA);
    const b = store.openTab("network", targetA);
    store.openTab("settings", singleton);
    store.closeOthers(b.id);
    expect(store.tabs).toHaveLength(1);
    expect(store.activeTabId).toBe(b.id);
  });

  test("closeToRight trims everything to the right of the given tab", () => {
    const store = useTabsStore();
    const a = store.openTab("storage", targetA);
    store.openTab("network", targetA);
    store.openTab("settings", singleton);
    store.closeToRight(a.id);
    expect(store.tabs).toHaveLength(1);
    expect(store.tabs[0].id).toBe(a.id);
  });
});
