import { describe, expect, test } from "vite-plus/test";
import { chipLabel, combineWhere, makeChip } from "../sqliteFilters";

describe("filter chips", () => {
  test("a chip says its condition in short words", () => {
    expect(chipLabel("state", "=", "draft")).toBe("state = “draft”");
    expect(chipLabel("qty", ">=", 3)).toBe("qty ≥ 3");
    expect(chipLabel("note", "null")).toBe("note is NULL");
    expect(chipLabel("note", "=", null)).toBe("note is NULL");
    expect(chipLabel("note", "!=", null)).toBe("note is not NULL");
    expect(chipLabel("name", "starts", "kg")).toBe("name starts with “kg”");
    expect(chipLabel("id", "=", { __type: "Number", value: "9007199254740993" })).toBe(
      "id = 9007199254740993",
    );
  });

  test("a chip runs exact SQL: NULL, wide integers, escaped LIKE", () => {
    expect(makeChip("note", "=", null).sql).toBe(`"note" IS NULL`);
    expect(makeChip("id", "=", { __type: "Number", value: "9007199254740993" }).sql).toBe(
      `"id" = 9007199254740993`,
    );
    expect(makeChip("name", "contains", "50%").sql).toBe(`"name" LIKE '%50!%%' ESCAPE '!'`);
  });

  test("conditions join with AND, each in its own parentheses", () => {
    expect(combineWhere([], "", ["a"], "")).toBe("");
    expect(combineWhere([], "x = 1;", ["a"], "")).toBe("x = 1");
    expect(combineWhere([{ sql: `"a" = 1` }], "b = 2 OR c = 3", [], "")).toBe(
      `("a" = 1) AND (b = 2 OR c = 3)`,
    );
    expect(combineWhere([], "", ["a"], "kg")).toBe(`(CAST("a" AS TEXT) LIKE '%kg%' ESCAPE '!')`);
  });
});
