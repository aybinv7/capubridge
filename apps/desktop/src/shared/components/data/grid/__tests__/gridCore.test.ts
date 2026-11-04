import { describe, expect, test } from "vite-plus/test";
import { cellToText, formatCell } from "../valueFormat";
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, measureColumnWidths } from "../columnSizing";
import {
  EMPTY_SELECTION,
  focusCell,
  isCellInRange,
  moveFocus,
  reconcileSelection,
  selectRows,
  selectedRange,
  targetRowIds,
} from "../selection";
import { aggregateValues, formatAggregate } from "../aggregates";
import { toTsv } from "../clipboard";
import { gridIntent } from "../gridKeys";
import { toCsv, toSqlInserts } from "../exportFormats";
import type { GridColumn, GridRow } from "../types";

describe("formatCell", () => {
  test("distinguishes NULL from empty text", () => {
    expect(formatCell(null)).toMatchObject({ kind: "null", text: "NULL" });
    expect(formatCell("")).toMatchObject({ kind: "string", text: "" });
  });

  test("right-aligns numbers and reads 0/1 as booleans in boolean columns", () => {
    expect(formatCell(42)).toMatchObject({ kind: "number", align: "end" });
    expect(formatCell(1, "boolean")).toMatchObject({ kind: "boolean", text: "true" });
    expect(formatCell(1, "integer")).toMatchObject({ kind: "number", text: "1" });
  });

  test("summarises structures, blobs and multi-line text", () => {
    expect(formatCell({ a: 1, b: 2 })).toMatchObject({ kind: "json", badge: "{2}" });
    expect(formatCell([1, 2, 3])).toMatchObject({ kind: "json", badge: "[3]" });
    expect(formatCell(new Uint8Array(2048))).toMatchObject({ kind: "blob", text: "blob 2.0 KB" });
    expect(formatCell({ __type: "Blob", size: 10 })).toMatchObject({
      kind: "blob",
      text: "Blob 10 B",
    });
    expect(formatCell("a\nb\nc")).toMatchObject({ text: "a ⏎ b ⏎ c", badge: "⏎2" });
  });

  test("clips long previews but keeps full text for the clipboard", () => {
    const long = "x".repeat(1000);
    expect(formatCell(long).text.length).toBeLessThan(260);
    expect(cellToText(long)).toBe(long);
    expect(cellToText(null)).toBe("");
    expect(cellToText({ a: 1 })).toBe('{"a":1}');
  });
});

describe("measureColumnWidths", () => {
  const columns: GridColumn[] = [
    { id: "id", title: "id", type: "integer" },
    { id: "body", title: "body", type: "text" },
    { id: "fixed", title: "fixed", width: 120 },
  ];
  const rows: GridRow[] = [
    { id: "1", cells: { id: 1, body: "x".repeat(500) } },
    { id: "2", cells: { id: 22, body: "short" } },
  ];

  test("sizes to content within bounds and honours explicit widths", () => {
    const widths = measureColumnWidths(columns, rows);
    expect(widths.id).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
    expect(widths.id).toBeLessThan(100);
    expect(widths.fixed).toBe(120);
  });

  test("one long outlier does not widen the column; mostly long values do", () => {
    const outlier: GridRow[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      cells: { body: i === 0 ? "x".repeat(500) : "short" },
    }));
    const long: GridRow[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      cells: { body: "x".repeat(500) },
    }));
    expect(measureColumnWidths(columns, outlier).body).toBeLessThan(120);
    expect(measureColumnWidths(columns, long).body).toBe(MAX_COLUMN_WIDTH);
  });

  test("never narrower than its header", () => {
    const widths = measureColumnWidths(
      [{ id: "c", title: "a_very_long_column_name" }],
      [],
      (t) => t.length * 7,
    );
    expect(widths.c).toBeGreaterThanOrEqual("a_very_long_column_name".length * 7);
  });
});

describe("selection", () => {
  const bounds = { rows: 10, cols: 4 };
  const ids = Array.from({ length: 10 }, (_, i) => `r${i}`);

  test("clamps focus and moves by keys and pages", () => {
    let s = focusCell(EMPTY_SELECTION, { row: 99, col: -1 }, bounds);
    expect(s.focus).toEqual({ row: 9, col: 0 });
    s = moveFocus(s, "first", bounds, 5);
    expect(s.focus).toEqual({ row: 0, col: 0 });
    s = moveFocus(s, "pageDown", bounds, 5);
    expect(s.focus).toEqual({ row: 4, col: 0 });
    s = moveFocus(s, "end", bounds, 5);
    expect(s.focus).toEqual({ row: 4, col: 3 });
  });

  test("Shift extends a rectangular range from the anchor", () => {
    let s = focusCell(EMPTY_SELECTION, { row: 2, col: 1 }, bounds);
    s = moveFocus(s, "down", bounds, 5, true);
    s = moveFocus(s, "right", bounds, 5, true);
    expect(selectedRange(s)).toEqual({ top: 2, bottom: 3, left: 1, right: 2 });
    expect(isCellInRange(selectedRange(s), 3, 2)).toBe(true);
    expect(isCellInRange(selectedRange(s), 4, 2)).toBe(false);
    expect(targetRowIds(s, ids)).toEqual(["r2", "r3"]);
  });

  test("gutter selection replaces, toggles and extends by row id", () => {
    let s = selectRows(EMPTY_SELECTION, ids, 2, "replace");
    s = selectRows(s, ids, 5, "extend");
    expect([...s.rows]).toEqual(["r2", "r3", "r4", "r5"]);
    s = selectRows(s, ids, 3, "toggle");
    expect(targetRowIds(s, ids)).toEqual(["r2", "r4", "r5"]);
  });

  test("reconcile drops vanished rows and clamps the cursor", () => {
    let s = selectRows(EMPTY_SELECTION, ids, 9, "replace");
    s = reconcileSelection(s, ids.slice(0, 3), { rows: 3, cols: 4 });
    expect(s.rows.size).toBe(0);
    expect(s.focus).toEqual({ row: 2, col: 0 });
  });

  test("an empty grid has no selection", () => {
    expect(focusCell(EMPTY_SELECTION, { row: 0, col: 0 }, { rows: 0, cols: 3 }).focus).toBeNull();
  });
});

describe("aggregates", () => {
  test("sums numeric cells and counts nulls", () => {
    expect(aggregateValues([1, 2, "3", null, "x", ""])).toEqual({
      count: 6,
      nulls: 2,
      numeric: { count: 3, sum: 6, avg: 2, min: 1, max: 3 },
    });
    expect(aggregateValues(["a", "b"]).numeric).toBeUndefined();
  });

  test("formats compactly", () => {
    expect(formatAggregate(12345)).toBe("12,345");
    expect(formatAggregate(2 / 3)).toBe("0.6667");
  });
});

describe("toTsv", () => {
  test("quotes tabs, newlines and quotes so cells survive a paste", () => {
    expect(toTsv([[1, "a\tb", 'say "hi"', null, "x\ny"]], ["n", "t", "q", "z", "m"])).toBe(
      'n\tt\tq\tz\tm\n1\t"a\tb"\t"say ""hi"""\t\t"x\ny"',
    );
  });
});

describe("gridIntent", () => {
  const key = (
    k: string,
    mods: Partial<Record<"shiftKey" | "ctrlKey" | "metaKey" | "altKey", boolean>> = {},
  ) => ({
    key: k,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
  });

  test("spreadsheet navigation", () => {
    expect(gridIntent(key("ArrowDown"))).toEqual({ kind: "move", move: "down", extend: false });
    expect(gridIntent(key("ArrowDown", { shiftKey: true }))).toEqual({
      kind: "move",
      move: "down",
      extend: true,
    });
    expect(gridIntent(key("ArrowUp", { ctrlKey: true }))).toEqual({
      kind: "move",
      move: "first",
      extend: false,
    });
    expect(gridIntent(key("End", { ctrlKey: true }))).toEqual({
      kind: "move",
      move: "last",
      extend: false,
    });
    expect(gridIntent(key("Tab", { shiftKey: true }))).toEqual({
      kind: "move",
      move: "left",
      extend: false,
    });
  });

  test("actions follow the one-click-selects model", () => {
    expect(gridIntent(key("Enter"))).toEqual({ kind: "edit" });
    expect(gridIntent(key(" "))).toEqual({ kind: "inspect" });
    expect(gridIntent(key("Delete"))).toEqual({ kind: "delete" });
    expect(gridIntent(key("c", { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: "copy",
      withHeader: true,
    });
    expect(gridIntent(key("A", { metaKey: true }))).toEqual({ kind: "selectAll" });
  });

  test("ignores typing and Alt chords", () => {
    expect(gridIntent(key("a"))).toBeNull();
    expect(gridIntent(key("ArrowDown", { altKey: true }))).toBeNull();
  });
});

describe("export formats", () => {
  test("CSV quotes commas, quotes and newlines; NULL is empty", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x,y", null],
          ['say "hi"', "l1\nl2"],
        ],
      ),
    ).toBe('a,b\r\n"x,y",\r\n"say ""hi""","l1\nl2"');
  });

  test("INSERT statements quote identifiers and values", () => {
    expect(
      toSqlInserts(
        'we"ird',
        ["id", "name"],
        [
          [1, "it's"],
          [2, null],
        ],
      ),
    ).toBe(
      `INSERT INTO "we""ird" ("id", "name") VALUES (1, 'it''s');\nINSERT INTO "we""ird" ("id", "name") VALUES (2, NULL);`,
    );
  });
});
