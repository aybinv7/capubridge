import { describe, expect, test, vi } from "vite-plus/test";
import {
  discoverLogicalSqliteReferences,
  type SqliteSchemaDiagnostic,
} from "./storageGraphSqliteDiagnostics";

const customers: SqliteSchemaDiagnostic = {
  database: "shop.db",
  databasePath: "/shop.db",
  table: "customers",
  columns: [{ name: "id", type: "integer", primaryKey: true }],
  indexes: [],
  foreignKeys: [],
};

function orders(declared: boolean): SqliteSchemaDiagnostic {
  return {
    database: "shop.db",
    databasePath: "/shop.db",
    table: "orders",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "customer_id", type: "integer", primaryKey: false },
    ],
    indexes: [{ columns: ["customer_id"] }],
    foreignKeys: declared
      ? [{ fromColumn: "customer_id", toTable: "customers", toColumn: "id" }]
      : [],
  };
}

describe("logical SQLite references (C2)", () => {
  test("a column with a declared foreign key is not guessed a second time", async () => {
    const validate = vi.fn(async () => ({ rows: [[10, 10]] }));
    expect(await discoverLogicalSqliteReferences([customers, orders(true)], validate)).toEqual([]);
    expect(validate).not.toHaveBeenCalled();
  });

  test("an indexed *_id column without one is still found and checked", async () => {
    const validate = vi.fn(async () => ({ rows: [[10, 9]] }));
    const found = await discoverLogicalSqliteReferences([customers, orders(false)], validate);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ sourceColumn: "customer_id", table: "customers" });
  });
});
