import { describe, expect, test } from "vite-plus/test";
import { sqliteReadOnlyReason } from "../browse/sqliteWriteAccess";
import { sqliteColumnType, toGridColumns, toGridRows } from "../browse/sqliteGrid";
import type { SqliteColumnInfo } from "@/types/sqlite.types";

function column(name: string, colType: string, pk = 0): SqliteColumnInfo {
  return { cid: 0, name, colType, notnull: false, defaultValue: null, pk } as SqliteColumnInfo;
}

describe("sqliteColumnType", () => {
  test("follows SQLite affinity and app conventions", () => {
    expect(sqliteColumnType("INTEGER")).toBe("integer");
    expect(sqliteColumnType("BIGINT")).toBe("integer");
    expect(sqliteColumnType("VARCHAR(40)")).toBe("text");
    expect(sqliteColumnType("DOUBLE PRECISION")).toBe("real");
    expect(sqliteColumnType("NUMERIC")).toBe("real");
    expect(sqliteColumnType("BLOB")).toBe("blob");
    expect(sqliteColumnType("BOOLEAN")).toBe("boolean");
    expect(sqliteColumnType("DATETIME")).toBe("date");
    expect(sqliteColumnType("")).toBe("unknown");
  });
});

describe("toGridColumns", () => {
  test("marks primary and foreign keys", () => {
    const columns = toGridColumns(
      ["id", "partner_id"],
      [column("id", "INTEGER", 1), column("partner_id", "INTEGER")],
      [
        {
          id: 0,
          seq: 0,
          fromColumn: "partner_id",
          toTable: "res_partner",
          toColumn: "id",
          onUpdate: null,
          onDelete: null,
          matchClause: null,
        },
      ],
    );
    expect(columns[0]).toMatchObject({ primaryKey: true, type: "integer" });
    expect(columns[1]).toMatchObject({ primaryKey: false, foreignKey: "res_partner.id" });
  });
});

describe("toGridRows", () => {
  const result = {
    columns: ["id", "name"],
    rows: [
      [7, "a"],
      [9, "b"],
    ],
  };

  test("keys rows by primary key so identity survives paging and refetch", () => {
    const { rows, identified } = toGridRows(result, [column("id", "INTEGER", 1)], 50);
    expect(identified).toBe(true);
    expect(rows.map((row) => row.id)).toEqual(["[7]", "[9]"]);
    expect(rows[1]?.cells).toEqual({ id: 9, name: "b" });
  });

  test("falls back to absolute positions and reports tables without a key", () => {
    const { rows, identified } = toGridRows(result, [column("id", "INTEGER")], 50);
    expect(identified).toBe(false);
    expect(rows.map((row) => row.id)).toEqual(["#50", "#51"]);
  });
});

describe("sqliteReadOnlyReason", () => {
  test("only the database itself decides, never the file that is open (M1)", () => {
    expect(sqliteReadOnlyReason({ sourceKind: "imported" })).toBeNull();
    expect(sqliteReadOnlyReason({ sourceKind: "opfs" })).toMatch(/read-only/);
    expect(sqliteReadOnlyReason({ sourceKind: "native-android" })).toMatch(/phone/);
  });
});
