// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, shallowRef, type App } from "vue";

vi.mock("../KvValueRead.vue", () => ({
  default: defineComponent({ name: "KvValueRead", render: () => h("div") }),
}));

const { default: KvPane } = await import("../KvPane.vue");
const { areaEntries } = await import("../kvModel");

let app: App | null = null;
let root: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  root?.remove();
  app = null;
  root = null;
});

function entry(value: string) {
  const [first] = areaEntries([{ key: "prefs", value }]);
  if (!first) throw new Error("no entry");
  return first;
}

async function mount(value: string) {
  const current = shallowRef(entry(value));
  const dirty: boolean[] = [];
  const saves: { key: string; value: string }[] = [];
  let pane: { edit: (field: "key" | "value") => Promise<void> } | null = null;
  root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  app = createApp({
    render: () =>
      h(KvPane, {
        ref: (instance: unknown) => (pane = instance as typeof pane),
        kind: "local",
        entry: current.value,
        position: "1 of 1",
        stateText: null,
        blockedReason: null,
        saving: false,
        canPrev: false,
        canNext: false,
        onDirty: (next: boolean) => dirty.push(next),
        onSave: (request: { key: string; value: string }) => saves.push(request),
      }),
  });
  app.mount(root);
  await nextTick();
  return { current, dirty, saves, pane: () => pane, root };
}

function typeInto(element: HTMLTextAreaElement, text: string) {
  element.value = text;
  element.dispatchEvent(new Event("input"));
}

describe("the key-value pane", () => {
  test("opening a minified JSON value does not mark it changed (C29)", async () => {
    const view = await mount('{"a":1,"b":[1,2]}');
    await view.pane()?.edit("value");
    await nextTick();
    expect(view.dirty.at(-1)).toBe(false);
    expect(view.root.textContent).not.toContain("Not saved");
  });

  test("a fresh read of the same key does not replace an unsaved edit (S6)", async () => {
    const view = await mount('{"a":1}');
    await view.pane()?.edit("value");
    await nextTick();
    const textarea = view.root.querySelector("textarea");
    if (!textarea) throw new Error("no editor");
    typeInto(textarea, '{"a":2}');
    await nextTick();
    expect(view.dirty.at(-1)).toBe(true);
    view.current.value = entry('{"a":"app"}');
    await nextTick();
    expect(view.root.querySelector("textarea")?.value).toBe('{"a":2}');
  });

  test("JSON that does not parse cannot be saved, and says so once", async () => {
    vi.useFakeTimers();
    const view = await mount('{"a":1}');
    await view.pane()?.edit("value");
    await nextTick();
    const textarea = view.root.querySelector("textarea");
    if (!textarea) throw new Error("no editor");
    typeInto(textarea, '{"a":');
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    vi.useRealTimers();
    expect(view.root.textContent).toContain("The JSON is not valid");
    view.root
      .querySelector("section")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    expect(view.saves).toEqual([]);
  });

  test("Save sends the text exactly as typed", async () => {
    const view = await mount("plain");
    await view.pane()?.edit("value");
    await nextTick();
    const textarea = view.root.querySelector("textarea");
    if (!textarea) throw new Error("no editor");
    typeInto(textarea, "  two  spaces ");
    await nextTick();
    view.root
      .querySelector("section")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    expect(view.saves).toEqual([{ key: "prefs", value: "  two  spaces ", mode: "text" }]);
  });
});
