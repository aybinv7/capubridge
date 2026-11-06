import { describe, expect, test } from "vite-plus/test";
import { gridIntent, type GridIntent } from "../gridKeys";
import { gutterNumbers, isStructural, sectionIntent, sectionValueText } from "../gridSections";
import type { GridRow } from "../types";

const header = (key: string, open: boolean): GridRow => ({
  id: `section:${key}`,
  cells: {},
  section: { key, label: "role", value: key, count: 2, open },
});
const data = (id: string): GridRow => ({ id, cells: { id } });
function key(name: string, init: Partial<KeyboardEvent> = {}): GridIntent {
  const intent = gridIntent({
    key: name,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...init,
  });
  if (!intent) throw new Error(`${name} has no intent`);
  return intent;
}

describe("grid sections", () => {
  test("headers and notes are structural; data rows are not", () => {
    expect(isStructural(header("a", true))).toBe(true);
    expect(isStructural({ id: "n", cells: {}, note: { text: "Reading rows…" } })).toBe(true);
    expect(isStructural(data("1"))).toBe(false);
  });

  test("Enter and Space open and close a header; Right opens, Left closes", () => {
    const closed = header("a", false);
    const open = header("a", true);
    for (const name of ["Enter", " "]) {
      expect(sectionIntent(closed, key(name))).toEqual({ kind: "toggle", open: true });
      expect(sectionIntent(open, key(name))).toEqual({ kind: "toggle", open: false });
    }
    expect(sectionIntent(closed, key("ArrowRight"))).toEqual({ kind: "toggle", open: true });
    expect(sectionIntent(open, key("ArrowRight"))).toEqual({ kind: "down" });
    expect(sectionIntent(open, key("ArrowLeft"))).toEqual({ kind: "toggle", open: false });
    expect(sectionIntent(closed, key("ArrowLeft"))).toEqual({ kind: "stay" });
    expect(sectionIntent(open, key("ArrowDown"))).toBeNull();
    expect(sectionIntent(open, key("ArrowRight", { shiftKey: true }))).toBeNull();
  });

  test("a note runs its action unless it waits on a read; data rows keep their keys", () => {
    const more: GridRow = {
      id: "m",
      cells: {},
      note: { text: "50 more", action: "Show 100 more" },
    };
    const busy: GridRow = { ...more, note: { text: "Reading…", action: "Show", busy: true } };
    expect(sectionIntent(more, key("Enter"))).toEqual({ kind: "action" });
    expect(sectionIntent(busy, key("Enter"))).toEqual({ kind: "stay" });
    expect(sectionIntent(data("1"), key("Enter"))).toBeNull();
  });

  test("gutter numbers restart in each section and skip structural rows", () => {
    const rows = [
      header("a", true),
      data("1"),
      data("2"),
      header("b", false),
      header("c", true),
      data("3"),
    ];
    expect(gutterNumbers(rows, 0)).toEqual([0, 1, 2, 0, 0, 1]);
    expect(gutterNumbers([data("1"), data("2")], 50)).toEqual([51, 52]);
  });

  test("NULL and empty text are named, blank text is quoted", () => {
    expect(sectionValueText(null, "NULL")).toEqual({ text: "NULL", kind: "null" });
    expect(sectionValueText("", "")).toEqual({ text: "empty", kind: "empty" });
    expect(sectionValueText("  ", "  ")).toEqual({ text: "“  ”", kind: "empty" });
    expect(sectionValueText(0, "0")).toEqual({ text: "0", kind: "value" });
  });
});
