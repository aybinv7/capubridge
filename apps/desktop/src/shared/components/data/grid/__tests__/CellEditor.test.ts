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
  const kind = editorKindFor(value) ?? "text";
  app = createApp({
    render: () =>
      h(CellEditor, {
        value,
        kind,
        label: "Edit note",
        onCommit: (next: unknown) => committed.push(next),
      }),
  });
  app.mount(root);
  await nextTick();
  await nextTick();
  return { committed };
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
