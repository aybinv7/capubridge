import { describe, expect, test } from "vite-plus/test";
import type { PaletteItem, PaletteSectionView } from "../items";
import { flattenRows, itemKeys, rowHeight, scrollTargetIndex, stepKey } from "../rows";

function notice(key: string): PaletteItem {
  return { kind: "notice", key, section: "actions", title: key, subtitle: null, action: null };
}

const sections: PaletteSectionView[] = [
  { id: "go-to", label: "Go to", items: [notice("a"), notice("b")] },
  { id: "actions", label: "Actions", items: [notice("c")] },
  { id: "apps", label: "Apps", items: [] },
];

describe("flattenRows", () => {
  test("puts a header before each non-empty section", () => {
    const rows = flattenRows(sections);
    expect(rows.map((row) => row.key)).toEqual(["header:go-to", "a", "b", "header:actions", "c"]);
  });

  test("marks the first item of a section and sizes rows by kind", () => {
    const rows = flattenRows(sections);
    expect(rows.map((row) => row.type === "item" && row.first)).toEqual([
      false,
      true,
      false,
      false,
      true,
    ]);
    const heights = rows.map(rowHeight);
    expect(heights[0]).toBeLessThan(heights[1] ?? 0);
  });
});

describe("keyboard movement", () => {
  const keys = itemKeys(flattenRows(sections));

  test("lists only items", () => {
    expect(keys).toEqual(["a", "b", "c"]);
  });

  test("steps and wraps at both ends", () => {
    expect(stepKey(keys, "a", 1)).toBe("b");
    expect(stepKey(keys, "c", 1)).toBe("a");
    expect(stepKey(keys, "a", -1)).toBe("c");
    expect(stepKey(keys, "a", 8)).toBe("c");
  });

  test("with nothing highlighted, forward is first and backward is last", () => {
    expect(stepKey(keys, null, 1)).toBe("a");
    expect(stepKey(keys, null, -1)).toBe("c");
    expect(stepKey([], null, 1)).toBeNull();
  });
});

describe("scrollTargetIndex", () => {
  const rows = flattenRows(sections);

  test("a section's first item scrolls to its header", () => {
    expect(scrollTargetIndex(rows, "a")).toBe(0);
    expect(scrollTargetIndex(rows, "c")).toBe(3);
  });

  test("other items scroll to themselves", () => {
    expect(scrollTargetIndex(rows, "b")).toBe(2);
    expect(scrollTargetIndex(rows, null)).toBe(-1);
    expect(scrollTargetIndex(rows, "missing")).toBe(-1);
  });
});
