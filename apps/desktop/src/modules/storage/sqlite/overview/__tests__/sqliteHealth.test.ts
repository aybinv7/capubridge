import { describe, expect, test } from "vite-plus/test";
import type { SqliteDatabaseFacts, SqliteTableFacts } from "@/types/sqlite.types";
import { healthChecks } from "../sqliteHealth";
import { detectSyncColumns } from "../sqliteSyncColumns";

const table = (name: string, extra: Partial<SqliteTableFacts> = {}): SqliteTableFacts => ({
  name,
  kind: "table",
  withoutRowid: false,
  columns: ["id"],
  hasPrimaryKey: true,
  indexCount: 0,
  bytes: 4096,
  foreignKeys: [],
  ...extra,
});

const facts = (tables: SqliteTableFacts[], extra: Partial<SqliteDatabaseFacts> = {}) => ({
  fileBytes: 40960,
  walBytes: null,
  pageSize: 4096,
  pageCount: 10,
  freelistCount: 0,
  journalMode: "delete",
  userVersion: 3,
  encoding: "UTF-8",
  sizesKnown: true,
  tables,
  ...extra,
});

describe("schema checks", () => {
  test("tables without a key, links without an index, empty tables", () => {
    const checks = healthChecks(
      facts([
        table("log", { hasPrimaryKey: false }),
        table("sale", {
          foreignKeys: [
            { column: "partner_id", targetTable: "partner", indexed: true },
            { column: "user_id", targetTable: "user", indexed: false },
          ],
        }),
        table("partner"),
        table("v", { kind: "view", hasPrimaryKey: false }),
      ]),
      new Map([
        ["log", 3],
        ["sale", 0],
        ["partner", 1],
      ]),
    );
    expect(checks.map((check) => [check.id, check.text, check.tables])).toEqual([
      ["no-key", "1 table has no primary key", ["log"]],
      ["unindexed-links", "1 link has no index", ["sale"]],
      ["empty", "1 table is empty", ["sale"]],
    ]);
  });

  test("a schema with no foreign key says links can only be inferred", () => {
    const checks = healthChecks(facts([table("a"), table("b")]), new Map());
    expect(checks.map((check) => check.id)).toEqual(["no-links"]);
  });

  test("free pages warn past 20 % of the file, with what VACUUM would give back", () => {
    expect(healthChecks(facts([table("a")], { freelistCount: 2 }), new Map())).toEqual([]);
    const [free] = healthChecks(facts([table("a")], { freelistCount: 3 }), new Map());
    expect(free?.text).toBe("30 % of the file is free pages");
    expect(free?.detail).toContain("12 KB");
  });
});

describe("sync columns", () => {
  test("Presalio-like names are found, ordered by how many tables carry them", () => {
    const found = detectSyncColumns([
      table("sale_order", { columns: ["id", "write_date", "_ruid", "active", "name"] }),
      table("res_partner", { columns: ["id", "write_date", "create_date"] }),
      table("app_state", { columns: ["key", "is_dirty", "last_sync"] }),
    ]);
    expect(found.byTable.get("sale_order")).toEqual(["write_date", "_ruid", "active"]);
    expect(found.byTable.get("app_state")).toEqual(["is_dirty", "last_sync"]);
    expect(found.counts[0]).toEqual({ column: "write_date", tables: 2 });
  });

  test("a lookup table's `active` alone is not sync", () => {
    const found = detectSyncColumns([
      table("uom", { columns: ["id", "name", "active"] }),
      table("v", { kind: "view", columns: ["write_date"] }),
    ]);
    expect(found.byTable.size).toBe(0);
  });
});
