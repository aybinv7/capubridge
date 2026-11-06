import { open, save } from "@tauri-apps/plugin-dialog";
import { invokeCommand } from "@/runtime/ipc/client";
import { addressArgs, type SqliteAddress } from "./sqliteAddress";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function stemOf(name: string): string {
  return name.replace(/\.(sqlite3?|db3?)$/i, "") || "database";
}

/** Saves the copy at `address` as a database file; `null` when the person cancelled. */
export async function exportSqliteFile(
  address: SqliteAddress,
  name: string,
): Promise<string | null> {
  const dest = await pickSqliteDestination(name);
  if (!dest) return null;
  const data = await invokeCommand("sqlite_export_bytes", addressArgs(address));
  await invokeCommand("save_base64_file", { path: dest, data });
  return dest;
}

/**
 * Saves the copy at `address` as an SQL dump, written by Rust with every value exact (wide
 * integers, BLOBs as `X'…'`). Resolves with the path and the number of rows written.
 */
export async function exportSqlDump(
  address: SqliteAddress,
  name: string,
): Promise<{ path: string; rows: number } | null> {
  const dest = await save({
    defaultPath: `${stemOf(name)}.sql`,
    filters: [{ name: "SQL dump", extensions: ["sql"] }],
  });
  if (!dest) return null;
  const rows = await invokeCommand("sqlite_export_dump", { ...addressArgs(address), dest });
  return { path: dest, rows };
}

/**
 * Replaces the file at `address` with what `dumpSql` builds, all or nothing: Rust replays it on
 * a copy and swaps the file only when the whole dump ran (M13). Only ever an opened file.
 */
export async function importSqlDump(address: SqliteAddress, dumpSql: string): Promise<void> {
  await invokeCommand("sqlite_import_dump", { ...addressArgs(address), sql: dumpSql });
}

/** Asks for a SQLite file on this computer; resolves its path, or `null` when cancelled. */
export async function pickSqliteFile(): Promise<string | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "SQLite database", extensions: ["sqlite", "db", "db3", "sqlite3"] }],
  });
  return !picked || Array.isArray(picked) ? null : picked;
}

/** Asks where to save a copy of a database file; `null` when the person cancelled. */
export function pickSqliteDestination(name: string): Promise<string | null> {
  return save({
    defaultPath: /\.(sqlite3?|db3?)$/i.test(name) ? name : `${name}.sqlite`,
    filters: [{ name: "SQLite database", extensions: ["sqlite", "db", "sqlite3", "db3"] }],
  });
}

export interface PickedSqlDump {
  path: string;
  name: string;
  sql: string;
}

export async function pickSqlDump(): Promise<PickedSqlDump | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "SQL dump", extensions: ["sql", "txt"] }],
  });
  if (!picked || Array.isArray(picked)) return null;
  const bytes = base64ToBytes(await invokeCommand("read_local_file_base64", { path: picked }));
  const name = picked.split(/[\\/]/).pop() || "imported.sql";
  return { path: picked, name, sql: new TextDecoder("utf-8").decode(bytes) };
}
