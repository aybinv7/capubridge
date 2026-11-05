import { describe, expect, test } from "vite-plus/test";
import { chunkRows } from "../../shared/grid";
import { gridColumns } from "../appsView";

describe("appsView", () => {
  test("columns follow the width and the density, at least one", () => {
    expect(gridColumns(960, "small")).toBe(10);
    expect(gridColumns(960, "medium")).toBe(8);
    expect(gridColumns(960, "large")).toBe(5);
    expect(gridColumns(40, "large")).toBe(1);
  });

  test("rows keep order and a short last row", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRows([], 3)).toEqual([]);
  });
});
