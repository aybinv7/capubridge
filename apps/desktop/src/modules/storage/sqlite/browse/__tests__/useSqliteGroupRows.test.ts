import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createApp, effectScope, nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import type { SqliteQueryResult } from "@/types/sqlite.types";

const device = vi.hoisted(() => ({ sql: [] as string[], rows: new Map<string, unknown[][]>() }));

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../sqliteReads", () => ({
  runQuery: (_address: unknown, sql: string): Promise<SqliteQueryResult> => {
    device.sql.push(sql);
    const match = [...device.rows.entries()].find(([needle]) => sql.includes(needle));
    const rows = match?.[1] ?? [];
    return Promise.resolve({
      columns: ["id", "role"],
      rows,
      rowCount: rows.length,
      changes: 0,
      durationMs: 1,
    });
  },
  readTablePage: vi.fn(),
}));

const { useSqliteTableQuery } = await import("../useSqliteTableQuery");
const { useSqliteGroupRows } = await import("../useSqliteGroupRows");

const flush = async () => {
  for (let i = 0; i < 6; i++) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 4; i++) await nextTick();
};

const scopes: (() => void)[] = [];
beforeEach(() => {
  setActivePinia(createPinia());
});
afterEach(() => {
  scopes.splice(0).forEach((stop) => stop());
  device.sql.length = 0;
  device.rows.clear();
});

function setup() {
  const app = createApp({});
  app.use(VueQueryPlugin, {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  const scope = effectScope();
  scopes.push(() => scope.stop());
  const result = app.runWithContext(() =>
    scope.run(() => {
      const table = ref("orders");
      const query = useSqliteTableQuery({
        run: vi.fn(),
        table,
        database: ref("shop.db"),
        currentColumns: () => ["id", "role"],
        allColumns: () => ["id", "role"],
      });
      const groupPage = ref<SqliteQueryResult | null>(null);
      const groups = useSqliteGroupRows({
        address: ref({ serial: "R5", package: "com.shop", path: "/x.db" }),
        table,
        query,
        rowOrder: ref({ kind: "none" as const }),
        columnInfo: ref([
          { cid: 0, name: "id", colType: "INTEGER", notnull: false, defaultValue: null, pk: 1 },
          { cid: 1, name: "role", colType: "TEXT", notnull: false, defaultValue: null, pk: 0 },
        ]),
        groupPage,
        stateKey: ref("db/orders"),
      });
      return { query, groups, groupPage };
    }),
  );
  if (!result) throw new Error("setup did not run");
  return result;
}

function page(rows: unknown[][]): SqliteQueryResult {
  return { columns: ["role", "rows"], rows, rowCount: rows.length, changes: 0, durationMs: 1 };
}

describe("useSqliteGroupRows", () => {
  test("a group reads its rows only once opened, under the search, and pages by 100", async () => {
    const { query, groups, groupPage } = setup();
    query.setGroupBy("role");
    query.setSearch("kg");
    groupPage.value = page([
      ["admin", 150],
      [null, 2],
    ]);
    await flush();
    expect(device.sql).toEqual([]);
    expect(groups.rows.value.map((row) => row.id)).toEqual(["group:s:admin", "group:null"]);

    device.rows.set(
      `"role" = 'admin'`,
      Array.from({ length: 101 }, (_, i) => [i + 1, "admin"]),
    );
    groups.toggle("group:s:admin", true);
    await flush();
    expect(device.sql[0]).toContain(`"role" = 'admin'`);
    expect(device.sql[0]).toContain(`LIKE '%kg%'`);
    expect(device.sql[0]).toContain("LIMIT 101 OFFSET 0");
    const ids = groups.rows.value.map((row) => row.id);
    expect(ids).toHaveLength(1 + 100 + 1 + 1);
    expect(ids[101]).toBe("note:more:s:admin");
    expect(groups.dataRows.value).toHaveLength(100);

    groups.noteAction("note:more:s:admin");
    await flush();
    expect(device.sql[1]).toContain("LIMIT 101 OFFSET 100");
  });

  test("NULL groups read with IS NULL; open groups are kept per table by value", async () => {
    const first = setup();
    first.query.setGroupBy("role");
    first.groupPage.value = page([[null, 2]]);
    await flush();
    first.groups.toggle("group:null", true);
    await flush();
    expect(device.sql[0]).toContain(`"role" IS NULL`);

    const again = setup();
    again.query.setGroupBy("role");
    again.groupPage.value = page([
      ["admin", 1],
      [null, 2],
    ]);
    await flush();
    expect(again.groups.rows.value[1]?.section?.open).toBe(true);
    expect(again.groups.openCount.value).toBe(1);
    again.groups.closeAll();
    expect(again.groups.openCount.value).toBe(0);
  });

  test("a header names the group it stands for, for Filter to this group", async () => {
    const { query, groups, groupPage } = setup();
    query.setGroupBy("role");
    groupPage.value = page([["admin", 1]]);
    await flush();
    expect(groups.groupOf("group:s:admin")?.value).toBe("admin");
    query.openGroup(groups.groupOf("group:s:admin")?.value);
    expect(query.groupBy.value).toBeNull();
    expect(query.effectiveWhere.value).toBe(`"role" = 'admin'`);
  });
});
