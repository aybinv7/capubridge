import { beforeEach, describe, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useMockStore } from "@/modules/network/stores/useMockStore";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("mock rule state", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createStorage(),
    });
    localStorage.clear();
    setActivePinia(createPinia());
  });

  test("disabled rules cannot match intercepted requests", () => {
    const store = useMockStore();
    store.setScope("adb:device-a:target-a");
    const id = store.addRule({
      method: "POST",
      urlPattern: "/api/planning/recommend",
    });

    expect(store.findMatchingRule("POST", "https://example.test/api/planning/recommend")?.id).toBe(
      id,
    );

    store.setRuleEnabled(id, false);

    expect(store.rules.find((rule) => rule.id === id)?.enabled).toBe(false);
    expect(store.enabledCount).toBe(0);
    expect(
      store.findMatchingRule("POST", "https://example.test/api/planning/recommend"),
    ).toBeNull();
  });

  test("rule state remains isolated by device and target", () => {
    const store = useMockStore();
    store.setScope("adb:device-a:target-a");
    const id = store.addRule({ name: "Target A" });
    store.setRuleEnabled(id, false);

    store.setScope("adb:device-a:target-b");
    expect(store.rules).toHaveLength(0);

    store.setScope("adb:device-a:target-a");
    expect(store.rules).toHaveLength(1);
    expect(store.rules[0]?.enabled).toBe(false);
  });
});
