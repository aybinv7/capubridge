import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createApp, effectScope, nextTick, ref } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import type { SqliteQueryResult } from "@/types/sqlite.types";

interface Pending {
  sql: string;
  resolve: (result: SqliteQueryResult) => void;
}

const device = vi.hoisted(() => ({ pending: [] as Pending[], sql: [] as string[] }));

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../sqliteReads", () => ({
  runQuery: (_address: unknown, sql: string) => {
    device.sql.push(sql);
    return new Promise<SqliteQueryResult>((resolve) => device.pending.push({ sql, resolve }));
  },
  readTablePage: (_a: unknown, table: string, offset: number) => {
    const sql = `page ${table} ${offset}`;
    device.sql.push(sql);
    return new Promise<SqliteQueryResult>((resolve) => device.pending.push({ sql, resolve }));
  },
}));

const { useSqliteTableQuery } = await import("../browse/useSqliteTableQuery");
const { useSqliteRows } = await import("../browse/useSqliteRows");

function result(rows: unknown[][], columns = ["id"]): SqliteQueryResult {
  return { columns, rows, rowCount: rows.length, changes: 0, durationMs: 1 };
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const scopes: (() => void)[] = [];
afterEach(() => {
  scopes.splice(0).forEach((stop) => stop());
  device.pending.length = 0;
  device.sql.length = 0;
});

function setup() {
  const app = createApp({});
  app.use(VueQueryPlugin, {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  const scope = effectScope();
  scopes.push(() => scope.stop());
  return app.runWithContext(() =>
    scope.run(() => {
      const table = ref("orders");
      const query = useSqliteTableQuery({
        run: vi.fn(),
        table,
        database: ref("shop.db"),
        currentColumns: () => ["id", "role"],
        allColumns: () => ["id", "role"],
      });
      const rows = useSqliteRows({
        address: ref({ serial: "R5", package: "com.shop", path: "/x.db" }),
        table,
        query,
        tableRowCount: ref(26),
        rowOrder: ref({ kind: "none" as const }),
      });
      return { query, rows };
    }),
  )!;
}

describe("useSqliteTableQuery", () => {
  test("every change of what is shown starts from the first page", () => {
    const { query } = setup();
    query.page.value = 3;
    query.setGroupBy("role");
    expect(query.page.value).toBe(0);
    query.page.value = 2;
    query.setWhere("id > 5");
    expect(query.page.value).toBe(0);
  });

  test("opening a group leaves the grouped view filtered to that value", () => {
    const { query } = setup();
    query.setGroupBy("role");
    query.openGroup("assistant");
    expect(query.groupBy.value).toBeNull();
    expect(query.whereClause.value).toBe(`"role" = 'assistant'`);
  });

  test("search combines with the WHERE clause on every column", () => {
    const { query } = setup();
    query.setWhere("id > 5");
    query.setSearch("kg");
    expect(query.effectiveWhere.value).toContain(`(id > 5) AND (CAST("id" AS TEXT) LIKE '%kg%'`);
  });
});

describe("useSqliteRows", () => {
  test("a slow answer for an older page never replaces the newer one (C17)", async () => {
    const { query, rows } = setup();
    await flush();
    const first = device.pending.shift();
    first?.resolve(result([[1]]));
    await flush();
    query.page.value = 1;
    await flush();
    query.page.value = 2;
    await flush();
    const [older, newer] = device.pending.splice(0);
    newer?.resolve(result([[3]]));
    await flush();
    older?.resolve(result([[2]]));
    await flush();
    expect(query.page.value).toBe(2);
    expect(rows.page.value?.result.rows).toEqual([[3]]);
  });

  test("the count runs once per filter, not once per page (F8)", async () => {
    const { query, rows } = setup();
    query.setWhere("id > 5");
    await flush();
    const answer = (entry: Pending) =>
      entry.resolve(
        entry.sql.startsWith("SELECT COUNT") ? result([[120]], ["total"]) : result([[6]]),
      );
    device.pending.splice(0).forEach(answer);
    await flush();
    expect(rows.total.value).toBe(120);
    query.page.value = 1;
    await flush();
    device.pending.splice(0).forEach(answer);
    await flush();
    expect(device.sql.filter((sql) => sql.startsWith("SELECT COUNT"))).toHaveLength(1);
    expect(rows.total.value).toBe(120);
  });

  test("grouping asks for counts per value and for the number of groups", async () => {
    const { query } = setup();
    query.setGroupBy("role");
    await flush();
    expect(device.sql.some((sql) => sql.includes('GROUP BY "role"'))).toBe(true);
    expect(device.sql).toContain(
      'SELECT COUNT(*) AS total FROM (SELECT 1 FROM "orders" GROUP BY "role")',
    );
  });

  test("plain rows report the table's own count", () => {
    const { rows } = setup();
    expect(rows.total.value).toBe(26);
  });
});
