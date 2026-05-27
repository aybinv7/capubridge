use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::fs;

use super::recording::session_work_dir;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingDatabaseSourceInput {
    pub id: String,
    pub kind: String,
    pub origin: String,
    pub database_name: String,
    pub store_name: String,
    pub label: String,
    pub record_count: i64,
    pub metadata_json: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingDatabaseSnapshotRowInput {
    pub key_json: String,
    pub value_json: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayDatabaseSource {
    pub id: String,
    pub kind: String,
    pub origin: String,
    pub database_name: String,
    pub store_name: String,
    pub label: String,
    pub record_count: i64,
    pub metadata_json: Option<String>,
    pub first_seen_ms: Option<i64>,
    pub last_seen_ms: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayDatabaseRow {
    pub key_json: String,
    pub value_json: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayDatabaseRowsResult {
    pub rows: Vec<ReplayDatabaseRow>,
    pub total: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayDatabaseChange {
    pub id: i64,
    pub source_id: String,
    pub t_ms: i64,
    pub operation: String,
    pub key_hash: String,
    pub key_json: String,
    pub before_json: Option<String>,
    pub after_json: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayDatabaseChangesResult {
    pub changes: Vec<ReplayDatabaseChange>,
    pub total: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayDatabaseChangeSummary {
    pub add: i64,
    pub update: i64,
    pub delete: i64,
    pub total: i64,
    pub latest_ms: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayDatabaseSourceChangeSummary {
    pub source_id: String,
    pub add: i64,
    pub update: i64,
    pub delete: i64,
    pub total: i64,
    pub latest_ms: Option<i64>,
}

struct ActiveVersion {
    id: i64,
    value_json: String,
}

struct SnapshotRow {
    key_hash: String,
    key_json: String,
    value_json: String,
}

fn sqlite_error(error: rusqlite::Error) -> String {
    error.to_string()
}

fn configure_write_connection(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA journal_mode = DELETE;
        PRAGMA synchronous = NORMAL;
        PRAGMA temp_store = MEMORY;
        PRAGMA foreign_keys = ON;
        PRAGMA cache_size = -64000;
        ",
    )
    .map_err(sqlite_error)
}

fn ensure_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS replay_sources (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          origin TEXT NOT NULL,
          database_name TEXT NOT NULL,
          store_name TEXT NOT NULL,
          label TEXT NOT NULL,
          record_count INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT,
          first_seen_ms INTEGER,
          last_seen_ms INTEGER
        );

        CREATE TABLE IF NOT EXISTS record_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          key_json TEXT NOT NULL,
          value_json TEXT NOT NULL,
          valid_from_ms INTEGER NOT NULL,
          valid_to_ms INTEGER,
          operation TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_record_versions_visible
          ON record_versions(source_id, valid_from_ms, valid_to_ms);

        CREATE INDEX IF NOT EXISTS idx_record_versions_key
          ON record_versions(source_id, key_hash, valid_to_ms);

        CREATE TABLE IF NOT EXISTS replay_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id TEXT NOT NULL,
          t_ms INTEGER NOT NULL,
          operation TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          key_json TEXT NOT NULL,
          before_json TEXT,
          after_json TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_replay_changes_source_time
          ON replay_changes(source_id, t_ms, id);

        CREATE INDEX IF NOT EXISTS idx_replay_changes_key
          ON replay_changes(source_id, key_hash, t_ms, id);

        CREATE TABLE IF NOT EXISTS snapshot_seen (
          snapshot_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          key_json TEXT NOT NULL,
          value_json TEXT NOT NULL,
          PRIMARY KEY (snapshot_id, source_id, key_hash)
        );
        ",
    )
    .map_err(sqlite_error)
}

fn open_recording_database(app: &tauri::AppHandle, session_id: &str) -> Result<Connection, String> {
    let work_dir = session_work_dir(app, session_id)?;
    fs::create_dir_all(&work_dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(work_dir.join("databases.sqlite")).map_err(sqlite_error)?;
    configure_write_connection(&conn)?;
    ensure_schema(&conn)?;
    Ok(conn)
}

fn open_read_database(database_path: &str) -> Result<Connection, String> {
    Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(sqlite_error)
}

fn upsert_source(
    tx: &Transaction<'_>,
    source: &RecordingDatabaseSourceInput,
    t_ms: i64,
) -> Result<(), String> {
    tx.execute(
        "
        INSERT INTO replay_sources (
          id, kind, origin, database_name, store_name, label, record_count,
          metadata_json, first_seen_ms, last_seen_ms
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          origin = excluded.origin,
          database_name = excluded.database_name,
          store_name = excluded.store_name,
          label = excluded.label,
          record_count = excluded.record_count,
          metadata_json = excluded.metadata_json,
          first_seen_ms = CASE
            WHEN replay_sources.first_seen_ms IS NULL THEN excluded.first_seen_ms
            WHEN excluded.first_seen_ms < replay_sources.first_seen_ms THEN excluded.first_seen_ms
            ELSE replay_sources.first_seen_ms
          END,
          last_seen_ms = excluded.last_seen_ms
        ",
        params![
            source.id,
            source.kind,
            source.origin,
            source.database_name,
            source.store_name,
            source.label,
            source.record_count,
            source.metadata_json,
            t_ms
        ],
    )
    .map_err(sqlite_error)?;
    Ok(())
}

fn active_version(
    tx: &Transaction<'_>,
    source_id: &str,
    key_hash: &str,
) -> Result<Option<ActiveVersion>, String> {
    tx.query_row(
        "
        SELECT id, value_json
        FROM record_versions
        WHERE source_id = ?1 AND key_hash = ?2 AND valid_to_ms IS NULL
        ORDER BY valid_from_ms DESC, id DESC
        LIMIT 1
        ",
        params![source_id, key_hash],
        |row| {
            Ok(ActiveVersion {
                id: row.get(0)?,
                value_json: row.get(1)?,
            })
        },
    )
    .optional()
    .map_err(sqlite_error)
}

fn insert_version(
    tx: &Transaction<'_>,
    source_id: &str,
    row: &SnapshotRow,
    t_ms: i64,
    operation: &str,
) -> Result<(), String> {
    tx.execute(
        "
        INSERT INTO record_versions (
          source_id, key_hash, key_json, value_json, valid_from_ms, valid_to_ms, operation
        )
        VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)
        ",
        params![
            source_id,
            row.key_hash,
            row.key_json,
            row.value_json,
            t_ms,
            operation
        ],
    )
    .map_err(sqlite_error)?;
    Ok(())
}

fn insert_change(
    tx: &Transaction<'_>,
    source_id: &str,
    t_ms: i64,
    operation: &str,
    key_hash: &str,
    key_json: &str,
    before_json: Option<&str>,
    after_json: Option<&str>,
) -> Result<(), String> {
    tx.execute(
        "
        INSERT INTO replay_changes (
          source_id, t_ms, operation, key_hash, key_json, before_json, after_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ",
        params![
            source_id,
            t_ms,
            operation,
            key_hash,
            key_json,
            before_json,
            after_json
        ],
    )
    .map_err(sqlite_error)?;
    Ok(())
}

fn map_change(row: &rusqlite::Row<'_>) -> rusqlite::Result<ReplayDatabaseChange> {
    Ok(ReplayDatabaseChange {
        id: row.get(0)?,
        source_id: row.get(1)?,
        t_ms: row.get(2)?,
        operation: row.get(3)?,
        key_hash: row.get(4)?,
        key_json: row.get(5)?,
        before_json: row.get(6)?,
        after_json: row.get(7)?,
    })
}

#[tauri::command]
pub async fn recording_database_snapshot_begin(
    app: tauri::AppHandle,
    session_id: String,
    source: RecordingDatabaseSourceInput,
    snapshot_id: String,
    t_ms: i64,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut conn = open_recording_database(&app, &session_id)?;
        let tx = conn.transaction().map_err(sqlite_error)?;
        upsert_source(&tx, &source, t_ms)?;
        tx.execute(
            "DELETE FROM snapshot_seen WHERE snapshot_id = ?1 AND source_id = ?2",
            params![snapshot_id, source.id],
        )
        .map_err(sqlite_error)?;
        tx.commit().map_err(sqlite_error)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_snapshot_page(
    app: tauri::AppHandle,
    session_id: String,
    snapshot_id: String,
    source_id: String,
    records: Vec<RecordingDatabaseSnapshotRowInput>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut conn = open_recording_database(&app, &session_id)?;
        let tx = conn.transaction().map_err(sqlite_error)?;

        for record in records {
            let key_hash = record.key_json.clone();
            tx.execute(
                "
                INSERT OR REPLACE INTO snapshot_seen (
                  snapshot_id, source_id, key_hash, key_json, value_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5)
                ",
                params![
                    snapshot_id,
                    source_id,
                    key_hash,
                    record.key_json,
                    record.value_json
                ],
            )
            .map_err(sqlite_error)?;
        }

        tx.commit().map_err(sqlite_error)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_snapshot_finish(
    app: tauri::AppHandle,
    session_id: String,
    snapshot_id: String,
    source_id: String,
    t_ms: i64,
    reason: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut conn = open_recording_database(&app, &session_id)?;
        let tx = conn.transaction().map_err(sqlite_error)?;

        let seen_rows = {
            let mut stmt = tx
                .prepare(
                    "
                    SELECT key_hash, key_json, value_json
                    FROM snapshot_seen
                    WHERE snapshot_id = ?1 AND source_id = ?2
                    ",
                )
                .map_err(sqlite_error)?;
            let rows = stmt
                .query_map(params![snapshot_id, source_id], |row| {
                    Ok(SnapshotRow {
                        key_hash: row.get(0)?,
                        key_json: row.get(1)?,
                        value_json: row.get(2)?,
                    })
                })
                .map_err(sqlite_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(sqlite_error)?;
            rows
        };

        for row in &seen_rows {
            match active_version(&tx, &source_id, &row.key_hash)? {
                None => {
                    let operation = if reason == "initial" {
                        "initial"
                    } else {
                        "add"
                    };
                    insert_version(&tx, &source_id, row, t_ms, operation)?;

                    if reason != "initial" {
                        insert_change(
                            &tx,
                            &source_id,
                            t_ms,
                            "add",
                            &row.key_hash,
                            &row.key_json,
                            None,
                            Some(&row.value_json),
                        )?;
                    }
                }
                Some(active) if active.value_json != row.value_json => {
                    tx.execute(
                        "UPDATE record_versions SET valid_to_ms = ?1 WHERE id = ?2",
                        params![t_ms, active.id],
                    )
                    .map_err(sqlite_error)?;
                    insert_version(&tx, &source_id, row, t_ms, "update")?;

                    if reason != "initial" {
                        insert_change(
                            &tx,
                            &source_id,
                            t_ms,
                            "update",
                            &row.key_hash,
                            &row.key_json,
                            Some(&active.value_json),
                            Some(&row.value_json),
                        )?;
                    }
                }
                Some(_) => {}
            }
        }

        let missing_rows = {
            let mut stmt = tx
                .prepare(
                    "
                    SELECT rv.id, rv.key_hash, rv.key_json, rv.value_json
                    FROM record_versions rv
                    LEFT JOIN snapshot_seen ss
                      ON ss.snapshot_id = ?1
                     AND ss.source_id = rv.source_id
                     AND ss.key_hash = rv.key_hash
                    WHERE rv.source_id = ?2
                      AND rv.valid_to_ms IS NULL
                      AND ss.key_hash IS NULL
                    ",
                )
                .map_err(sqlite_error)?;
            let rows = stmt
                .query_map(params![snapshot_id, source_id], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                })
                .map_err(sqlite_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(sqlite_error)?;
            rows
        };

        for (id, key_hash, key_json, value_json) in missing_rows {
            tx.execute(
                "UPDATE record_versions SET valid_to_ms = ?1 WHERE id = ?2",
                params![t_ms, id],
            )
            .map_err(sqlite_error)?;

            if reason != "initial" {
                insert_change(
                    &tx,
                    &source_id,
                    t_ms,
                    "delete",
                    &key_hash,
                    &key_json,
                    Some(&value_json),
                    None,
                )?;
            }
        }

        let active_count: i64 = tx
            .query_row(
                "
                SELECT COUNT(*)
                FROM record_versions
                WHERE source_id = ?1 AND valid_to_ms IS NULL
                ",
                params![source_id],
                |row| row.get(0),
            )
            .map_err(sqlite_error)?;

        tx.execute(
            "UPDATE replay_sources SET record_count = ?1, last_seen_ms = ?2 WHERE id = ?3",
            params![active_count, t_ms, source_id],
        )
        .map_err(sqlite_error)?;
        tx.execute(
            "DELETE FROM snapshot_seen WHERE snapshot_id = ?1 AND source_id = ?2",
            params![snapshot_id, source_id],
        )
        .map_err(sqlite_error)?;

        tx.commit().map_err(sqlite_error)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_sources(
    database_path: String,
) -> Result<Vec<ReplayDatabaseSource>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_read_database(&database_path)?;
        let mut stmt = conn
            .prepare(
                "
                SELECT id, kind, origin, database_name, store_name, label, record_count,
                       metadata_json, first_seen_ms, last_seen_ms
                FROM replay_sources
                ORDER BY kind, origin, database_name, store_name
                ",
            )
            .map_err(sqlite_error)?;

        let sources = stmt
            .query_map([], |row| {
                Ok(ReplayDatabaseSource {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    origin: row.get(2)?,
                    database_name: row.get(3)?,
                    store_name: row.get(4)?,
                    label: row.get(5)?,
                    record_count: row.get(6)?,
                    metadata_json: row.get(7)?,
                    first_seen_ms: row.get(8)?,
                    last_seen_ms: row.get(9)?,
                })
            })
            .map_err(sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sqlite_error)?;
        Ok(sources)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_table_rows(
    database_path: String,
    source_id: String,
    position_ms: i64,
    offset: i64,
    limit: i64,
) -> Result<ReplayDatabaseRowsResult, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_read_database(&database_path)?;
        let safe_offset = offset.max(0);
        let safe_limit = limit.clamp(1, 500);
        let total: i64 = conn
            .query_row(
                "
                SELECT COUNT(*)
                FROM record_versions
                WHERE source_id = ?1
                  AND valid_from_ms <= ?2
                  AND (valid_to_ms IS NULL OR valid_to_ms > ?2)
                ",
                params![source_id, position_ms],
                |row| row.get(0),
            )
            .map_err(sqlite_error)?;

        let mut stmt = conn
            .prepare(
                "
                SELECT key_json, value_json
                FROM record_versions
                WHERE source_id = ?1
                  AND valid_from_ms <= ?2
                  AND (valid_to_ms IS NULL OR valid_to_ms > ?2)
                ORDER BY key_json
                LIMIT ?3 OFFSET ?4
                ",
            )
            .map_err(sqlite_error)?;

        let rows = stmt
            .query_map(
                params![source_id, position_ms, safe_limit, safe_offset],
                |row| {
                    Ok(ReplayDatabaseRow {
                        key_json: row.get(0)?,
                        value_json: row.get(1)?,
                    })
                },
            )
            .map_err(sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sqlite_error)?;

        Ok(ReplayDatabaseRowsResult { rows, total })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_changed_rows(
    database_path: String,
    source_id: String,
    position_ms: i64,
    offset: i64,
    limit: i64,
) -> Result<ReplayDatabaseChangesResult, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_read_database(&database_path)?;
        let safe_offset = offset.max(0);
        let safe_limit = limit.clamp(1, 500);
        let total: i64 = conn
            .query_row(
                "
                SELECT COUNT(*)
                FROM (
                  SELECT MAX(id)
                  FROM replay_changes
                  WHERE source_id = ?1 AND t_ms <= ?2
                  GROUP BY key_hash
                )
                ",
                params![source_id, position_ms],
                |row| row.get(0),
            )
            .map_err(sqlite_error)?;

        let mut stmt = conn
            .prepare(
                "
                SELECT c.id, c.source_id, c.t_ms, c.operation, c.key_hash, c.key_json,
                       c.before_json, c.after_json
                FROM replay_changes c
                JOIN (
                  SELECT MAX(id) AS id
                  FROM replay_changes
                  WHERE source_id = ?1 AND t_ms <= ?2
                  GROUP BY key_hash
                ) latest ON latest.id = c.id
                ORDER BY c.t_ms DESC, c.id DESC
                LIMIT ?3 OFFSET ?4
                ",
            )
            .map_err(sqlite_error)?;

        let changes = stmt
            .query_map(
                params![source_id, position_ms, safe_limit, safe_offset],
                map_change,
            )
            .map_err(sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sqlite_error)?;

        Ok(ReplayDatabaseChangesResult { changes, total })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_change_summary(
    database_path: String,
    source_id: String,
    position_ms: i64,
) -> Result<ReplayDatabaseChangeSummary, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_read_database(&database_path)?;
        let mut summary = ReplayDatabaseChangeSummary {
            add: 0,
            update: 0,
            delete: 0,
            total: 0,
            latest_ms: None,
        };

        let mut stmt = conn
            .prepare(
                "
                SELECT c.operation, COUNT(*), MAX(c.t_ms)
                FROM replay_changes c
                JOIN (
                  SELECT MAX(id) AS id
                  FROM replay_changes
                  WHERE source_id = ?1 AND t_ms <= ?2
                  GROUP BY key_hash
                ) latest ON latest.id = c.id
                GROUP BY c.operation
                ",
            )
            .map_err(sqlite_error)?;

        let rows = stmt
            .query_map(params![source_id, position_ms], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            })
            .map_err(sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sqlite_error)?;

        for (operation, count, latest_ms) in rows {
            match operation.as_str() {
                "add" => summary.add = count,
                "update" => summary.update = count,
                "delete" => summary.delete = count,
                _ => {}
            }
            summary.total += count;
            if latest_ms > summary.latest_ms {
                summary.latest_ms = latest_ms;
            }
        }

        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_change_summaries(
    database_path: String,
    position_ms: i64,
) -> Result<Vec<ReplayDatabaseSourceChangeSummary>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_read_database(&database_path)?;
        let mut stmt = conn
            .prepare(
                "
                SELECT c.source_id, c.operation, COUNT(*), MAX(c.t_ms)
                FROM replay_changes c
                JOIN (
                  SELECT MAX(id) AS id
                  FROM replay_changes
                  WHERE t_ms <= ?1
                  GROUP BY source_id, key_hash
                ) latest ON latest.id = c.id
                GROUP BY c.source_id, c.operation
                ",
            )
            .map_err(sqlite_error)?;

        let rows = stmt
            .query_map(params![position_ms], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                ))
            })
            .map_err(sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sqlite_error)?;

        let mut summaries =
            std::collections::BTreeMap::<String, ReplayDatabaseSourceChangeSummary>::new();

        for (source_id, operation, count, latest_ms) in rows {
            let summary =
                summaries
                    .entry(source_id.clone())
                    .or_insert(ReplayDatabaseSourceChangeSummary {
                        source_id,
                        add: 0,
                        update: 0,
                        delete: 0,
                        total: 0,
                        latest_ms: None,
                    });

            match operation.as_str() {
                "add" => summary.add = count,
                "update" => summary.update = count,
                "delete" => summary.delete = count,
                _ => {}
            }

            summary.total += count;
            if latest_ms > summary.latest_ms {
                summary.latest_ms = latest_ms;
            }
        }

        Ok(summaries.into_values().collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recording_database_changes_for_keys(
    database_path: String,
    source_id: String,
    position_ms: i64,
    key_jsons: Vec<String>,
) -> Result<Vec<ReplayDatabaseChange>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_read_database(&database_path)?;
        let mut stmt = conn
            .prepare(
                "
                SELECT id, source_id, t_ms, operation, key_hash, key_json, before_json, after_json
                FROM replay_changes
                WHERE source_id = ?1 AND key_hash = ?2 AND t_ms <= ?3
                ORDER BY t_ms DESC, id DESC
                LIMIT 1
                ",
            )
            .map_err(sqlite_error)?;

        let mut changes = Vec::new();
        for key_json in key_jsons.into_iter().take(500) {
            if let Some(change) = stmt
                .query_row(params![source_id, key_json, position_ms], map_change)
                .optional()
                .map_err(sqlite_error)?
            {
                changes.push(change);
            }
        }

        Ok(changes)
    })
    .await
    .map_err(|e| e.to_string())?
}
