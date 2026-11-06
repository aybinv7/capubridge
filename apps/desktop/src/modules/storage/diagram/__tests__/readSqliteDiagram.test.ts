import { expect, test, vi } from "vite-plus/test";

const calls = vi.hoisted(() => [] as { command: string; args: Record<string, unknown> }[]);

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: vi.fn(async (command: string, args: Record<string, unknown>) => {
    calls.push({ command, args });
    if (command === "sqlite_table_columns") {
      return [{ cid: 0, name: "id", colType: "INTEGER", notnull: true, defaultValue: null, pk: 1 }];
    }
    if (command === "sqlite_execute_query") return { columns: [], rows: [], rowCount: 0 };
    return [];
  }),
}));

const { readSqliteDiagram } = await import("../useOwnDiagramEntities");

test("a diagram reads the copy its tab has open and never pulls the database again (F13)", async () => {
  const address = { serial: "__local__", package: "com.shop", path: "C:/Temp/opfs-shop.db" };
  const entities = await readSqliteDiagram({
    kind: "sqlite",
    place: { serial: "R5", packageName: "com.shop", kind: "sqlite", databasePath: "opfs:/shop.db" },
    db: { name: "shop.db", path: "opfs:/shop.db", size: 4096, sourceKind: "opfs" },
    address,
    tables: [
      { name: "orders", tableType: "table", rowCount: 3, sql: "" },
      { name: "customers", tableType: "table", rowCount: 1, sql: "" },
    ],
    openTable: (table) => `/storage/sqlite/x/${table}`,
  });

  expect(entities.map((entity) => entity.title)).toEqual(["orders", "customers"]);
  expect(calls.some((call) => call.command === "sqlite_open_database")).toBe(false);
  expect(calls.some((call) => call.command === "sqlite_refresh_database")).toBe(false);
  for (const call of calls) {
    expect(call.args).toMatchObject({
      serial: "__local__",
      package: "com.shop",
      dbPath: address.path,
    });
  }
});
