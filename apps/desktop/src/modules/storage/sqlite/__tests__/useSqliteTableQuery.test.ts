import { describe, expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import { useSqliteTableQuery } from "../browse/useSqliteTableQuery";
import type { SqliteQueryResult } from "@/types/sqlite.types";

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setup() {
  const sql: string[] = [];
  const refetch = vi.fn(async () => undefined);
  const run = vi.fn(async (statement: string): Promise<SqliteQueryResult> => {
    sql.push(statement);
    const isCount = statement.startsWith("SELECT COUNT(*)");
    return {
      columns: isCount ? ["total"] : ["role", "rows"],
      rows: isCount
        ? [[2]]
        : [
            ["user", 13],
            ["assistant", 13],
          ],
      rowCount: isCount ? 1 : 2,
      changes: 0,
      durationMs: 1,
    };
  });
  const page = ref(3);
  const query = useSqliteTableQuery({
    run,
    table: ref("assistant_message"),
    database: ref("Store.sqlite3"),
    orderBy: ref<string | null>(null),
    orderDir: ref<"ASC" | "DESC" | null>(null),
    page,
    pageSize: ref(50),
    tableRowCount: () => 26,
    currentColumns: () => ["id", "role", "text"],
    allColumns: () => ["id", "role", "text"],
    refetch,
  });
  return { query, sql, refetch, page };
}

describe("useSqliteTableQuery", () => {
  test("plain rows need no query and report the table's own count", () => {
    const { query } = setup();
    expect(query.needsQuery.value).toBe(false);
    expect(query.tableTotal.value).toBe(26);
  });

  test("grouping asks the database for counts per value and its group count", async () => {
    const { query, sql, refetch, page } = setup();
    query.setGroupBy("role");
    expect(page.value).toBe(0);
    expect(refetch).toHaveBeenCalled();
    await query.fetchFilteredPage();
    expect(sql[0]).toContain('GROUP BY "role"');
    expect(sql[1]).toBe(
      'SELECT COUNT(*) AS total FROM (SELECT 1 FROM "assistant_message" GROUP BY "role")',
    );
    expect(query.tableTotal.value).toBe(2);
  });

  test("opening a group leaves the grouped view filtered to that value", () => {
    const { query } = setup();
    query.setGroupBy("role");
    query.openGroup("assistant");
    expect(query.groupBy.value).toBeNull();
    expect(query.whereClause.value).toBe(`"role" = 'assistant'`);
  });

  test("search combines with the WHERE clause on every column", async () => {
    const { query, sql } = setup();
    query.setWhere("id > 5");
    query.setSearch("kg");
    await query.fetchFilteredPage();
    expect(sql[0]).toContain(`WHERE ((id > 5) AND (CAST("id" AS TEXT) LIKE '%kg%'`);
  });
});
