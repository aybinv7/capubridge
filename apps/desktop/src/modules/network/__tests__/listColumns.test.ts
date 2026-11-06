import { describe, expect, test } from "vite-plus/test";
import {
  fitColumns,
  gridTemplate,
  isColumnLayout,
  resizeEdge,
  resizeLimit,
  type ColumnLayoutState,
  type ListColumn,
} from "../columns/listColumns";

type Id = "method" | "name" | "host" | "size" | "time" | "extra";

const COLUMNS: ListColumn<Id>[] = [
  { id: "method", label: "Method", width: 60, minWidth: 48, align: "start" },
  { id: "name", label: "Name", width: 0, minWidth: 120, flex: true, align: "start" },
  { id: "host", label: "Host", width: 140, minWidth: 60, align: "start", dropOrder: 1 },
  { id: "size", label: "Size", width: 80, minWidth: 56, align: "end", dropOrder: 2 },
  { id: "time", label: "Time", width: 70, minWidth: 56, align: "end" },
  {
    id: "extra",
    label: "Extra",
    width: 100,
    minWidth: 60,
    align: "start",
    dropOrder: 0,
    defaultHidden: true,
  },
];

const EMPTY: ColumnLayoutState = { widths: {}, hidden: {} };
const ids = (columns: readonly ListColumn[]) => columns.map((column) => column.id);

describe("list columns", () => {
  test("a wide list shows every column people asked for, in order", () => {
    const fitted = fitColumns(COLUMNS, EMPTY, 2000);
    expect(ids(fitted.shown)).toEqual(["method", "name", "host", "size", "time"]);
    expect(fitted.dropped.size).toBe(0);
  });

  test("a narrow list drops columns by their order, never the flex one or a fixed one", () => {
    const narrow = fitColumns(COLUMNS, EMPTY, 60 + 120 + 80 + 70);
    expect(ids(narrow.shown)).toEqual(["method", "name", "size", "time"]);
    expect([...narrow.dropped]).toEqual(["host"]);
    const tiny = fitColumns(COLUMNS, EMPTY, 100);
    expect(ids(tiny.shown)).toEqual(["method", "name", "time"]);
  });

  test("an unmeasured list drops nothing", () => {
    expect(fitColumns(COLUMNS, EMPTY, 0).dropped.size).toBe(0);
  });

  test("a hidden column is left out, a shown default-hidden one comes back", () => {
    const state = { widths: {}, hidden: { host: true, extra: false } };
    expect(ids(fitColumns(COLUMNS, state, 2000).shown)).toEqual([
      "method",
      "name",
      "size",
      "time",
      "extra",
    ]);
    expect(ids(fitColumns(COLUMNS, EMPTY, 2000, new Set<Id>(["size"])).shown)).not.toContain(
      "size",
    );
  });

  test("the template gives the flex column the rest and keeps dragged widths in bounds", () => {
    const state = { widths: { method: 10, host: 200 }, hidden: {} };
    const shown = fitColumns(COLUMNS, state, 2000).shown;
    expect(gridTemplate(shown, state)).toBe("48px minmax(120px, 1fr) 200px 80px 70px");
  });

  test("columns resize from the edge that follows the pointer", () => {
    const shown = fitColumns(COLUMNS, EMPTY, 2000).shown;
    expect(resizeEdge(shown, "method")).toBe("end");
    expect(resizeEdge(shown, "name")).toBeNull();
    expect(resizeEdge(shown, "host")).toBe("start");
    expect(resizeEdge(shown, "time")).toBe("start");
  });

  test("a column grows only as far as the flex column can shrink", () => {
    const shown = fitColumns(COLUMNS, EMPTY, 2000).shown;
    const need = 60 + 120 + 140 + 80 + 70;
    expect(resizeLimit(shown, EMPTY, "host", need + 50)).toBe(190);
    expect(resizeLimit(shown, EMPTY, "host", need - 10)).toBe(140);
  });

  test("a stored layout is checked before it is used", () => {
    expect(isColumnLayout({ widths: {}, hidden: {} })).toBe(true);
    expect(isColumnLayout({ widths: {} })).toBe(false);
    expect(isColumnLayout(null)).toBe(false);
  });
});
