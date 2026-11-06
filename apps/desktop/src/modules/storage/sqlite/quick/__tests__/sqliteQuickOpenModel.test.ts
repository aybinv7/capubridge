import { describe, expect, test } from "vite-plus/test";
import type { SqliteTableInfo } from "@/types/sqlite.types";
import { parseTableKey, quickOpenGroups } from "../sqliteQuickOpenModel";
import { keyValueOf, parseRowTarget } from "../sqliteKeyInput";

const table = (name: string, tableType = "table"): SqliteTableInfo => ({
  name,
  tableType,
  rowCount: 1,
  sql: "",
});
const tables = [
  table("res_partner"),
  table("product_product"),
  table("stock_move"),
  table("v_sales", "view"),
];

describe("quick open", () => {
  test("with nothing typed: recent tables, then pinned, then the other databases", () => {
    const groups = quickOpenGroups({
      query: "",
      tables,
      columns: null,
      recents: ["stock_move", "gone_table", "res_partner"],
      pinned: ["res_partner", "product_product"],
      databases: [{ sourceId: "/data/geo.db", name: "geo.db", detail: "1 MB" }],
    });
    expect(groups.map((group) => group.label)).toEqual(["Recent", "Pinned", "Other databases"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["t:stock_move", "t:res_partner"]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual(["t:product_product"]);
  });

  test("typing ranks tables, then columns by name, then databases", () => {
    const groups = quickOpenGroups({
      query: "barcode",
      tables,
      columns: [
        { table: "product_product", column: "barcode" },
        { table: "stock_move", column: "state" },
      ],
      recents: [],
      pinned: [],
      databases: [],
    });
    expect(groups.map((group) => group.label)).toEqual(["Columns"]);
    expect(groups[0]?.items[0]).toMatchObject({ table: "product_product", column: "barcode" });
  });

  test("table:key offers the row first", () => {
    expect(parseTableKey("Res_Partner:4182", tables)).toEqual({
      table: "res_partner",
      key: "4182",
    });
    expect(parseTableKey("res_partner:", tables)).toBeNull();
    const groups = quickOpenGroups({
      query: "res_partner:4182",
      tables,
      columns: null,
      recents: [],
      pinned: [],
      databases: [],
    });
    expect(groups[0]).toMatchObject({
      label: "Go to row",
      items: [{ table: "res_partner", key: "4182" }],
    });
  });
});

describe("typed keys", () => {
  test("digits are numbers, wide ones stay exact, quotes keep text, NULL is NULL", () => {
    expect(keyValueOf("4182")).toBe(4182);
    expect(keyValueOf("9007199254740993")).toEqual({
      __type: "Number",
      value: "9007199254740993",
    });
    expect(keyValueOf("'0042'")).toBe("0042");
    expect(keyValueOf("abc")).toBe("abc");
    expect(keyValueOf("null")).toBeNull();
  });

  test("a row number, a key, a composite key", () => {
    expect(parseRowTarget("#40", 1)).toEqual({ kind: "number", row: 40 });
    expect(parseRowTarget("#0", 1)).toBeNull();
    expect(parseRowTarget("12, 3", 2)).toEqual({ kind: "key", values: [12, 3] });
    expect(parseRowTarget("12", 2)).toBeNull();
    expect(parseRowTarget("12", 0)).toBeNull();
  });
});
