import { invoke } from "@tauri-apps/api/core";
import { useSQLite } from "@/composables/useSQLite";
import type { SqliteColumnInfo, SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";

type SnapshotReason = "initial" | "change" | "final";

interface RecordingDatabaseSourceInput {
  id: string;
  kind: "sqlite";
  origin: string;
  databaseName: string;
  storeName: string;
  label: string;
  recordCount: number;
  metadataJson: string;
}

interface RecordingDatabaseSnapshotRowInput {
  keyJson: string;
  valueJson: string;
}

const pageSize = 500;
const snapshotIntervalMs = 5000;

function safeJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? "null" : serialized;
  } catch {
    return JSON.stringify(String(value));
  }
}

function sourceId(serial: string, packageName: string, dbPath: string, tableName: string) {
  return `sqlite:${serial}:${packageName}:${dbPath}:${tableName}`;
}

function rowObject(columns: string[], row: unknown[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (let index = 0; index < columns.length; index++) {
    record[columns[index]] = row[index] ?? null;
  }
  return record;
}

function rowKey(columns: string[], pkColumns: SqliteColumnInfo[], record: Record<string, unknown>) {
  const pk = pkColumns.filter((column) => column.pk).sort((a, b) => a.cid - b.cid);
  if (pk.length > 0) {
    return safeJson(pk.map((column) => record[column.name] ?? null));
  }
  return safeJson(columns.map((column) => record[column] ?? null));
}

function makeSource(
  serial: string,
  packageName: string,
  db: SqliteDbFile,
  table: SqliteTableInfo,
  columnInfo: SqliteColumnInfo[],
): RecordingDatabaseSourceInput {
  return {
    id: sourceId(serial, packageName, db.path, table.name),
    kind: "sqlite",
    origin: packageName,
    databaseName: db.name,
    storeName: table.name,
    label: `${db.name}.${table.name}`,
    recordCount: table.rowCount,
    metadataJson: safeJson({
      serial,
      packageName,
      dbPath: db.path,
      dbName: db.name,
      dbSize: db.size,
      table,
      columnInfo,
      columns: columnInfo.map((column) => column.name),
    }),
  };
}

export function useSqliteRecorder(
  sessionId: string,
  startedAt: number,
  serial: string,
  packageName: string,
) {
  const { listDatabases, openDatabase, tableColumns, tableRows } = useSQLite();
  let active = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let run = Promise.resolve();

  function elapsed(reason: SnapshotReason) {
    if (reason === "initial") return 0;
    return Math.max(0, Date.now() - startedAt);
  }

  async function writeTableSnapshot(
    db: SqliteDbFile,
    table: SqliteTableInfo,
    reason: SnapshotReason,
  ) {
    const columnInfo = await tableColumns(serial, packageName, db.path, table.name).catch(
      () => [] as SqliteColumnInfo[],
    );
    const source = makeSource(serial, packageName, db, table, columnInfo);
    const tMs = elapsed(reason);
    const snapshotId = `${sessionId}:${source.id}:${reason}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    await invoke<void>("recording_database_snapshot_begin", {
      sessionId,
      source,
      snapshotId,
      tMs,
    });

    let offset = 0;
    for (;;) {
      const result = await tableRows(serial, packageName, db.path, table.name, offset, pageSize);

      const columns = result.columns.length
        ? result.columns
        : columnInfo.map((column) => column.name);
      const pkColumns = columnInfo.filter((column) => column.pk);
      const records: RecordingDatabaseSnapshotRowInput[] = result.rows.map((row) => {
        const record = rowObject(columns, row);
        return {
          keyJson: rowKey(columns, pkColumns, record),
          valueJson: safeJson(record),
        };
      });

      if (records.length > 0) {
        await invoke<void>("recording_database_snapshot_page", {
          sessionId,
          snapshotId,
          sourceId: source.id,
          records,
        });
      }

      offset += result.rows.length;
      if (result.rows.length < pageSize || offset >= table.rowCount) break;
    }

    await invoke<void>("recording_database_snapshot_finish", {
      sessionId,
      snapshotId,
      sourceId: source.id,
      tMs,
      reason,
    });
  }

  async function captureAll(reason: SnapshotReason) {
    if (!serial || !packageName) return;
    if (!active && reason !== "final") return;

    const databases = await listDatabases(serial, packageName);
    for (const db of databases) {
      if (!active && reason !== "final") return;
      let tables: SqliteTableInfo[] = [];
      try {
        tables = await openDatabase(serial, packageName, db.path);
      } catch (err) {
        console.warn("[sqlite-recorder] open failed", db.name, err);
        continue;
      }

      for (const table of tables) {
        if (!active && reason !== "final") return;
        try {
          await writeTableSnapshot(db, table, reason);
        } catch (err) {
          console.warn("[sqlite-recorder] snapshot failed", db.name, table.name, err);
        }
      }
    }
  }

  function queue(reason: SnapshotReason) {
    run = run
      .catch(() => undefined)
      .then(() => captureAll(reason))
      .catch((err) => {
        console.warn("[sqlite-recorder] capture failed", err);
      });
    return run;
  }

  async function start() {
    active = true;
    await queue("initial");
    timer = setInterval(() => void queue("change"), snapshotIntervalMs);
  }

  async function stop() {
    active = false;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    await run.catch(() => undefined);
    await captureAll("final");
  }

  return { start, stop };
}
