use crate::commands::adb::get_server;
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
    pub pk: bool,
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

fn cache_key(serial: &str, package: &str, db_path: &str) -> String {
    format!("{serial}::{package}::{db_path}")
}

fn temp_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("capubridge-sqlite");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

// ─── On-device helpers ──────────────────────────────────────────────────────────
// Run sqlite3 on the device via run-as. No file transfer needed.

fn run_sqlite3_on_device(
    device: &mut adb_client::server_device::ADBServerDevice,
    package: &str,
    db_path: &str,
    sql: &str,
) -> Result<String, String> {
    let pkg_escaped = shell_escape(package);
    let path_escaped = shell_escape(db_path);
    let sql_escaped = sql.replace('\'', "'\\''");
    let cmd = format!(
        "run-as '{}' sqlite3 '{}' '{}'",
        pkg_escaped, path_escaped, sql_escaped
    );
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let _ = device.shell_command(&cmd, Some(&mut stdout), Some(&mut stderr));

    let err = String::from_utf8_lossy(&stderr).to_string();
    if !err.trim().is_empty() && err.contains("Error") {
        return Err(err.trim().to_string());
    }
    Ok(String::from_utf8_lossy(&stdout).to_string())
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
    let mut server = get_server().lock();
    let mut device = server
        .get_device_by_name(serial)
        .map_err(|e| format!("Device not found: {e}"))?;

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

fn open_db(local_path: &PathBuf) -> Result<Connection, String> {
    Connection::open_with_flags(
        local_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open database: {e}"))
}

fn sqlite_value_to_json(val: &rusqlite::types::Value) -> Value {
    match val {
        rusqlite::types::Value::Null => Value::Null,
        rusqlite::types::Value::Integer(i) => Value::Number((*i).into()),
        rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(*f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        rusqlite::types::Value::Text(s) => Value::String(s.clone()),
        rusqlite::types::Value::Blob(b) => {
            let hex: String = b
                .iter()
                .take(64)
                .map(|byte| format!("{byte:02x}"))
                .collect();
            let suffix = if b.len() > 64 { "…" } else { "" };
            Value::String(format!("[BLOB {len}B] {hex}{suffix}", len = b.len()))
        }
    }
}

// ─── Commands ───────────────────────────────────────────────────────────────────

/// List .db files inside a package's databases/ directory.
#[tauri::command]
pub async fn sqlite_list_databases(
    serial: String,
    package: String,
) -> Result<Vec<SqliteDbFile>, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {e}"))?;

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
        let local = pull_db_to_temp(&serial, &package, &db_path, true)?;
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

/// Get column info for a table. Uses on-device sqlite3 — no file transfer.
#[tauri::command]
pub async fn sqlite_table_columns(
    serial: String,
    package: String,
    db_path: String,
    table_name: String,
) -> Result<Vec<SqliteColumnInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {e}"))?;

        let safe_table = table_name.replace('"', "\"\"");
        let sql = format!("PRAGMA table_info(\"{safe_table}\");");
        let output = run_sqlite3_on_device(&mut device, &package, &db_path, &sql)?;

        let mut columns = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // PRAGMA table_info output: cid|name|type|notnull|dflt_value|pk
            let parts: Vec<&str> = line.splitn(6, '|').collect();
            if parts.len() < 6 {
                continue;
            }
            columns.push(SqliteColumnInfo {
                cid: parts[0].parse().unwrap_or(0),
                name: parts[1].to_string(),
                col_type: parts[2].to_string(),
                notnull: parts[3] == "1",
                default_value: if parts[4].is_empty() {
                    None
                } else {
                    Some(parts[4].to_string())
                },
                pk: parts[5].trim() == "1",
            });
        }

        Ok(columns)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get indexes for a table. Uses on-device sqlite3 — no file transfer.
#[tauri::command]
pub async fn sqlite_table_indexes(
    serial: String,
    package: String,
    db_path: String,
    table_name: String,
) -> Result<Vec<SqliteIndexInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {e}"))?;

        let safe_table = table_name.replace('"', "\"\"");
        let sql = format!("PRAGMA index_list(\"{safe_table}\");");
        let output = run_sqlite3_on_device(&mut device, &package, &db_path, &sql)?;

        let mut indexes = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // index_list: seq|name|unique|origin|partial
            let parts: Vec<&str> = line.splitn(5, '|').collect();
            if parts.len() < 3 {
                continue;
            }
            let name = parts[1].to_string();
            let unique = parts[2] == "1";

            // Get index columns
            let info_sql = format!("PRAGMA index_info(\"{}\");", name.replace('"', "\"\""));
            let info_output = run_sqlite3_on_device(&mut device, &package, &db_path, &info_sql)
                .unwrap_or_default();

            let columns: Vec<String> = info_output
                .lines()
                .filter_map(|l| {
                    // index_info: seqno|cid|name
                    let p: Vec<&str> = l.splitn(3, '|').collect();
                    p.get(2).map(|s| s.trim().to_string())
                })
                .filter(|s| !s.is_empty())
                .collect();

            // Get index SQL
            let sql_query = format!(
                "SELECT sql FROM sqlite_master WHERE name='{}';",
                name.replace('\'', "''")
            );
            let sql = run_sqlite3_on_device(&mut device, &package, &db_path, &sql_query)
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());

            indexes.push(SqliteIndexInfo {
                name,
                unique,
                columns,
                sql,
            });
        }

        Ok(indexes)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get foreign keys for a table. Uses on-device sqlite3 — no file transfer.
#[tauri::command]
pub async fn sqlite_table_foreign_keys(
    serial: String,
    package: String,
    db_path: String,
    table_name: String,
) -> Result<Vec<SqliteForeignKeyInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {e}"))?;

        let safe_table = table_name.replace('"', "\"\"");
        let sql = format!("PRAGMA foreign_key_list(\"{safe_table}\");");
        let output = run_sqlite3_on_device(&mut device, &package, &db_path, &sql)?;

        let mut foreign_keys = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let parts: Vec<&str> = line.splitn(8, '|').collect();
            if parts.len() < 8 {
                continue;
            }

            foreign_keys.push(SqliteForeignKeyInfo {
                id: parts[0].parse().unwrap_or(0),
                seq: parts[1].parse().unwrap_or(0),
                to_table: parts[2].trim().to_string(),
                from_column: parts[3].trim().to_string(),
                to_column: if parts[4].trim().is_empty() {
                    None
                } else {
                    Some(parts[4].trim().to_string())
                },
                on_update: if parts[5].trim().is_empty() {
                    None
                } else {
                    Some(parts[5].trim().to_string())
                },
                on_delete: if parts[6].trim().is_empty() {
                    None
                } else {
                    Some(parts[6].trim().to_string())
                },
                match_clause: if parts[7].trim().is_empty() {
                    None
                } else {
                    Some(parts[7].trim().to_string())
                },
            });
        }

        Ok(foreign_keys)
    })
    .await
    .map_err(|e| e.to_string())?
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
        let local = pull_db_to_temp(&serial, &package, &db_path, false)?;
        let conn = open_db(&local)?;

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
                    vals.push(sqlite_value_to_json(&val));
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
) -> Result<SqliteQueryResult, String> {
    tokio::task::spawn_blocking(move || {
        let local = pull_db_to_temp(&serial, &package, &db_path, false)?;
        let conn = open_db(&local)?;

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
                    vals.push(sqlite_value_to_json(&val));
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
pub fn sqlite_close_database(serial: String, package: String, db_path: String) {
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
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {e}"))?;

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
