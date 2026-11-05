import { describe, expect, test } from "vite-plus/test";
import { buildIdbGrid, KEY_COLUMN, VALUE_COLUMN } from "../idbGridModel";
import { pipeRows } from "../idbRowPipeline";

describe("buildIdbGrid", () => {
  test("columns are the union of every record's fields, not the first record's", () => {
    const grid = buildIdbGrid(
      [
        { key: 1, value: { id: 1, name: "a" } },
        { key: 2, value: { id: 2, name: "b", city: "Oran" } },
      ],
      "id",
      new Set(),
    );
    expect(grid.columns.map((column) => column.id)).toEqual(["id", "name", "city"]);
    expect(grid.columns[0]).toMatchObject({ primaryKey: true, readOnly: true });
  });

  test("an out-of-line store gets its own key column", () => {
    const grid = buildIdbGrid([{ key: "k", value: "text" }], null, new Set());
    expect(grid.columns.map((column) => column.id)).toEqual([KEY_COLUMN, VALUE_COLUMN]);
  });

  test("row ids come from the key, including date keys, never the row position", () => {
    const dateKey = { __type: "Date", value: "2024-01-01T00:00:00.000Z" } as unknown as IDBValidKey;
    const grid = buildIdbGrid(
      [
        { key: dateKey, value: { a: 1 } },
        { key: 5, value: { a: 2 } },
      ],
      null,
      new Set(),
    );
    expect(grid.rows.map((row) => row.id)).not.toContain("[object Object]-0");
    expect(grid.rows[0]?.id).toContain("2024-01-01");
    expect(grid.rows[1]?.id).toBe("5");
  });

  test("a Date marker field is typed as a date, other markers as binary", () => {
    const grid = buildIdbGrid(
      [{ key: 1, value: { at: { __type: "Date", value: "2024-01-01" }, tags: { __type: "Map" } } }],
      null,
      new Set(),
    );
    expect(grid.columns.find((column) => column.id === "at")?.type).toBe("date");
    expect(grid.columns.find((column) => column.id === "tags")?.type).toBe("blob");
  });

  test("device changes become row states", () => {
    const grid = buildIdbGrid(
      [{ key: 1, value: { a: 1 }, __changeOperation: "update" }],
      null,
      new Set(),
    );
    expect(grid.states.get("1")).toBe("updated");
  });
});

describe("pipeRows", () => {
  const grid = buildIdbGrid(
    [
      { key: 1, value: { name: "Ada", meta: { city: "Oran" }, n: 10 } },
      { key: 2, value: { name: "Bob", meta: { city: "Alger" }, n: 9 } },
    ],
    null,
    new Set(),
  );
  const base = {
    rows: grid.rows,
    columns: grid.columns,
    search: "",
    predicates: [],
    join: "and" as const,
    sort: null,
    changesOnly: false,
    states: grid.states,
  };

  test("search looks inside object columns too", () => {
    expect(pipeRows({ ...base, search: "alger" }).map((row) => row.id)).toEqual(["2"]);
  });

  test("numbers sort by value", () => {
    const sorted = pipeRows({ ...base, sort: { columnId: "n", direction: "asc" } });
    expect(sorted.map((row) => row.id)).toEqual(["2", "1"]);
  });
});

describe("groupRows", () => {
  test("one row per value with its count, most common first", async () => {
    const { groupRows } = await import("../idbRowPipeline");
    const grid = buildIdbGrid(
      [
        { key: 1, value: { city: "Oran" } },
        { key: 2, value: { city: "Alger" } },
        { key: 3, value: { city: "Alger" } },
      ],
      null,
      new Set(),
    );
    expect(groupRows(grid.rows, "city").map((row) => row.cells)).toEqual([
      { city: "Alger", __count: 2 },
      { city: "Oran", __count: 1 },
    ]);
  });
});
