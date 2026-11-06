// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";
import type { GridColumn } from "@/shared/components/data/grid";

vi.mock("@/shared/components/data/JsonEditor.vue", () => ({
  default: defineComponent({ name: "JsonEditor", render: () => h("div") }),
}));
vi.mock("@/shared/code-viewer/JsonDiff.vue", () => ({
  default: defineComponent({ name: "JsonDiff", render: () => h("div") }),
}));

const { default: RecordPane } = await import("../RecordPane.vue");

let app: App | null = null;
let root: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  root?.remove();
  app = null;
  root = null;
});

const columns: GridColumn[] = [
  { id: "id", title: "id", type: "integer", primaryKey: true },
  { id: "payload", title: "payload", type: "text" },
  { id: "partner_id", title: "partner_id", type: "integer", foreignKey: "res_partner.id" },
];
const cells = { id: 7, payload: '{"state":"draft"}', partner_id: 77 };

async function mount(maximized = false) {
  const maximize: boolean[] = [];
  const follows: [string, unknown][] = [];
  const closes: number[] = [];
  const state = ref(maximized);
  root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  app = createApp({
    render: () =>
      h(RecordPane, {
        title: "id 7",
        columns,
        cells,
        value: cells,
        readOnlyReason: null,
        jsonEditable: false,
        canDelete: false,
        canPrev: false,
        canNext: false,
        maximizable: true,
        maximized: state.value,
        onMaximize: (next: boolean) => {
          maximize.push(next);
          state.value = next;
        },
        onFollowForeignKey: (target: string, value: unknown) => follows.push([target, value]),
        onClose: () => closes.push(1),
      }),
  });
  app.mount(root);
  await nextTick();
  const section = root.querySelector<HTMLElement>("[data-record-pane]");
  if (!section) throw new Error("no pane");
  return { maximize, follows, closes, section, root };
}

function key(target: HTMLElement, init: KeyboardEventInit) {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

describe("record pane", () => {
  test("Shift+Space fills the workspace and Esc puts it back before closing", async () => {
    const pane = await mount();
    key(pane.section, { key: " ", shiftKey: true });
    await nextTick();
    expect(pane.maximize).toEqual([true]);
    key(pane.section, { key: "Escape" });
    await nextTick();
    expect(pane.maximize).toEqual([true, false]);
    expect(pane.closes).toEqual([]);
  });

  test("Shift+Space while typing in the find field types a space", async () => {
    const pane = await mount();
    const input = pane.root.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("no find field");
    key(input, { key: " ", shiftKey: true });
    expect(pane.maximize).toEqual([]);
  });

  test("text holding JSON is shown parsed and labelled as stored text", async () => {
    const pane = await mount();
    expect(pane.root.textContent).toContain("stored as text");
    expect(pane.root.textContent).toContain('"state": "draft"');
  });

  test("a foreign key offers to open the row it points at", async () => {
    const pane = await mount();
    const link = pane.root.querySelector<HTMLButtonElement>(
      "button[aria-label='Open the linked row in res_partner.id']",
    );
    link?.click();
    expect(pane.follows).toEqual([["res_partner.id", 77]]);
  });
});
