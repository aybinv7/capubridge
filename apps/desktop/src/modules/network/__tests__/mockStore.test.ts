import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import { memoryMockPersistence } from "@/modules/network/stores/mockRulesDb";
import {
  MOCK_SAVE_DEBOUNCE_MS,
  setMockPersistenceFactory,
} from "@/modules/network/stores/useMockPersistence";
import { createStorage } from "./storage";

vi.mock("vue-sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

let persistence: ReturnType<typeof memoryMockPersistence>;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: createStorage() });
  persistence = memoryMockPersistence({});
  setMockPersistenceFactory(() => persistence);
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle() {
  await vi.advanceTimersByTimeAsync(MOCK_SAVE_DEBOUNCE_MS + 10);
}

describe("mock rule state", () => {
  test("disabled rules cannot match intercepted requests", async () => {
    const store = useMockStore();
    await store.ready;
    store.setScope("app:device-a:com.shop");
    const id = store.addRule({ method: "POST", urlPattern: "/api/planning/recommend" });

    expect(store.findMatchingRule("POST", "https://example.test/api/planning/recommend")?.id).toBe(
      id,
    );

    store.setRuleEnabled(id, false);

    expect(store.enabledCount).toBe(0);
    expect(
      store.findMatchingRule("POST", "https://example.test/api/planning/recommend"),
    ).toBeNull();
  });

  test("rule state remains isolated by app", async () => {
    const store = useMockStore();
    await store.ready;
    store.setScope("app:device-a:com.a");
    const id = store.addRule({ name: "A" });
    store.setRuleEnabled(id, false);

    store.setScope("app:device-a:com.b");
    expect(store.rules).toHaveLength(0);

    store.setScope("app:device-a:com.a");
    expect(store.rules[0]?.enabled).toBe(false);
  });

  test("hits are counted in memory and never rewrite the stored rules", async () => {
    const store = useMockStore();
    await store.ready;
    store.setScope("app:d:com.a");
    const id = store.addRule({ name: "A" });
    await settle();
    const save = vi.spyOn(persistence, "save");
    const before = store.rules[0];

    for (let index = 0; index < 50; index += 1) store.incrementHitCount(id);
    await settle();

    expect(store.hitCountOf(id)).toBe(50);
    expect(store.rules[0]).toBe(before);
    expect(save).not.toHaveBeenCalled();
    store.clearHitCounts();
    expect(store.anyHits).toBe(false);
  });

  test("saves are debounced into one write of the changed app only", async () => {
    const store = useMockStore();
    await store.ready;
    store.setScope("app:d:com.a");
    const save = vi.spyOn(persistence, "save");
    store.addRule({ name: "1" });
    store.addRule({ name: "2" });
    store.addRule({ name: "3" });
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
    expect([...(save.mock.calls[0]?.[0].keys() ?? [])]).toEqual(["app:d:com.a"]);
    expect(persistence.saved?.["app:d:com.a"]?.rules).toHaveLength(3);
  });

  test("a failed save is kept as an error and retried with the next change", async () => {
    const store = useMockStore();
    await store.ready;
    store.setScope("app:d:com.a");
    persistence.fail = new Error("quota");
    store.addRule({ name: "1" });
    await settle();
    expect(store.saveError).toBe("quota");

    persistence.fail = undefined;
    store.addRule({ name: "2" });
    await settle();
    expect(store.saveError).toBeNull();
    expect(persistence.saved?.["app:d:com.a"]?.rules).toHaveLength(2);
  });

  test("undo puts a deleted rule back in its own app and place", async () => {
    const store = useMockStore();
    await store.ready;
    store.setScope("app:d:com.a");
    const first = store.addRule({ name: "first" });
    store.addRule({ name: "second" });
    const removed = store.deleteRule(first);
    store.setScope("app:d:com.b");

    store.restoreRule(removed!);

    expect(store.rules).toHaveLength(0);
    store.setScope("app:d:com.a");
    expect(store.rules.map((rule) => rule.name)).toEqual(["second", "first"]);
  });

  test("listeners run before the scope changes", async () => {
    const store = useMockStore();
    await store.ready;
    store.setScope("app:d:com.a");
    const seen: string[] = [];
    store.onBeforeScopeChange(() => seen.push(store.currentScope));
    store.setScope("app:d:com.b");
    expect(seen).toEqual(["app:d:com.a"]);
  });
});
