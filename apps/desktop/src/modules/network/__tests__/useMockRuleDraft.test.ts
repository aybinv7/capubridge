import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { effectScope, nextTick, ref, type EffectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useMockStore } from "../stores/useMockStore";
import { DRAFT_SAVE_MS, useMockRuleDraft } from "../mock/useMockRuleDraft";
import { memoryMockPersistence } from "../stores/mockRulesDb";
import { setMockPersistenceFactory } from "../stores/useMockPersistence";
import { createStorage } from "./storage";

vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

let scope: EffectScope;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: createStorage() });
  setMockPersistenceFactory(() => memoryMockPersistence({}));
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

  test("edits save after a pause and keep a switch flipped meanwhile", async () => {
    const { store, first, draft } = setup();

    draft.value = { ...draft.value!, name: "Renamed" };
    store.setRuleEnabled(first, false);
    await nextTick();
    expect(draft.value?.name).toBe("Renamed");
    await flushSave();

    const saved = store.rules.find((rule) => rule.id === first);
    expect(saved?.name).toBe("Renamed");
    expect(saved?.enabled).toBe(false);
  });

  test("an edit made just before the app changes is saved to its own app", async () => {
    const { store, first, draft } = setup();
    draft.value = { ...draft.value!, statusCode: 418 };

    store.setScope("adb:phone:b");
    await nextTick();
    store.setScope("adb:phone:a");

    expect(store.rules.find((rule) => rule.id === first)?.statusCode).toBe(418);
  });

  test("save() writes a pending edit at once, for export and duplicate", () => {
    const { store, first, draft, save } = setup();
    draft.value = { ...draft.value!, name: "Exported" };
    save();
    expect(store.rules.find((rule) => rule.id === first)?.name).toBe("Exported");
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

  test("opening a JSON rule keeps its body byte for byte", () => {
    const { draft } = setup();
    expect(draft.value?.responseBody).toBe('{"a":1}');
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
