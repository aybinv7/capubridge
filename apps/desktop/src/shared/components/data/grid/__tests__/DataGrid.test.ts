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
    const headers = grid.querySelectorAll<HTMLButtonElement>('[role="columnheader"] button');
    headers[1]?.click();
    headers[0]?.click();
    expect(events.sort).toEqual([
      [{ columnId: "name", direction: "desc" }],
      [{ columnId: "id", direction: "asc" }],
    ]);
  });
});
