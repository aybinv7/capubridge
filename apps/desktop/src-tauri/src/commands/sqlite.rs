use crate::commands::adb::get_adb_device;
use crate::commands::files::shell_escape;
use adb_client::ADBDeviceExt;
use parking_lot::Mutex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::Write as IoWrite;
use std::path::PathBuf;
use std::sync::LazyLock;

// ─── Types ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteDbFile {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteFileStat {
    pub size: u64,
    pub modified_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteTableInfo {
    pub name: String,
    pub table_type: String,
    pub row_count: i64,
    pub sql: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteColumnInfo {
    pub cid: i64,
    pub name: String,
    pub col_type: String,
    pub notnull: bool,
    pub default_value: Option<String>,
    /// 1-based position of this column within the primary key, or 0 when the
    /// column is not part of it. Kept as the ordinal rather than a flag so
    /// composite keys can be rebuilt in their declared order.
    pub pk: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteIndexInfo {
    pub name: String,
    pub unique: bool,
    pub columns: Vec<String>,
    pub sql: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteForeignKeyInfo {
    pub id: i64,
    pub seq: i64,
    pub from_column: String,
    pub to_table: String,
    pub to_column: Option<String>,
    pub on_update: Option<String>,
    pub on_delete: Option<String>,
    pub match_clause: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub row_count: usize,
    pub changes: u64,
    pub duration_ms: u64,
}

// ─── DB Cache ───────────────────────────────────────────────────────────────────
static DB_CACHE: LazyLock<Mutex<HashMap<String, PathBuf>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub const LOCAL_SERIAL: &str = "__local__";

pub(crate) fn is_local(serial: &str) -> bool {
    serial == LOCAL_SERIAL
}

fn cache_key(serial: &str, package: &str, db_path: &str) -> String {
    format!("{serial}::{package}::{db_path}")
}

fn temp_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("capubridge-sqlite");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub(crate) fn obtain_local_path(
    serial: &str,
    package: &str,
    db_path: &str,
    force: bool,
) -> Result<PathBuf, String> {
    if is_local(serial) {
        let p = PathBuf::from(db_path);
        if !p.exists() {
            return Err(format!("Local DB not found: {}", p.display()));
        }
        return Ok(p);
    }
    pull_db_to_temp(serial, package, db_path, force)
}

pub(crate) fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

fn local_table_columns(conn: &Connection, table: &str) -> Result<Vec<SqliteColumnInfo>, String> {
    let sql = format!("PRAGMA table_info({})", quote_ident(table));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SqliteColumnInfo {
                cid: row.get::<_, i64>(0)?,
                name: row.get::<_, String>(1)?,
                col_type: row.get::<_, String>(2).unwrap_or_default(),
                notnull: row.get::<_, i64>(3).unwrap_or(0) == 1,
                default_value: row.get::<_, Option<String>>(4).unwrap_or(None),
                pk: row.get::<_, i64>(5).unwrap_or(0),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn local_table_indexes(conn: &Connection, table: &str) -> Result<Vec<SqliteIndexInfo>, String> {
    let list_sql = format!("PRAGMA index_list({})", quote_ident(table));
    let mut stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;
    let indexes_raw: Vec<(String, bool)> = stmt
        .query_map([], |row| {
            let name = row.get::<_, String>(1)?;
            let unique = row.get::<_, i64>(2).unwrap_or(0) == 1;
            Ok((name, unique))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut out = Vec::new();
    for (name, unique) in indexes_raw {
        let info_sql = format!("PRAGMA index_info({})", quote_ident(&name));
        let cols: Vec<String> = conn
            .prepare(&info_sql)
            .ok()
            .and_then(|mut s| {
                s.query_map([], |row| row.get::<_, String>(2))
                    .ok()
                    .map(|it| it.filter_map(|r| r.ok()).collect::<Vec<_>>())
            })
            .unwrap_or_default();

        let sql: Option<String> = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE name = ?1",
                [&name],
                |row| row.get::<_, Option<String>>(0),
            )
            .ok()
            .flatten();

        out.push(SqliteIndexInfo {
            name,
            unique,
            columns: cols,
            sql,
        });
    }
    Ok(out)
}

fn local_table_foreign_keys(
    conn: &Connection,
    table: &str,
) -> Result<Vec<SqliteForeignKeyInfo>, String> {
    let sql = format!("PRAGMA foreign_key_list({})", quote_ident(table));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SqliteForeignKeyInfo {
                id: row.get::<_, i64>(0)?,
                seq: row.get::<_, i64>(1)?,
                to_table: row.get::<_, String>(2).unwrap_or_default(),
                from_column: row.get::<_, String>(3).unwrap_or_default(),
                to_column: row.get::<_, Option<String>>(4).unwrap_or(None),
                on_update: row.get::<_, Option<String>>(5).unwrap_or(None),
                on_delete: row.get::<_, Option<String>>(6).unwrap_or(None),
                match_clause: row.get::<_, Option<String>>(7).unwrap_or(None),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

// ─── File pull helpers ──────────────────────────────────────────────────────────

fn pull_db_to_temp(
    serial: &str,
    package: &str,
    db_path: &str,
    force: bool,
) -> Result<PathBuf, String> {
    let key = cache_key(serial, package, db_path);

    if !force {
        let cache = DB_CACHE.lock();
        if let Some(path) = cache.get(&key) {
            if path.exists() {
                return Ok(path.clone());
            }
        }
    }

    let bytes = pull_db_bytes(serial, package, db_path)?;
    if bytes.len() < 16 {
        return Err("File too small to be a valid SQLite database".to_string());
    }
    if &bytes[0..16] != b"SQLite format 3\0" {
        return Err("Not a valid SQLite database file".to_string());
    }

    let safe_name = db_path
        .replace('/', "_")
        .replace('\\', "_")
        .trim_start_matches('_')
        .to_string();
    let filename = format!("{}_{}_{}", serial, package, safe_name);
    let local_path = temp_dir().join(filename);
    std::fs::write(&local_path, &bytes).map_err(|e| format!("Failed to write temp DB: {e}"))?;

    // Best-effort: pull WAL and SHM
    for suffix in ["-wal", "-shm"] {
        let wal_path = format!("{db_path}{suffix}");
        if let Ok(wal_bytes) = pull_db_bytes(serial, package, &wal_path) {
            if !wal_bytes.is_empty() {
                let wal_local = PathBuf::from(format!("{}{}", local_path.display(), suffix));
                let _ = std::fs::write(&wal_local, &wal_bytes);
            }
        }
    }

    DB_CACHE.lock().insert(key, local_path.clone());
    Ok(local_path)
}

fn pull_db_bytes(serial: &str, package: &str, path: &str) -> Result<Vec<u8>, String> {
    let mut device = get_adb_device(serial)?;

    let safe_name = path.replace('/', "_").trim_start_matches('_').to_string();
    let tmp_path = format!("/data/local/tmp/_capu_{safe_name}");
    let cmd = format!(
        "run-as '{}' cat '{}' > '{}'",
        shell_escape(package),
        shell_escape(path),
        shell_escape(&tmp_path),
    );

    let mut stdout = Vec::new();
    device
        .shell_command(&cmd, Some(&mut stdout), None)
        .map_err(|e| format!("Shell command failed: {e}"))?;

    let mut out = Vec::new();
    device
        .pull(&tmp_path, &mut out)
        .map_err(|e| format!("Pull failed: {e}"))?;

    let rm_cmd = format!("rm '{}'", shell_escape(&tmp_path));
    let _ = device.shell_command(&rm_cmd, None, None);

    if out.is_empty() {
        return Err("File is empty or not accessible".to_string());
    }

    Ok(out)
}

pub(crate) fn open_db(local_path: &PathBuf) -> Result<Connection, String> {
    Connection::open_with_flags(
        local_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open database: {e}"))
}

/// Integers JavaScript holds exactly; anything wider travels as text.
const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

/// Bytes of a BLOB sent with a page of rows; a fuller read asks for `full_values`.
const BLOB_PREVIEW_BYTES: usize = 4096;

pub(crate) fn hex_of(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// A cell as JSON. Values JSON cannot carry exactly become typed markers the grid knows:
/// an integer past 2^53 is `{"__type":"Number","value":"<digits>"}` (so a key is never
/// rounded to its neighbour), a BLOB is `{"__type":"Blob","size","hex","complete"}` with its
/// bytes in hex, all of them when `blob_limit` allows, else the first `blob_limit`.
pub(crate) fn sqlite_value_to_json(
    val: &rusqlite::types::Value,
    blob_limit: Option<usize>,
) -> Value {
    match val {
        rusqlite::types::Value::Null => Value::Null,
        rusqlite::types::Value::Integer(i) => {
            if (-MAX_SAFE_INTEGER..=MAX_SAFE_INTEGER).contains(i) {
                Value::Number((*i).into())
            } else {
                serde_json::json!({ "__type": "Number", "value": i.to_string() })
            }
        }
        rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(*f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        rusqlite::types::Value::Text(s) => Value::String(s.clone()),
        rusqlite::types::Value::Blob(b) => {
            let shown = blob_limit.map_or(b.len(), |limit| limit.min(b.len()));
            serde_json::json!({
                "__type": "Blob",
                "size": b.len(),
                "hex": hex_of(&b[..shown]),
                "complete": shown == b.len(),
            })
        }
    }
}

// ─── Commands ───────────────────────────────────────────────────────────────────

/// Size and modification time of one on-device database, without transferring
/// it. Cheap enough to poll, so an unchanged database costs no pull at all.
/// SQLite page writes keep the size stable, so mtime carries the real signal.
#[tauri::command]
pub async fn sqlite_stat_database(
    serial: String,
    package: String,
    db_path: String,
) -> Result<SqliteFileStat, String> {
    tokio::task::spawn_blocking(move || {
        let mut device = get_adb_device(&serial)?;
        let cmd = format!(
            "run-as '{}' stat -c '%Y %s' '{}'",
            shell_escape(&package),
            shell_escape(&db_path)
        );

        let mut stdout = Vec::new();
        let _ = device.shell_command(&cmd, Some(&mut stdout), None::<&mut dyn IoWrite>);
        let output = String::from_utf8_lossy(&stdout);

        let mut parts = output.split_whitespace();
        let modified_at = parts
            .next()
            .and_then(|value| value.parse::<i64>().ok())
            .ok_or_else(|| format!("Could not stat \"{db_path}\""))?;
        let size = parts
            .next()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0);

        Ok(SqliteFileStat { size, modified_at })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// List .db files inside a package's databases/ directory.
#[tauri::command]
pub async fn sqlite_list_databases(
    serial: String,
    package: String,
) -> Result<Vec<SqliteDbFile>, String> {
    tokio::task::spawn_blocking(move || {
        let mut device = get_adb_device(&serial)?;

        let db_dir = format!("/data/data/{package}/databases");
        let cmd = format!(
            "run-as '{}' ls -la '{}'",
            shell_escape(&package),
            shell_escape(&db_dir)
        );

        let mut stdout = Vec::new();
        let _ = device.shell_command(&cmd, Some(&mut stdout), None::<&mut dyn IoWrite>);
        let output = String::from_utf8_lossy(&stdout);

        let mut dbs = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with("total") || line.starts_with("d") {
                continue;
            }
            if line.ends_with("-wal") || line.ends_with("-shm") || line.ends_with("-journal") {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 7 {
                continue;
            }

            let size: u64 = parts[4].parse().unwrap_or(0);
            let name_start = if parts[5].len() == 10 && parts[5].as_bytes().get(4) == Some(&b'-') {
                7usize
            } else {
                8usize
            };

            if name_start >= parts.len() {
                continue;
            }

            let name = parts[name_start..].join(" ");
            if name == "." || name == ".." {
                continue;
            }

            let path = format!("{db_dir}/{name}");
            dbs.push(SqliteDbFile { name, path, size });
        }

        Ok(dbs)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Pull a database from the device and open it. Returns table list.
#[tauri::command]
pub async fn sqlite_open_database(
    serial: String,
    package: String,
    db_path: String,
) -> Result<Vec<SqliteTableInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let start = std::time::Instant::now();
        log::info!(
            "[sqlite_open_database] Pulling {}::{}::{} to temp",
            serial,
            package,
            db_path
        );
        let local = obtain_local_path(&serial, &package, &db_path, true)?;
        let pull_ms = start.elapsed().as_millis();
        let file_size = local.metadata().map(|m| m.len()).unwrap_or(0);
        log::info!(
            "[sqlite_open_database] Pulled {} bytes in {}ms to {}",
            file_size,
            pull_ms,
            local.display()
        );
        let conn = open_db(&local)?;
        let open_ms = start.elapsed().as_millis() - pull_ms;
        log::info!("[sqlite_open_database] Opened in {}ms", open_ms);

        let mut stmt = conn
            .prepare(
                "SELECT name, type, sql FROM sqlite_master \
                 WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' \
                 ORDER BY type, name",
            )
            .map_err(|e| format!("Failed to query schema: {e}"))?;

        let tables: Vec<SqliteTableInfo> = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                let table_type: String = row.get(1)?;
                let sql: String = row.get::<_, Option<String>>(2)?.unwrap_or_default();
                Ok((name, table_type, sql))
            })
            .map_err(|e| format!("Failed to read tables: {e}"))?
            .filter_map(|r| r.ok())
            .map(|(name, table_type, sql)| {
                let row_count = conn
                    .query_row(
                        &format!("SELECT COUNT(*) FROM \"{}\"", name.replace('"', "\"\"")),
                        [],
                        |row| row.get::<_, i64>(0),
                    )
                    .unwrap_or(0);
                SqliteTableInfo {
                    name,
                    table_type,
                    row_count,
                    sql,
                }
            })
            .collect();

        log::info!(
            "[sqlite_open_database] Found {} tables in {}",
            tables.len(),
            db_path
        );
        Ok(tables)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Reads one table's metadata from the same copy the rows come from, so the structure
/// on screen always describes the rows on screen (the phone's file may have moved on).
async fn read_table_meta<T: Send + 'static>(
    serial: String,
    package: String,
    db_path: String,
    read: impl FnOnce(&Connection) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tokio::task::spawn_blocking(move || {
        let path = obtain_local_path(&serial, &package, &db_path, false)?;
        let conn = open_db(&path)?;
        read(&conn)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Column info for a table, from the pulled copy.
#[tauri::command]
pub async fn sqlite_table_columns(
    serial: String,
    package: String,
    db_path: String,
    table_name: String,
) -> Result<Vec<SqliteColumnInfo>, String> {
    read_table_meta(serial, package, db_path, move |conn| {
        local_table_columns(conn, &table_name)
    })
    .await
}

/// Indexes of a table with their SQL, from the pulled copy.
#[tauri::command]
pub async fn sqlite_table_indexes(
    serial: String,
    package: String,
    db_path: String,
    table_name: String,
) -> Result<Vec<SqliteIndexInfo>, String> {
    read_table_meta(serial, package, db_path, move |conn| {
        local_table_indexes(conn, &table_name)
    })
    .await
}

/// Foreign keys of a table, from the pulled copy.
#[tauri::command]
pub async fn sqlite_table_foreign_keys(
    serial: String,
    package: String,
    db_path: String,
    table_name: String,
) -> Result<Vec<SqliteForeignKeyInfo>, String> {
    read_table_meta(serial, package, db_path, move |conn| {
        local_table_foreign_keys(conn, &table_name)
    })
    .await
}

/// Fetch paginated rows from a table.
/// This is the only command that pulls the DB file (lazy, cached).
#[tauri::command]
pub async fn sqlite_table_rows(
    serial: String,
    package: String,
    db_path: String,
    table_name: String,
    offset: i64,
    limit: i64,
    order_by: Option<String>,
    order_dir: Option<String>,
) -> Result<SqliteQueryResult, String> {
    tokio::task::spawn_blocking(move || {
        let local = obtain_local_path(&serial, &package, &db_path, false)?;
        let conn = open_db(&local)?;
        let blob_limit = Some(BLOB_PREVIEW_BYTES);

        let safe_table = table_name.replace('"', "\"\"");
        let order_clause = match order_by {
            Some(ref col) => {
                let safe_col = col.replace('"', "\"\"");
                let dir = match order_dir.as_deref() {
                    Some("desc" | "DESC") => "DESC",
                    _ => "ASC",
                };
                format!(" ORDER BY \"{safe_col}\" {dir}")
            }
            None => String::new(),
        };

        let sql =
            format!("SELECT * FROM \"{safe_table}\"{order_clause} LIMIT {limit} OFFSET {offset}");

        let start = std::time::Instant::now();
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Query failed: {e}"))?;

        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let col_count = columns.len();

        let rows: Vec<Vec<Value>> = stmt
            .query_map([], |row| {
                let mut vals = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    let val = row
                        .get_ref(i)
                        .map(|v| v.into())
                        .unwrap_or(rusqlite::types::Value::Null);
                    vals.push(sqlite_value_to_json(&val, blob_limit));
                }
                Ok(vals)
            })
            .map_err(|e| format!("Failed to read rows: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        let duration_ms = start.elapsed().as_millis() as u64;
        let row_count = rows.len();

        Ok(SqliteQueryResult {
            columns,
            rows,
            row_count,
            changes: 0,
            duration_ms,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Execute arbitrary SQL query. Pulls the DB file (lazy, cached).
#[tauri::command]
pub async fn sqlite_execute_query(
    serial: String,
    package: String,
    db_path: String,
    sql: String,
    full_values: Option<bool>,
) -> Result<SqliteQueryResult, String> {
    tokio::task::spawn_blocking(move || {
        let local = obtain_local_path(&serial, &package, &db_path, false)?;
        let conn = open_db(&local)?;
        let blob_limit = if full_values == Some(true) {
            None
        } else {
            Some(BLOB_PREVIEW_BYTES)
        };

        let trimmed = sql.trim();

        let start = std::time::Instant::now();
        let mut stmt = conn
            .prepare(trimmed)
            .map_err(|e| format!("SQL error: {e}"))?;

        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let col_count = columns.len();

        if col_count == 0 {
            return Err("Only SELECT queries are supported on read-only databases".to_string());
        }

        let rows: Vec<Vec<Value>> = stmt
            .query_map([], |row| {
                let mut vals = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    let val = row
                        .get_ref(i)
                        .map(|v| v.into())
                        .unwrap_or(rusqlite::types::Value::Null);
                    vals.push(sqlite_value_to_json(&val, blob_limit));
                }
                Ok(vals)
            })
            .map_err(|e| format!("Query failed: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        let duration_ms = start.elapsed().as_millis() as u64;
        let row_count = rows.len();

        Ok(SqliteQueryResult {
            columns,
            rows,
            row_count,
            changes: 0,
            duration_ms,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Re-pull the database from the device and invalidate cache.
#[tauri::command]
pub async fn sqlite_refresh_database(
    serial: String,
    package: String,
    db_path: String,
) -> Result<Vec<SqliteTableInfo>, String> {
    // Invalidate the cached file so next table_rows call re-pulls
    let key = cache_key(&serial, &package, &db_path);
    if let Some(path) = DB_CACHE.lock().remove(&key) {
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(format!("{}-wal", path.display()));
        let _ = std::fs::remove_file(format!("{}-shm", path.display()));
    }

    // Re-read metadata from device (instant, no file transfer)
    sqlite_open_database(serial, package, db_path).await
}

/// Clean up cached temp files for a specific database.
#[tauri::command]
pub async fn sqlite_close_database(serial: String, package: String, db_path: String) {
    let key = cache_key(&serial, &package, &db_path);
    let mut cache = DB_CACHE.lock();
    if let Some(path) = cache.remove(&key) {
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(format!("{}-wal", path.display()));
        let _ = std::fs::remove_file(format!("{}-shm", path.display()));
    }
}

/// Scan all third-party packages on the device for SQLite databases.
/// Uses batched shell commands to avoid per-package round-trips.
#[tauri::command]
pub async fn sqlite_scan_all_databases(serial: String) -> Result<Vec<SqliteDbFile>, String> {
    tokio::task::spawn_blocking(move || {
        let mut device = get_adb_device(&serial)?;

        // Get list of third-party packages
        let mut pm_stdout = Vec::new();
        let _ = device.shell_command(
            &"pm list packages -3",
            Some(&mut pm_stdout),
            None::<&mut dyn IoWrite>,
        );
        let pm_output = String::from_utf8_lossy(&pm_stdout);

        let packages: Vec<String> = pm_output
            .lines()
            .filter_map(|l| l.strip_prefix("package:"))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        log::info!("[sqlite_scan] Found {} packages", packages.len());

        let mut all_dbs = Vec::new();
        let batch_size = 50;

        for chunk in packages.chunks(batch_size) {
            let mut script_parts = Vec::new();
            for pkg in chunk {
                let pkg_escaped = shell_escape(pkg);
                script_parts.push(format!(
                    "echo 'PKG_MARKER:{}'; run-as '{}' ls -la '/data/data/{}/databases' 2>/dev/null || true",
                    pkg, pkg_escaped, pkg
                ));
            }
            let batch_script = script_parts.join("; ");

            let mut out = Vec::new();
            let _ = device.shell_command(
                &batch_script,
                Some(&mut out),
                None::<&mut dyn IoWrite>,
            );
            let batch_output = String::from_utf8_lossy(&out);

            let mut current_pkg = String::new();
            for line in batch_output.lines() {
                let line = line.trim();
                if let Some(pkg) = line.strip_prefix("PKG_MARKER:") {
                    current_pkg = pkg.trim().to_string();
                    continue;
                }

                if current_pkg.is_empty()
                    || line.is_empty()
                    || line.starts_with("total")
                    || line.starts_with("d")
                {
                    continue;
                }
                if line.ends_with("-wal")
                    || line.ends_with("-shm")
                    || line.ends_with("-journal")
                {
                    continue;
                }
                if line.contains("not debuggable")
                    || line.contains("Unknown package")
                    || line.contains("Permission denied")
                {
                    continue;
                }

                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() < 7 {
                    continue;
                }

                let first_char = parts[0].chars().next().unwrap_or(' ');
                if !matches!(first_char, '-' | 'l') {
                    continue;
                }

                let size: u64 = parts[4].parse().unwrap_or(0);
                let name_start =
                    if parts[5].len() == 10 && parts[5].as_bytes().get(4) == Some(&b'-') {
                        7usize
                    } else {
                        8usize
                    };

                if name_start >= parts.len() {
                    continue;
                }

                let name = parts[name_start..].join(" ");
                if name == "." || name == ".." {
                    continue;
                }

                let db_dir = format!("/data/data/{}/databases", current_pkg);
                let path = format!("{db_dir}/{name}");
                all_dbs.push(SqliteDbFile { name, path, size });
            }
        }

        log::info!("[sqlite_scan] Found {} databases total", all_dbs.len());

        all_dbs.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(all_dbs)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn sqlite_save_local_bytes(name: String, base64_data: String) -> Result<String, String> {
    use base64::Engine;
    use std::sync::atomic::{AtomicU64, Ordering};

    tokio::task::spawn_blocking(move || {
        static LOCAL_DB_COUNTER: AtomicU64 = AtomicU64::new(0);

        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&base64_data)
            .map_err(|e| format!("base64 decode failed: {e}"))?;
        if bytes.len() < 16 {
            return Err("File too small to be a valid SQLite database".to_string());
        }
        if &bytes[0..16] != b"SQLite format 3\0" {
            return Err("Not a valid SQLite database (magic header mismatch)".to_string());
        }

        let safe: String = name
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        let id = LOCAL_DB_COUNTER.fetch_add(1, Ordering::SeqCst);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let filename = format!("opfs-{now}-{id}-{safe}.db");
        let path = temp_dir().join(filename);
        std::fs::write(&path, &bytes).map_err(|e| format!("write failed: {e}"))?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn sqlite_overwrite_local_bytes(path: String, base64_data: String) -> Result<(), String> {
    use base64::Engine;

    tokio::task::spawn_blocking(move || {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&base64_data)
            .map_err(|e| format!("base64 decode failed: {e}"))?;
        if bytes.len() < 16 {
            return Err("File too small to be a valid SQLite database".to_string());
        }
        if &bytes[0..16] != b"SQLite format 3\0" {
            return Err("Not a valid SQLite database (magic header mismatch)".to_string());
        }
        let p = std::path::PathBuf::from(&path);
        let parent = p.parent().ok_or_else(|| "Invalid path".to_string())?;
        if parent != std::path::Path::new("") && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("create_dir_all failed: {e}"))?;
        }
        std::fs::write(&p, &bytes).map_err(|e| format!("write failed: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Read the raw bytes of the current SQLite database (cached pull for native
/// android, the local file otherwise) and return as base64 — used to export
/// a `.sqlite` file to the host filesystem.
#[tauri::command]
pub async fn sqlite_export_bytes(
    serial: String,
    package: String,
    db_path: String,
) -> Result<String, String> {
    use base64::Engine;
    tokio::task::spawn_blocking(move || {
        let local = obtain_local_path(&serial, &package, &db_path, false)?;
        let bytes = std::fs::read(&local).map_err(|e| format!("read failed: {e}"))?;
        Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Execute one or more SQL statements against the database with write
/// permissions. For native android targets this writes to the pulled cache
/// file only — changes are NOT pushed back to the device. For local sessions
/// it mutates the live temp file used by the explorer.
#[tauri::command]
pub async fn sqlite_execute_write(
    serial: String,
    package: String,
    db_path: String,
    sql: String,
) -> Result<SqliteQueryResult, String> {
    tokio::task::spawn_blocking(move || {
        let local = obtain_local_path(&serial, &package, &db_path, false)?;
        let conn = Connection::open_with_flags(
            &local,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|e| format!("Failed to open database (rw): {e}"))?;

        let start = std::time::Instant::now();
        conn.execute_batch(&sql)
            .map_err(|e| format!("SQL error: {e}"))?;
        let duration_ms = start.elapsed().as_millis() as u64;
        let changes = conn.changes();

        Ok(SqliteQueryResult {
            columns: Vec::new(),
            rows: Vec::new(),
            row_count: 0,
            changes,
            duration_ms,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::types::Value as Sql;

    #[test]
    fn integers_past_two_to_the_53_travel_as_exact_text() {
        assert_eq!(
            sqlite_value_to_json(&Sql::Integer(42), None),
            serde_json::json!(42)
        );
        assert_eq!(
            sqlite_value_to_json(&Sql::Integer(9_007_199_254_740_993), None),
            serde_json::json!({ "__type": "Number", "value": "9007199254740993" })
        );
        assert_eq!(
            sqlite_value_to_json(&Sql::Integer(i64::MIN), None),
            serde_json::json!({ "__type": "Number", "value": i64::MIN.to_string() })
        );
    }

    #[test]
    fn blobs_carry_their_bytes_and_say_when_they_are_cut() {
        let bytes = vec![0u8, 255, 16];
        assert_eq!(
            sqlite_value_to_json(&Sql::Blob(bytes.clone()), None),
            serde_json::json!({ "__type": "Blob", "size": 3, "hex": "00ff10", "complete": true })
        );
        assert_eq!(
            sqlite_value_to_json(&Sql::Blob(bytes), Some(2)),
            serde_json::json!({ "__type": "Blob", "size": 3, "hex": "00ff", "complete": false })
        );
    }
}
