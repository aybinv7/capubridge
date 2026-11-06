import { describe, expect, test, vi } from "vite-plus/test";

const calls = vi.hoisted(() => [] as { command: string; args: Record<string, unknown> }[]);

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(async () => "C:/out.sql"),
}));
vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: vi.fn(async (command: string, args: Record<string, unknown>) => {
    calls.push({ command, args });
    return command === "sqlite_export_dump" ? 12 : undefined;
  }),
}));

const { exportSqlDump, importSqlDump } = await import("../sqliteImportExport");

const address = { serial: "__local__", package: "file", path: "C:/Temp/opened.db" };

describe("SQL dumps (M13, C19, F8)", () => {
  test("an import is one all-or-nothing step, never a wipe followed by a replay", async () => {
    calls.length = 0;
    await importSqlDump(address, "CREATE TABLE a (x);");
    expect(calls.map((call) => call.command)).toEqual(["sqlite_import_dump"]);
    expect(calls[0]?.args).toMatchObject({ dbPath: address.path, sql: "CREATE TABLE a (x);" });
  });

  test("an export is written by Rust for the database's own copy", async () => {
    calls.length = 0;
    expect(await exportSqlDump(address, "opened.db")).toEqual({ path: "C:/out.sql", rows: 12 });
    expect(calls).toEqual([
      {
        command: "sqlite_export_dump",
        args: { serial: "__local__", package: "file", dbPath: address.path, dest: "C:/out.sql" },
      },
    ]);
  });
});
