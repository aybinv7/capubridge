import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { useSQLite } from "@/composables/useSQLite";
import type { SqliteQueryResult, SqliteTableInfo } from "@/types/sqlite.types";

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "string" && v.startsWith("[BLOB ")) return "NULL";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return `'${s.replace(/'/g, "''")}'`;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, bytes.length)) as unknown as number[],
    );
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export async function exportSqliteFile(
  serial: string,
  pkg: string,
  dbPath: string,
  defaultName: string,
): Promise<string | null> {
  const dest = await save({
    defaultPath: defaultName.endsWith(".sqlite") ? defaultName : `${defaultName}.sqlite`,
    filters: [{ name: "SQLite database", extensions: ["sqlite", "db"] }],
  });
  if (!dest) return null;

  const { exportBytes } = useSQLite();
  const bytes = await exportBytes(serial, pkg, dbPath);
  await invoke<void>("save_base64_file", { path: dest, data: bytesToBase64(bytes) });
  return dest;
}

export async function buildSqlDump(
  serial: string,
  pkg: string,
  dbPath: string,
  tables: SqliteTableInfo[],
): Promise<string> {
  const { executeQuery } = useSQLite();
  const lines: string[] = [];
  lines.push("PRAGMA foreign_keys=OFF;");
  lines.push("BEGIN TRANSACTION;");

  // Schema: tables, then indexes (excluding auto-indexes).
  const schemaRes = await executeQuery(
    serial,
    pkg,
    dbPath,
    "SELECT type, name, sql FROM sqlite_master " +
      "WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' " +
      "ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name",
  );
  for (const row of schemaRes.rows) {
    const [, , sql] = row as [string, string, string];
    if (sql) lines.push(`${sql};`);
  }

  // Rows per table.
  for (const t of tables) {
    if (t.tableType !== "table") continue;
    const ident = quoteIdent(t.name);
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const result: SqliteQueryResult = await executeQuery(
        serial,
        pkg,
        dbPath,
        `SELECT * FROM ${ident} LIMIT ${pageSize} OFFSET ${offset}`,
      );
      if (result.rows.length === 0) break;
      const cols = result.columns.map(quoteIdent).join(",");
      for (const row of result.rows) {
        const values = (row as unknown[]).map(sqlLiteral).join(",");
        lines.push(`INSERT INTO ${ident} (${cols}) VALUES (${values});`);
      }
      if (result.rows.length < pageSize) break;
      offset += pageSize;
    }
  }

  lines.push("COMMIT;");
  lines.push("PRAGMA foreign_keys=ON;");
  return lines.join("\n");
}

export async function exportSqlDump(
  serial: string,
  pkg: string,
  dbPath: string,
  tables: SqliteTableInfo[],
  defaultName: string,
): Promise<string | null> {
  const dest = await save({
    defaultPath: defaultName.endsWith(".sql") ? defaultName : `${defaultName}.sql`,
    filters: [{ name: "SQL dump", extensions: ["sql"] }],
  });
  if (!dest) return null;

  const dump = await buildSqlDump(serial, pkg, dbPath, tables);
  await invoke<void>("save_base64_file", { path: dest, data: textToBase64(dump) });
  return dest;
}

export interface PickedSqliteFile {
  path: string;
  name: string;
  bytes: Uint8Array;
}

export async function pickSqliteFile(): Promise<PickedSqliteFile | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "SQLite database", extensions: ["sqlite", "db", "db3", "sqlite3"] }],
  });
  if (!picked || Array.isArray(picked)) return null;
  const base64 = await invoke<string>("read_local_file_base64", { path: picked });
  const bytes = base64ToBytes(base64);
  const name = picked.split(/[\\/]/).pop() || "imported.sqlite";
  return { path: picked, name, bytes };
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
  const base64 = await invoke<string>("read_local_file_base64", { path: picked });
  const bytes = base64ToBytes(base64);
  const sql = new TextDecoder("utf-8").decode(bytes);
  const name = picked.split(/[\\/]/).pop() || "imported.sql";
  return { path: picked, name, sql };
}

/**
 * Apply a SQL dump against the current DB: clears all user-defined tables
 * first (DROP TABLE), then runs the dump's CREATE + INSERT statements.
 * Wrapped in a transaction by `sqlite_execute_write` -> execute_batch.
 */
export async function importSqlDump(
  serial: string,
  pkg: string,
  dbPath: string,
  existingTables: SqliteTableInfo[],
  dumpSql: string,
): Promise<void> {
  const { executeWrite } = useSQLite();
  const dropStatements = existingTables
    .filter((t) => t.tableType === "table")
    .map((t) => `DROP TABLE IF EXISTS ${quoteIdent(t.name)};`)
    .join("\n");
  const wipe = `PRAGMA foreign_keys=OFF;\n${dropStatements}\nPRAGMA foreign_keys=ON;`;
  if (dropStatements) {
    await executeWrite(serial, pkg, dbPath, wipe);
  }
  await executeWrite(serial, pkg, dbPath, dumpSql);
}
