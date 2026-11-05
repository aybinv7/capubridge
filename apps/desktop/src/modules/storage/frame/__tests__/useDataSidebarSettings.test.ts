import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { dataScope, useDataSidebarSettings } from "../useDataSidebarSettings";

const phoneA = dataScope("A1", "com.shop", "indexeddb");
const phoneB = dataScope("B2", "com.shop", "indexeddb");

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

describe("useDataSidebarSettings", () => {
  test("pins are kept per phone and app", () => {
    const settings = useDataSidebarSettings();
    settings.togglePinned(phoneA, "https://app::shop");
    expect(settings.source(phoneA, "https://app::shop").pinned).toBe(true);
    expect(settings.source(phoneB, "https://app::shop").pinned).toBe(false);
  });

  test("the old IndexedDB settings move under the new key once and still seed every phone", () => {
    localStorage.setItem(
      "idb-sidebar-settings",
      JSON.stringify({
        pinnedDbs: ["https://app::shop"],
        hiddenDbs: [],
        pinnedStores: ["shop::orders", "other::orders"],
        hiddenStores: ["shop::logs"],
        expandedDbs: ["shop"],
        showHidden: false,
        showHiddenDbs: false,
      }),
    );
    const settings = useDataSidebarSettings();
    expect(settings.source(phoneA, "https://app::shop")).toEqual({
      pinned: true,
      hidden: false,
      expanded: true,
      pinnedItems: ["orders"],
      hiddenItems: ["logs"],
    });
    expect(localStorage.getItem("idb-sidebar-settings")).toBeNull();
    setActivePinia(createPinia());
    expect(useDataSidebarSettings().source(phoneB, "https://app::shop").pinned).toBe(true);
  });

  test("hiding a store persists under the versioned key", () => {
    const settings = useDataSidebarSettings();
    settings.toggleItemHidden(phoneA, "https://app::shop", "logs");
    const saved = JSON.parse(localStorage.getItem("capubridge:data-sidebar:v1") ?? "{}");
    expect(saved.sources[`${phoneA}::https://app::shop`].hiddenItems).toEqual(["logs"]);
  });
});
