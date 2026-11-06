// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createApp, h, nextTick, type App } from "vue";
import CellEditor from "../editors/CellEditor.vue";
import { editorKindFor } from "../editors/cellEdit";

let app: App | null = null;

afterEach(() => {
  app?.unmount();
  app = null;
  document.body.innerHTML = "";
});

async function mountEditor(value: unknown) {
  const root = document.createElement("div");
  document.body.append(root);
  const committed: unknown[] = [];
  const events: string[] = [];
  const kind = editorKindFor(value) ?? "text";
  app = createApp({
    render: () =>
      h(CellEditor, {
        value,
        kind,
        label: "Edit note",
        onCommit: (next: unknown) => committed.push(next),
        onCancel: () => events.push("cancel"),
        onRejected: (reason: string) => events.push(`rejected: ${reason}`),
        onSave: () => events.push("save"),
      }),
  });
  app.mount(root);
  await nextTick();
  await nextTick();
  return { committed, events };
}

async function type(text: string) {
  const field = document.body.querySelector<HTMLInputElement>('[aria-label="Edit note"]');
  if (!field) throw new Error("no field");
  field.value = text;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  return field;
}

describe("a multi-line cell keeps its line breaks (S1)", () => {
  test("adding one character to a CRLF text commits every line break", async () => {
    const { committed } = await mountEditor("first line\r\nsecond line\r\nthird");
    const field = document.body.querySelector<HTMLTextAreaElement | HTMLInputElement>(
      '[aria-label="Edit note"]',
    );
    expect(field?.tagName).toBe("TEXTAREA");
    if (!field) return;
    field.value = `${field.value}!`;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(committed).toEqual([]);
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
    );
    expect(committed).toEqual(["first line\r\nsecond line\r\nthird!"]);
  });

  test("a single-line text still edits in a one-line field", async () => {
    await mountEditor("tea");
    const field = document.body.querySelector('[aria-label="Edit note"]');
    expect(field?.tagName).toBe("INPUT");
  });
});

describe("leaving a cell with a value that cannot be stored (S12)", () => {
  test("says why instead of cancelling without a word", async () => {
    const { committed, events } = await mountEditor(5);
    const field = await type("abc");
    field.dispatchEvent(new FocusEvent("blur"));
    expect(committed).toEqual([]);
    expect(events).toEqual(["cancel", 'rejected: Not changed: "abc" is not a number']);
  });
});

describe("Ctrl+S in an open cell (U4)", () => {
  test("keeps the change, then asks the host to save", async () => {
    const { committed, events } = await mountEditor("tea");
    const field = await type("green tea");
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    expect(committed).toEqual(["green tea"]);
    expect(events).toEqual(["save"]);
  });
});
