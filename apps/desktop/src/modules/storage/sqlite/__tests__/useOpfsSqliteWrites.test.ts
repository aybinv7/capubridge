import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { LiveSqliteChange, LiveSqliteOutcome } from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import type { SqliteDbFile } from "@/types/sqlite.types";

const ipc = vi.hoisted(() => ({
  calls: [] as Array<{ command: string; args: Record<string, unknown> }>,
  pullFails: false,
}));
const live = vi.hoisted(() => ({
  outcome: { status: "done", dangling: [] } as LiveSqliteOutcome,
  calls: [] as Array<{ filename: string; change: LiveSqliteChange }>,
}));
const paused = vi.hoisted(() => ({ count: 0 }));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(() => "t1"),
  warning: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({ toast }));
vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: vi.fn(async (command: string, args: Record<string, unknown>) => {
    ipc.calls.push({ command, args });
    if (command === "opfs_backup_sqlite") {
      if (ipc.pullFails) throw new Error("The page went away");
      return { path: "C:/t/kept.db", size: 1, lastModified: 0 };
    }
    if (command === "opfs_rewrite_sqlite") {
      return { size: 1, backup: "C:/t/paused.db", dangling: [] };
    }
    return undefined;
  }),
}));
vi.mock("@/modules/storage/useAppPause", () => ({
  PAUSE_COST: "The app is paused.",
  useAppPause: () => ({
    wsUrl: () => "ws://127.0.0.1:1/devtools/page/p1",
    targetId: () => "p1",
    paused: async <T>(work: (origin: string) => Promise<T>) => {
      paused.count += 1;
      return work("https://localhost");
    },
  }),
}));
vi.mock("@/modules/storage/useLiveSqlite", () => ({
  LIVE_COST: "The app keeps running.",
  useLiveSqlite: () => ({
    apply: async (filename: string, change: LiveSqliteChange) => {
      live.calls.push({ filename, change });
      return live.outcome;
    },
  }),
}));

const { useOpfsSqliteWrites } = await import("../useOpfsSqliteWrites");

const db: SqliteDbFile = {
  name: "PresalioStore.sqlite3",
  path: "opfs:p1:.opaque/76fwihhy1xu",
  size: 1,
  sourceKind: "opfs",
  sourceTargetId: "p1",
  sourceOpfsPath: ".opaque/76fwihhy1xu",
  stripSahPoolHeader: true,
};

function setup(answers: boolean[] = [true]) {
  const confirm = vi.fn(async (_request: ConfirmRequest) => answers.shift() ?? false);
  const changed = vi.fn();
  const writes = useOpfsSqliteWrites({
    confirm,
    changeSerial: () => "serial",
    changePackage: () => "pkg",
    changed,
    erased: vi.fn(),
  });
  return { writes, confirm, changed };
}

const product = [{ name: "product", tableType: "table" }];

describe("changing the app's OPFS database", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    ipc.calls.length = 0;
    ipc.pullFails = false;
    live.calls.length = 0;
    live.outcome = { status: "done", dangling: [] };
    paused.count = 0;
    vi.clearAllMocks();
  });

  test("goes through the app's connection by the name it opened, after a copy is kept", async () => {
    const { writes, changed } = setup();
    await writes.changeTables(db, product, "empty");
    expect(ipc.calls.map((call) => call.command)).toEqual(["opfs_backup_sqlite"]);
    expect(live.calls).toEqual([
      {
        filename: "PresalioStore.sqlite3",
        change: { kind: "sql", sql: 'DELETE FROM "product";' },
      },
    ]);
    expect(paused.count).toBe(0);
    expect(changed).toHaveBeenCalledWith(db);
    expect(toast.success).toHaveBeenCalledWith(
      "Deleted every row of “product” on the phone",
      expect.objectContaining({ description: expect.stringContaining("C:/t/kept.db") }),
    );
  });

  test("rows left pointing at removed rows turn the report into a warning", async () => {
    live.outcome = {
      status: "done",
      dangling: [{ table: "pack_item", parent: "product", rows: 28 }],
    };
    const { writes } = setup();
    await writes.changeTables(db, product, "empty");
    expect(toast.warning).toHaveBeenCalledWith(
      "Deleted every row of “product” on the phone",
      expect.objectContaining({
        description: expect.stringContaining("28 rows of “pack_item” into “product”"),
      }),
    );
  });

  test("when SQLite refuses the change, the app is not paused to try again", async () => {
    live.outcome = { status: "failed", message: "Change 2 of 2 would touch 0 rows" };
    const { writes, confirm } = setup();
    await writes.emptyDatabase(db);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(paused.count).toBe(0);
    expect(toast.error).toHaveBeenCalledWith(
      "The change to “PresalioStore.sqlite3” did not go through",
      expect.objectContaining({ description: "Change 2 of 2 would touch 0 rows" }),
    );
  });

  test("when the connection cannot be used, it asks, then makes the change paused", async () => {
    live.outcome = { status: "unavailable", reason: "The app kept a transaction open." };
    const { writes, confirm } = setup([true, true]);
    await writes.changeTables(db, product, "drop");
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ title: "Pause the app to change “PresalioStore.sqlite3”?" }),
    );
    expect(paused.count).toBe(1);
    expect(ipc.calls.at(-1)).toEqual(
      expect.objectContaining({
        command: "opfs_rewrite_sqlite",
        args: expect.objectContaining({ sql: 'DROP TABLE "product";' }),
      }),
    );
  });

  test("declining the pause changes nothing", async () => {
    live.outcome = { status: "unavailable", reason: "No connection." };
    const { writes } = setup([true, false]);
    await writes.emptyDatabase(db);
    expect(paused.count).toBe(0);
    expect(ipc.calls.map((call) => call.command)).toEqual(["opfs_backup_sqlite"]);
  });

  test("without a copy to keep, nothing is changed", async () => {
    ipc.pullFails = true;
    const { writes } = setup();
    await writes.emptyDatabase(db);
    expect(live.calls).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(
      "“PresalioStore.sqlite3” was not changed",
      expect.objectContaining({ description: expect.stringContaining("The page went away") }),
    );
  });
});
