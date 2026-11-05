import { describe, expect, test } from "vite-plus/test";
import {
  matchesAll,
  matchesPredicate,
  operatorsFor,
  valueKindFor,
  type DataPredicate,
} from "../predicates";

function where(operator: DataPredicate["operator"], value = ""): DataPredicate {
  return { id: "1", columnId: "c", operator, value };
}

describe("matchesPredicate", () => {
  test("number equality and ordering compare numbers, not text", () => {
    expect(matchesPredicate(10, where("equals", "10"))).toBe(true);
    expect(matchesPredicate(9, where("gt", "10"))).toBe(false);
    expect(matchesPredicate(100, where("gt", "20"))).toBe(true);
  });

  test("text equality is typed text, case-insensitive", () => {
    expect(matchesPredicate("Alger", where("equals", "alger"))).toBe(true);
    expect(matchesPredicate("Alger", where("contains", "LG"))).toBe(true);
  });

  test("date strings compare as dates", () => {
    expect(matchesPredicate("2024-05-02T10:00:00Z", where("gt", "2024-05-01"))).toBe(true);
    expect(matchesPredicate("2024-04-30", where("gt", "2024-05-01"))).toBe(false);
  });

  test("date markers from IndexedDB compare as dates", () => {
    const marker = { __type: "Date", value: "2024-05-02T10:00:00.000Z" };
    expect(matchesPredicate(marker, where("gte", "2024-05-01"))).toBe(true);
    expect(matchesPredicate(marker, where("lt", "2024-05-01"))).toBe(false);
  });

  test("epoch numbers compare as dates only in a date column", () => {
    const ms = Date.parse("2024-05-02T10:00:00Z");
    expect(matchesPredicate(ms, where("gt", "2024-05-01"), "date")).toBe(true);
  });

  test("null and blank checks", () => {
    expect(matchesPredicate(null, where("isNull"))).toBe(true);
    expect(matchesPredicate({ __type: "Undefined" }, where("isNull"))).toBe(true);
    expect(matchesPredicate([], where("isEmpty"))).toBe(true);
    expect(matchesPredicate({ a: 1 }, where("isNotEmpty"))).toBe(true);
  });
});

describe("matchesAll", () => {
  const cells = { name: "Ada", age: 36 };
  const types = { name: "text", age: "integer" } as const;
  const name: DataPredicate = { id: "a", columnId: "name", operator: "equals", value: "ada" };
  const age: DataPredicate = { id: "b", columnId: "age", operator: "gt", value: "40" };

  test("AND needs every condition, OR any", () => {
    expect(matchesAll(cells, [name, age], "and", types)).toBe(false);
    expect(matchesAll(cells, [name, age], "or", types)).toBe(true);
  });

  test("incomplete conditions are ignored", () => {
    expect(matchesAll(cells, [{ ...age, value: "" }], "and", types)).toBe(true);
  });
});

describe("value editors", () => {
  test("a number column asks for a number, a date column for a date", () => {
    expect(valueKindFor("integer", "equals")).toBe("number");
    expect(valueKindFor("date", "lt")).toBe("date");
    expect(valueKindFor("text", "equals")).toBe("text");
    expect(valueKindFor("text", "isNull")).toBe("none");
  });

  test("boolean columns offer true and false", () => {
    expect(operatorsFor("boolean")).toContain("isTrue");
    expect(operatorsFor("text")).not.toContain("isTrue");
  });
});
