import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { SqliteDbFile } from "@/types/sqlite.types";

const writes = vi.hoisted(() => [] as string[]);
const changesets = vi.hoisted(() => [] as string[][]);
const reads = vi.hoisted(() => ({ rows: [] as unknown[][], columns: [] as string[] }));
const ipc = vi.hoisted(() => ({
  calls: [] as Array<{ command: string; args: Record<string, unknown> }>,
  saveFails: false,
}));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("vue-sonner", () => ({ toast }));
vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: vi.fn(async (command: string, args: Record<string, unknown>) => {
    ipc.calls.push({ command, args });
    if (command === "sqlite_open_local_file") {
      return {
        path: "C:/t/copy.db",
        name: "copy.db",
        original: "D:/work/copy.db",
        size: 1,
        walBeside: false,
      };
    }
    if (command === "sqlite_save_opened_file") {
      if (ipc.saveFails) throw new Error("The file is in use");
      return { path: "D:/work/copy.db", backup: "D:/work/copy.db.bak" };
    }
    return undefined;
  }),
}));
vi.mock("../sqliteReads", () => ({
  runWrite: vi.fn(async (_address: unknown, sql: string) => {
    writes.push(sql);
    return { columns: [], rows: [], rowCount: 0, changes: 1, durationMs: 0 };
  }),
  applyChangeset: vi.fn(async (_address: unknown, statements: string[]) => {
    changesets.push([...statements]);
    return {
      insertedRowIds: statements.map((sql, index) =>
        sql.startsWith("INSERT") ? 10 + index : null,
      ),
      durationMs: 0,
    };
  }),
  runQuery: vi.fn(async () => ({
    ...reads,
    rowCount: reads.rows.length,
    changes: 0,
    durationMs: 0,
  })),
}));

const { useSqliteWrites } = await import("../useSqliteWrites");
const { useSqliteFilesStore } = await import("@/modules/storage/stores/useSqliteFilesStore");

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

beforeEach(async () => {
  setActivePinia(createPinia());
  await useSqliteFilesStore().open("D:/work/copy.db");
  ipc.calls.length = 0;
  ipc.saveFails = false;
  for (const fn of Object.values(toast)) fn.mockReset();
  writes.length = 0;
  changesets.length = 0;
  reads.rows = [];
  reads.columns = [];
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

describe("saving staged edits", () => {
  const staged = {
    edits: new Map([
      ["[1]", { rowId: "[1]", original: { id: 1, name: "tea" }, values: { name: "green tea" } }],
    ]),
    inserts: [{ id: "new:1", values: { name: "scone" } }],
  };

  test("a phone or page copy is refused before anything is sent", async () => {
    const { api } = setup();
    for (const db of [page, phone]) {
      expect(await api.saveChanges(db, "item", key, staged)).toBe(false);
    }
    expect(changesets).toEqual([]);
  });

  test("an opened file gets every change in one changeset, then reads them back", async () => {
    const { api } = setup();
    reads.columns = ["id", "name"];
    reads.rows = [[1, "green tea"]];
    expect(await api.saveChanges(file, "item", key, staged)).toBe(true);
    expect(changesets).toEqual([
      [
        `UPDATE "item" SET "name" = 'green tea' WHERE "id" IS 1`,
        `INSERT INTO "item" ("name") VALUES ('scone')`,
      ],
    ]);
  });
});

describe("saving writes the file that was opened (S2)", () => {
  const staged = {
    edits: new Map([
      ["[1]", { rowId: "[1]", original: { id: 1, name: "tea" }, values: { name: "green tea" } }],
    ]),
    inserts: [],
  };

  test("the first save asks, naming the path and the backup, then writes the file", async () => {
    const { api, confirm } = setup();
    reads.columns = ["id", "name"];
    reads.rows = [[1, "green tea"]];
    expect(await api.saveChanges(file, "item", key, staged)).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    const asked = (confirm.mock.calls as unknown as Array<[{ text: string }]>)[0]?.[0];
    expect(asked?.text).toContain("D:/work/copy.db");
    expect(asked?.text).toContain("copy.db.bak");
    expect(ipc.calls.map((call) => call.command)).toEqual(["sqlite_save_opened_file"]);
    expect(toast.success).toHaveBeenCalledWith(
      "Saved 1 change to D:/work/copy.db",
      expect.objectContaining({ description: expect.stringContaining("D:/work/copy.db.bak") }),
    );
    expect(useSqliteFilesStore().files[0]?.unsaved).toBe(false);

    await api.saveChanges(file, "item", key, staged);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  test("saying no saves nothing, not even in the working copy", async () => {
    const { api, confirm } = setup();
    confirm.mockResolvedValueOnce(false);
    expect(await api.saveChanges(file, "item", key, staged)).toBe(false);
    expect(changesets).toEqual([]);
    expect(ipc.calls).toEqual([]);
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("a file that could not be written is never called saved", async () => {
    const { api } = setup();
    ipc.saveFails = true;
    reads.columns = ["id", "name"];
    reads.rows = [[1, "green tea"]];
    await api.saveChanges(file, "item", key, staged);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("D:/work/copy.db was not written"),
      expect.anything(),
    );
    expect(useSqliteFilesStore().files[0]?.unsaved).toBe(true);
  });
});
