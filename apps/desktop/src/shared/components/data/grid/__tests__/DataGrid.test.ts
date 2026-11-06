// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createApp, h, nextTick, type App } from "vue";
import DataGrid from "../DataGrid.vue";
import type { GridColumn, GridRow, GridSort, GridSummary } from "../types";

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

for (const [property, value] of [
  ["offsetWidth", 1200],
  ["offsetHeight", 720],
  ["clientWidth", 1200],
  ["clientHeight", 720],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, { configurable: true, get: () => value });
}

const columns: GridColumn[] = [
  { id: "id", title: "id", type: "integer", primaryKey: true },
  { id: "name", title: "name", type: "text" },
  { id: "score", title: "score", type: "real" },
];
const rows: GridRow[] = Array.from({ length: 30 }, (_, i) => ({
  id: `pk:${i + 1}`,
  cells: { id: i + 1, name: i === 2 ? null : `user ${i + 1}`, score: (i + 1) * 10 },
}));

interface Mounted {
  root: HTMLElement;
  grid: HTMLElement;
  events: Record<string, unknown[][]>;
  app: App;
}

let mounted: Mounted | null = null;

async function mount(extra: Record<string, unknown> = {}): Promise<Mounted> {
  const root = document.createElement("div");
  document.body.append(root);
  const events: Record<string, unknown[][]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      (events[name] ??= []).push(args);
    };
  const app = createApp({
    render: () =>
      h(DataGrid, {
        label: "users",
        columns,
        rows,
        onEdit: record("edit"),
        onInspect: record("inspect"),
        onDelete: record("delete"),
        onSummary: record("summary"),
        "onUpdate:sort": record("sort"),
        ...extra,
      }),
  });
  app.mount(root);
  await nextTick();
  await nextTick();
  const grid = root.querySelector<HTMLElement>('[role="grid"]');
  if (!grid) throw new Error("grid did not render");
  mounted = { root, grid, events, app };
  return mounted;
}

function cell(grid: HTMLElement, row: number, col: number): HTMLElement {
  const element = grid.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
  if (!element) throw new Error(`cell ${row},${col} not rendered`);
  return element;
}

function press(grid: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  grid.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
}

afterEach(() => {
  mounted?.app.unmount();
  mounted?.root.remove();
  mounted = null;
});

describe("DataGrid", () => {
  test("draws its own box by default, and leaves depth to the well with frame none", async () => {
    const boxed = await mount();
    expect(boxed.grid.classList.contains("cladd-surface-level-1")).toBe(true);
    expect(boxed.grid.classList.contains("border")).toBe(true);
    boxed.app.unmount();
    boxed.root.remove();
    const inWell = await mount({ frame: "none" });
    expect(inWell.grid.classList.contains("cladd-surface-level-1")).toBe(false);
    expect(inWell.grid.classList.contains("border")).toBe(false);
    expect(inWell.grid.style.getPropertyValue("--color-cladd-bg")).toBe(
      "var(--color-cladd-surface-cut)",
    );
  });

  test("renders a labelled, virtualised grid with stable row ids and NULL cells", async () => {
    const { grid } = await mount();
    expect(grid.getAttribute("aria-label")).toBe("users");
    expect(grid.getAttribute("aria-rowcount")).toBe("31");
    expect(cell(grid, 2, 1).textContent?.trim()).toBe("NULL");
    expect(grid.querySelectorAll('[role="row"]').length).toBeGreaterThan(1);
  });

  test("one click selects; it never opens anything", async () => {
    const { grid, events } = await mount();
    cell(grid, 1, 1).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    await nextTick();
    expect(grid.getAttribute("aria-activedescendant")).toMatch(/-r1-c1$/);
    expect(events.edit).toBeUndefined();
    expect(events.inspect).toBeUndefined();
  });

  test("Enter edits, Space inspects, Delete targets the selected rows by id", async () => {
    const { grid, events } = await mount();
    cell(grid, 4, 2).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    press(grid, "ArrowDown", { shiftKey: true });
    await nextTick();
    press(grid, "Enter");
    press(grid, " ");
    press(grid, "Delete");
    expect(events.edit?.[0]).toEqual(["pk:6", "score"]);
    expect(events.inspect?.[0]).toEqual(["pk:6"]);
    expect(events.delete?.[0]).toEqual([["pk:5", "pk:6"]]);
  });

  test("a read-only grid never asks to edit or delete", async () => {
    const { grid, events } = await mount({ readOnly: true });
    cell(grid, 0, 1).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    press(grid, "Enter");
    press(grid, "Delete");
    cell(grid, 0, 1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(events.edit).toBeUndefined();
    expect(events.delete).toBeUndefined();
  });

  test("a range reports selection aggregates", async () => {
    const { grid, events } = await mount();
    cell(grid, 0, 2).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    press(grid, "ArrowDown", { shiftKey: true });
    press(grid, "ArrowDown", { shiftKey: true });
    await nextTick();
    const summaries = events.summary ?? [];
    const last = summaries[summaries.length - 1]?.[0] as GridSummary;
    expect(last.selectedRows).toBe(3);
    expect(last.aggregate?.numeric).toMatchObject({ sum: 60, min: 10, max: 30 });
  });

  test("header clicks cycle the server-side sort", async () => {
    const { grid, events } = await mount({
      sort: { columnId: "name", direction: "asc" } as GridSort,
    });
    const headers = grid.querySelectorAll<HTMLButtonElement>(
      '[role="columnheader"] > button:first-child',
    );
    headers[1]?.click();
    headers[0]?.click();
    expect(events.sort).toEqual([
      [{ columnId: "name", direction: "desc" }],
      [{ columnId: "id", direction: "asc" }],
    ]);
  });
});

describe("DataGrid row activation", () => {
  test("Enter opens the row instead of editing when rows activate", async () => {
    const { grid, events } = await mount({
      readOnly: true,
      activateRows: true,
      onActivate: (id: string) => (events.activate ??= []).push([id]),
    });
    cell(grid, 1, 1).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    press(grid, "Enter");
    expect(events.activate).toEqual([["pk:2"]]);
    expect(events.edit).toBeUndefined();
  });
});

describe("DataGrid sections", () => {
  const sectioned: GridRow[] = [
    {
      id: "s:a",
      cells: {},
      section: { key: "a", label: "name", value: "a", count: 2, open: true },
    },
    rows[0] as GridRow,
    rows[1] as GridRow,
    { id: "n:a", cells: {}, note: { text: "8 more rows", action: "Show 100 more" } },
    {
      id: "s:b",
      cells: {},
      section: { key: "b", label: "name", value: null, count: 4, open: false },
    },
  ];

  async function mountSections() {
    const handlers: Record<string, unknown[][]> = {};
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        (handlers[name] ??= []).push(args);
      };
    const view = await mount({
      rows: sectioned,
      readOnly: true,
      onToggleSection: record("toggle"),
      onNoteAction: record("note"),
      onActiveRow: record("active"),
    });
    return { ...view, handlers };
  }

  function header(grid: HTMLElement, index: number): HTMLElement {
    const element = grid.querySelector<HTMLElement>(`[data-section-row="${index}"]`);
    if (!element) throw new Error(`header ${index} not rendered`);
    return element;
  }

  test("a header spans the row, names its value honestly and counts its rows", async () => {
    const { grid } = await mountSections();
    expect(header(grid, 0).getAttribute("aria-expanded")).toBe("true");
    expect(header(grid, 4).getAttribute("aria-expanded")).toBe("false");
    expect(header(grid, 4).textContent).toContain("NULL");
    expect(header(grid, 4).textContent).toContain("4 rows");
    expect(header(grid, 4).querySelector("[data-col]")).toBeNull();
  });

  test("click, Enter, Space and the arrows open and close a header", async () => {
    const { grid, handlers } = await mountSections();
    header(grid, 4).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    header(grid, 4).dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, detail: 1 }));
    await nextTick();
    press(grid, "Enter");
    press(grid, " ");
    press(grid, "ArrowRight");
    press(grid, "ArrowLeft");
    expect(handlers.toggle).toEqual([
      ["s:b", true],
      ["s:b", true],
      ["s:b", true],
      ["s:b", true],
    ]);
    header(grid, 0).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    await nextTick();
    press(grid, "ArrowLeft");
    press(grid, "ArrowRight");
    await nextTick();
    expect(handlers.toggle?.slice(4)).toEqual([["s:a", false]]);
    expect(grid.getAttribute("aria-activedescendant")).toMatch(/-r1-c0$/);
  });

  test("arrows pass through headers; only data rows become the active row", async () => {
    const { grid, handlers } = await mountSections();
    cell(grid, 1, 1).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    await nextTick();
    press(grid, "ArrowUp");
    await nextTick();
    expect(grid.getAttribute("aria-activedescendant")).toMatch(/-r0-c1$/);
    expect(handlers.active?.map(([id]) => id)).toEqual(["pk:1", null]);
  });

  test("Enter on a note runs its action", async () => {
    const { grid, handlers } = await mountSections();
    cell(grid, 2, 0).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    press(grid, "ArrowDown");
    await nextTick();
    press(grid, "Enter");
    expect(handlers.note).toEqual([["n:a"]]);
  });

  test("copy, select all and the row targets skip headers and notes", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { grid, events } = await mountSections();
    header(grid, 0).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    for (let i = 0; i < 4; i++) press(grid, "ArrowDown", { shiftKey: true });
    await nextTick();
    press(grid, "c", { ctrlKey: true });
    await nextTick();
    expect(writeText).toHaveBeenCalledWith("1\n2");
    press(grid, "a", { ctrlKey: true });
    await nextTick();
    const summaries = events.summary ?? [];
    const last = summaries[summaries.length - 1]?.[0] as GridSummary;
    expect(last.rowCount).toBe(2);
    expect(last.selectedRowIds).toEqual(["pk:1", "pk:2"]);
  });
});
