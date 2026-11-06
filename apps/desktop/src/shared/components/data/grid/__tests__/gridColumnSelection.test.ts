import { describe, expect, test } from "vite-plus/test";
import { ref } from "vue";
import { selectedRange } from "../selection";
import type { GridColumn, GridRow } from "../types";
import { useGridSelection } from "../useGridSelection";

function setup() {
  const rows = ref<GridRow[]>(
    Array.from({ length: 5 }, (_, index): GridRow => ({ id: `r${index}`, cells: {} })),
  );
  const columns = ref<GridColumn[]>(
    ["a", "b", "c", "d"].map((id) => ({ id, title: id }) as GridColumn),
  );
  const reveals: number[] = [];
  const grid = useGridSelection({ rows, columns, onReveal: (row) => reveals.push(row) });
  return { grid, reveals };
}

describe("selecting whole columns", () => {
  test("Ctrl+click picks one column over every row, without jumping to the end", () => {
    const { grid, reveals } = setup();
    grid.selectColumns(2, false);
    expect(selectedRange(grid.selection.value)).toEqual({ top: 0, bottom: 4, left: 2, right: 2 });
    expect(reveals).toEqual([]);
  });

  test("Shift+click extends the pick from the first column to this one", () => {
    const { grid } = setup();
    grid.selectColumns(1, false);
    grid.selectColumns(3, true);
    expect(selectedRange(grid.selection.value)).toEqual({ top: 0, bottom: 4, left: 1, right: 3 });
  });

  test("a cell range across columns comes from extending the focus", () => {
    const { grid } = setup();
    grid.focusAt(1, 0);
    grid.focusAt(3, 2, true);
    expect(selectedRange(grid.selection.value)).toEqual({ top: 1, bottom: 3, left: 0, right: 2 });
  });
});
