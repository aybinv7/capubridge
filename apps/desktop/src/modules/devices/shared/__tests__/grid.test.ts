import { describe, expect, test } from "vite-plus/test";
import { chunkRows, columnsFor, scrollTopToReveal } from "../grid";

describe("grid helpers", () => {
  test("columns never drop below one", () => {
    expect(columnsFor(500, 100)).toBe(5);
    expect(columnsFor(50, 100)).toBe(1);
  });

  test("rows keep order", () => {
    expect(chunkRows(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });

  test("reveals a row above or below the viewport and leaves a visible one alone", () => {
    expect(scrollTopToReveal(2, 40, 200, 400)).toBe(80);
    expect(scrollTopToReveal(20, 40, 0, 400)).toBe(440);
    expect(scrollTopToReveal(5, 40, 100, 400)).toBe(100);
    expect(scrollTopToReveal(0, 40, 100, 400, 32)).toBe(0);
  });
});
