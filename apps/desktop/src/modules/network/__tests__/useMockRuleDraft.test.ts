import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { effectScope, nextTick, ref, type EffectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useMockStore } from "../stores/useMockStore";
import { DRAFT_SAVE_MS, useMockRuleDraft } from "../mock/useMockRuleDraft";

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

let scope: EffectScope;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: createStorage() });
  setActivePinia(createPinia());
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
  vi.useRealTimers();
});

async function flushSave() {
  await nextTick();
  vi.advanceTimersByTime(DRAFT_SAVE_MS + 10);
  await nextTick();
}

function setup() {
  const store = useMockStore();
  store.setScope("adb:phone:a");
  const first = store.addRule({ name: "First", responseBody: '{"a":1}' });
  const second = store.addRule({ name: "Second" });
  const selected = ref<string | null>(first);
  const result = scope.run(() => useMockRuleDraft(selected));
  if (!result) throw new Error("draft did not start");
  return { store, first, second, selected, ...result };
}

describe("mock rule draft lifecycle", () => {
  test("opening a rule does not write it back", async () => {
    const { store, first } = setup();
    const before = store.rules.find((rule) => rule.id === first)?.responseBody;

    await flushSave();

    expect(store.rules.find((rule) => rule.id === first)?.responseBody).toBe(before);
  });

  test("edits save after a pause and keep hits counted meanwhile", async () => {
    const { store, first, draft } = setup();
    store.incrementHitCount(first);
    await nextTick();

    draft.value = { ...draft.value!, name: "Renamed" };
    store.incrementHitCount(first);
    await flushSave();

    const saved = store.rules.find((rule) => rule.id === first);
    expect(saved?.name).toBe("Renamed");
    expect(saved?.hitCount).toBe(2);
  });

  test("switching rules saves the pending edit to the rule it belongs to", async () => {
    const { store, first, second, selected, draft } = setup();
    draft.value = { ...draft.value!, statusCode: 503 };

    selected.value = second;
    await nextTick();

    expect(store.rules.find((rule) => rule.id === first)?.statusCode).toBe(503);
    expect(draft.value?.name).toBe("Second");
    await flushSave();
    expect(store.rules.find((rule) => rule.id === second)?.statusCode).toBe(200);
  });

  test("a change made elsewhere replaces the draft", async () => {
    const { store, first, draft } = setup();
    const stored = store.rules.find((rule) => rule.id === first)!;

    store.updateRule({ ...stored, urlPattern: "/from-mcp" });
    await nextTick();

    expect(draft.value?.urlPattern).toBe("/from-mcp");
  });

  test("the echo of a save does not reformat what is being typed", async () => {
    const { draft } = setup();
    draft.value = { ...draft.value!, responseBody: '{"typed":true}' };

    await flushSave();

    expect(draft.value?.responseBody).toBe('{"typed":true}');
  });

  test("a deleted rule or another target's workspace clears the draft", async () => {
    const { store, first, draft } = setup();

    store.deleteRule(first);
    await nextTick();
    expect(draft.value).toBeNull();
  });

  test("switching the target's workspace clears the draft", async () => {
    const { store, draft } = setup();

    store.setScope("adb:phone:b");
    await nextTick();

    expect(draft.value).toBeNull();
  });
});
