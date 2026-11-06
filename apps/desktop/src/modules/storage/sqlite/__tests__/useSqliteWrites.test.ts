import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { SqliteDbFile } from "@/types/sqlite.types";

const writes = vi.hoisted(() => [] as string[]);

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn() },
}));
vi.mock("../sqliteReads", () => ({
  runWrite: vi.fn(async (_address: unknown, sql: string) => {
    writes.push(sql);
    return { columns: [], rows: [], rowCount: 0, changes: 1, durationMs: 0 };
  }),
}));

const { useSqliteWrites } = await import("../useSqliteWrites");

const file: SqliteDbFile = {
  name: "copy.db",
  path: "C:/t/copy.db",
  size: 1,
  sourceKind: "imported",
};
const page: SqliteDbFile = { name: "app.db", path: "opfs:/app.db", size: 1, sourceKind: "opfs" };
const phone: SqliteDbFile = {
  name: "app.db",
  path: "/data/app.db",
  size: 1,
  sourceKind: "native-android",
};
const key = [{ cid: 0, name: "id", colType: "INTEGER", notnull: true, defaultValue: null, pk: 1 }];

function setup() {
  const confirm = vi.fn(async () => true);
  const api = useSqliteWrites({
    confirm,
    addressOf: (db) => ({ serial: "__local__", package: "file", path: db.path }),
    changeSerial: () => "R5",
    changePackage: () => "com.shop",
    afterWrite: vi.fn(),
    tableDropped: vi.fn(),
  });
  return { api, confirm };
}

beforeEach(() => {
  setActivePinia(createPinia());
  writes.length = 0;
});

describe("useSqliteWrites (M1)", () => {
  test("a phone or page database is never written, whatever file is open", async () => {
    const { api, confirm } = setup();
    for (const db of [page, phone]) {
      await api.clearTable(db, "orders");
      await api.dropTable(db, "orders");
      await api.deleteRows(db, "orders", key, [{ id: 1 }]);
      await api.replaceWithDump(db);
    }
    expect(confirm).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  test("an opened file is changed only after the person confirms", async () => {
    const { api, confirm } = setup();
    confirm.mockResolvedValueOnce(false);
    await api.clearTable(file, "orders");
    expect(writes).toEqual([]);
    await api.deleteRows(file, "orders", key, [
      { id: { __type: "Number", value: "9007199254740993" } },
    ]);
    expect(writes).toEqual([`DELETE FROM "orders" WHERE ("id" = 9007199254740993)`]);
  });
});
