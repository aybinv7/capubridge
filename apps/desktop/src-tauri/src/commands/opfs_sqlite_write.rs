//! Changes an app's own OPFS SQLite database: SQL applied to it, or the database erased.
//!
//! Both run while the app is paused (the page reloaded with its code stopped), which the
//! frontend arranges around the call and the device scripts check. A rewrite pulls the file,
//! applies the SQL to a local copy in one transaction, checks the copy, and writes it back; if
//! writing back fails, the bytes read before are written again, and they stay on this computer
//! as a backup either way. A database with changes still in a journal or write-ahead log is
//! refused, since its file alone is not the database.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;

use crate::commands::cdp_proxy::validate_upstream_url;
use crate::commands::opfs_device_writer::{Companion, CompanionRole, OpfsSink, OpfsSqliteFiles};
use crate::commands::opfs_local_copies::{backups_dir, new_copy_path, prune_backups};
use crate::commands::opfs_pull::{
    pull_into_file, CdpSession, OpfsPullResult, OpfsSource, CHUNK_BYTES,
    SAH_POOL_HEADER_DATA_OFFSET, SQLITE_MAGIC,
};
use crate::commands::sqlite_changeset::{run_changeset, SqliteChangeStatement};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpfsRewriteResult {
    /// Bytes of the database now on the page.
    pub size: u64,
    /// The database as it was before the change, on this computer.
    pub backup: String,
    /// Rows of other tables that now point at rows the change removed.
    pub dangling: Vec<OpfsDanglingRows>,
}

/// Rows of `table` whose foreign key points into `parent` at a row that is no longer there.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpfsDanglingRows {
    pub table: String,
    pub parent: String,
    pub rows: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpfsEraseResult {
    /// The database and the journals that went with it.
    pub erased: Vec<String>,
}

fn data_offset(sah_pool: bool) -> u64 {
    if sah_pool {
        SAH_POOL_HEADER_DATA_OFFSET
    } else {
        0
    }
}

fn role_words(role: CompanionRole) -> &'static str {
    match role {
        CompanionRole::Journal => "a rollback journal",
        CompanionRole::Wal => "a write-ahead log",
        CompanionRole::Shm => "a shared-memory file",
    }
}

/// Refuses a database whose latest changes are not in its file yet.
fn refuse_hot(path: &str, companions: &[Companion]) -> Result<(), String> {
    match companions.iter().find(|companion| companion.hot) {
        Some(hot) => Err(format!(
            "\"{path}\" has {} with changes its file does not have yet, so it was not changed. Let the app open it once so SQLite finishes them, then try again.",
            role_words(hot.role)
        )),
        None => Ok(()),
    }
}

fn working_path(before: &Path) -> PathBuf {
    let mut name = before
        .file_name()
        .map(|name| name.to_os_string())
        .unwrap_or_else(|| "opfs.db".into());
    name.push(".working");
    before.with_file_name(name)
}

/// What a rewrite does to the database.
#[derive(Debug, Clone)]
pub(crate) enum SqlChange {
    Statements(String),
    /// Deletes every row of every table, as the copy lists them (not FTS shadow tables).
    EmptyEveryTable,
    /// Staged row edits, new rows and deletes: each statement must change exactly one row, so a
    /// row the app changed or removed since it was read fails the whole change.
    Changeset(Vec<SqliteChangeStatement>),
}

fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

fn empty_every_table_sql(conn: &Connection) -> Result<String, String> {
    let mut query = conn
        .prepare(
            r"SELECT name FROM pragma_table_list WHERE schema = 'main' AND type IN ('table', 'virtual') AND name NOT LIKE 'sqlite\_%' ESCAPE '\' ORDER BY name",
        )
        .map_err(|e| format!("Failed to list the tables: {e}"))?;
    let names = query
        .query_map([], |row| row.get::<_, String>(0))
        .and_then(|rows| rows.collect::<Result<Vec<_>, _>>())
        .map_err(|e| format!("Failed to list the tables: {e}"))?;
    Ok(names
        .iter()
        .map(|name| format!("DELETE FROM {};", quote_ident(name)))
        .collect::<Vec<_>>()
        .join("\n"))
}

fn batch(conn: &Connection, sql: &str) -> Result<(), String> {
    conn.execute_batch(sql)
        .map_err(|e| format!("SQL error, nothing was changed: {e}"))
}

fn run(conn: &Connection, change: &SqlChange) -> Result<(), String> {
    match change {
        SqlChange::Statements(sql) => batch(conn, sql),
        SqlChange::EmptyEveryTable => batch(conn, &empty_every_table_sql(conn)?),
        SqlChange::Changeset(statements) => run_changeset(conn, statements).map(drop),
    }
}

type Violations = BTreeMap<(String, String), u64>;

/// Foreign-key violations per (table, parent), or `None` when SQLite cannot check them (a key
/// that names columns without a unique index, for one).
fn violations(conn: &Connection) -> Option<Violations> {
    let mut query = conn
        .prepare(r#"SELECT "table", parent, count(*) FROM pragma_foreign_key_check GROUP BY 1, 2"#)
        .ok()?;
    let rows = query
        .query_map([], |row| {
            Ok((
                (row.get::<_, String>(0)?, row.get::<_, String>(1)?),
                row.get::<_, i64>(2)?.max(0) as u64,
            ))
        })
        .ok()?;
    rows.collect::<Result<Violations, _>>().ok()
}

/// The violations the change made, leaving out those the database already had.
fn dangling(before: Option<Violations>, after: Option<Violations>) -> Vec<OpfsDanglingRows> {
    let (Some(before), Some(after)) = (before, after) else {
        return Vec::new();
    };
    after
        .into_iter()
        .filter_map(|(key, rows)| {
            let added = rows.saturating_sub(before.get(&key).copied().unwrap_or(0));
            let (table, parent) = key;
            (added > 0).then_some(OpfsDanglingRows {
                table,
                parent,
                rows: added,
            })
        })
        .collect()
}

/// Applies `change` to the file at `path` in one transaction, folds any write-ahead log into
/// it, and checks it; nothing is kept when the SQL fails.
///
/// Foreign keys are not enforced, the way a database tool empties or drops what it is told to:
/// enforced, a referenced table could not be emptied or dropped at all, and emptying every table
/// would depend on the order of the tables. The rows left pointing at removed rows are returned.
pub(crate) fn apply_sql(path: &Path, change: &SqlChange) -> Result<Vec<OpfsDanglingRows>, String> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open the copy: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys = OFF")
        .map_err(|e| format!("Failed to prepare the copy: {e}"))?;
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| format!("Failed to start the change: {e}"))?;
    let before = violations(&conn);
    if let Err(error) = run(&conn, change) {
        let _ = conn.execute_batch("ROLLBACK");
        return Err(error);
    }
    let left = dangling(before, violations(&conn));
    conn.execute_batch("COMMIT")
        .map_err(|e| format!("Failed to commit the change: {e}"))?;
    crate::commands::sqlite_opened::checkpoint(&conn)?;
    let check: String = conn
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|e| format!("Failed to check the changed copy: {e}"))?;
    if check != "ok" {
        return Err(format!(
            "The changed copy failed its check ({check}), so nothing was written to the app."
        ));
    }
    conn.close()
        .map_err(|(_, e)| format!("Failed to close the changed copy: {e}"))?;
    Ok(left)
}

async fn push<S: OpfsSink>(
    sink: &mut S,
    path: &str,
    offset: u64,
    bytes: &[u8],
) -> Result<(), String> {
    sink.begin(path).await?;
    let mut written: usize = 0;
    while written < bytes.len() {
        let end = (written + CHUNK_BYTES as usize).min(bytes.len());
        if let Err(error) = sink
            .write(offset + written as u64, &bytes[written..end])
            .await
        {
            sink.abort().await;
            return Err(error);
        }
        written = end;
    }
    if let Err(error) = sink.finish(offset + bytes.len() as u64).await {
        sink.abort().await;
        return Err(error);
    }
    Ok(())
}

async fn verify<S: OpfsSource>(
    source: &mut S,
    path: &str,
    offset: u64,
    length: u64,
) -> Result<(), String> {
    let stat = source.stat(path).await?;
    if stat.size != offset + length {
        return Err(format!(
            "The file reads {} bytes after the write, not {}",
            stat.size,
            offset + length
        ));
    }
    let head = source
        .read_chunk(path, offset, SQLITE_MAGIC.len() as u64)
        .await?;
    if !head.starts_with(SQLITE_MAGIC) {
        return Err("The file does not start like a SQLite database after the write".to_string());
    }
    Ok(())
}

/// Writes `bytes` over the database, checks it, and on any failure writes `before` back.
async fn replace<S: OpfsSink + OpfsSource>(
    session: &mut S,
    path: &str,
    offset: u64,
    bytes: &[u8],
    before: &[u8],
    backup: &str,
) -> Result<(), String> {
    let written = match push(session, path, offset, bytes).await {
        Ok(()) => verify(session, path, offset, bytes.len() as u64).await,
        Err(error) => Err(error),
    };
    let Err(error) = written else {
        return Ok(());
    };
    let restored = match push(session, path, offset, before).await {
        Ok(()) => verify(session, path, offset, before.len() as u64).await,
        Err(restore) => Err(restore),
    };
    Err(match restored {
        Ok(()) => format!(
            "Writing the change failed ({error}); the database was put back as it was. A copy is at {backup}."
        ),
        Err(restore) => format!(
            "Writing the change failed ({error}) and putting the database back failed too ({restore}). The database as it was is at {backup}."
        ),
    })
}

pub(crate) async fn rewrite<S: OpfsSink + OpfsSource + OpfsSqliteFiles>(
    session: &mut S,
    path: &str,
    backup: &Path,
    sah_pool: bool,
    change: SqlChange,
) -> Result<OpfsRewriteResult, String> {
    let companions = session.companions(path, sah_pool).await?;
    refuse_hot(path, &companions)?;
    let pulled = pull_into_file(session, &mut |_, _| true, path, backup, sah_pool).await?;
    let before_path = PathBuf::from(&pulled.path);
    let working = working_path(&before_path);
    std::fs::copy(&before_path, &working)
        .map_err(|e| format!("Failed to copy the database on this computer: {e}"))?;
    let applied = {
        let working = working.clone();
        tokio::task::spawn_blocking(move || apply_sql(&working, &change))
            .await
            .map_err(|e| e.to_string())
            .and_then(|result| result)
    };
    let outcome = match applied {
        Ok(left) => {
            let bytes = std::fs::read(&working)
                .map_err(|e| format!("Failed to read the changed copy: {e}"));
            let before = std::fs::read(&before_path)
                .map_err(|e| format!("Failed to read the copy taken before: {e}"));
            match (bytes, before) {
                (Ok(bytes), Ok(before)) => replace(
                    session,
                    path,
                    data_offset(sah_pool),
                    &bytes,
                    &before,
                    &pulled.path,
                )
                .await
                .map(|()| (bytes.len() as u64, left)),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        Err(error) => Err(error),
    };
    let _ = std::fs::remove_file(&working);
    let (size, dangling) = outcome?;
    Ok(OpfsRewriteResult {
        size,
        backup: pulled.path,
        dangling,
    })
}

const EMPTY_SLOT_HEADER: [u8; SAH_POOL_HEADER_DATA_OFFSET as usize] =
    [0; SAH_POOL_HEADER_DATA_OFFSET as usize];

pub(crate) async fn erase<S: OpfsSink + OpfsSqliteFiles>(
    session: &mut S,
    path: &str,
    sah_pool: bool,
) -> Result<OpfsEraseResult, String> {
    let companions = session.companions(path, sah_pool).await?;
    let mut order: Vec<String> = companions
        .into_iter()
        .map(|companion| companion.path)
        .collect();
    order.push(path.to_string());
    if !sah_pool {
        session.remove_files(&order).await?;
        return Ok(OpfsEraseResult { erased: order });
    }
    let mut erased = Vec::with_capacity(order.len());
    for slot in order {
        push(session, &slot, 0, &EMPTY_SLOT_HEADER)
            .await
            .map_err(|error| {
                if erased.is_empty() {
                    format!("Nothing was erased: {error}")
                } else {
                    format!(
                        "Erased {} of the database's files, then failed: {error}",
                        erased.len()
                    )
                }
            })?;
        erased.push(slot);
    }
    Ok(OpfsEraseResult { erased })
}

/// Applies `sql`, or empties every table when `empty_every_table`, to an OPFS SQLite database
/// of the paused app (see the module docs).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn opfs_rewrite_sqlite(
    app: tauri::AppHandle,
    ws_url: String,
    path: String,
    label: String,
    strip_sah_pool_header: bool,
    sql: Option<String>,
    empty_every_table: bool,
    changes: Option<Vec<SqliteChangeStatement>>,
) -> Result<OpfsRewriteResult, String> {
    validate_upstream_url(&ws_url)?;
    let change = match (empty_every_table, changes, sql) {
        (true, _, _) => SqlChange::EmptyEveryTable,
        (false, Some(changes), _) if !changes.is_empty() => SqlChange::Changeset(changes),
        (false, None, Some(sql)) if !sql.trim().is_empty() => SqlChange::Statements(sql),
        _ => return Err("No change was asked for".to_string()),
    };
    let backups = backups_dir(&app)?;
    let backup = new_copy_path(&backups, &label)?;
    let mut session = CdpSession::open(&ws_url).await?;
    let result = rewrite(&mut session, &path, &backup, strip_sah_pool_header, change).await;
    let _ = session.socket.close(None).await;
    prune_backups(&backups);
    result
}

/// Keeps a copy of an OPFS SQLite database before it is changed through the app's own
/// connection; the copy is kept like every backup (see `opfs_local_copies`).
#[tauri::command]
pub async fn opfs_backup_sqlite(
    app: tauri::AppHandle,
    ws_url: String,
    path: String,
    label: String,
    strip_sah_pool_header: bool,
) -> Result<OpfsPullResult, String> {
    validate_upstream_url(&ws_url)?;
    let backups = backups_dir(&app)?;
    let backup = new_copy_path(&backups, &label)?;
    let mut session = CdpSession::open(&ws_url).await?;
    let result = pull_into_file(
        &mut session,
        &mut |_, _| true,
        &path,
        &backup,
        strip_sah_pool_header,
    )
    .await;
    let _ = session.socket.close(None).await;
    prune_backups(&backups);
    result
}

/// Erases an OPFS SQLite database of the paused app with its journals: a plain file is
/// removed, a SAH-Pool slot is emptied the way the pool empties it (so the pool keeps its size).
#[tauri::command]
pub async fn opfs_erase_sqlite(
    ws_url: String,
    path: String,
    strip_sah_pool_header: bool,
) -> Result<OpfsEraseResult, String> {
    validate_upstream_url(&ws_url)?;
    let mut session = CdpSession::open(&ws_url).await?;
    let result = erase(&mut session, &path, strip_sah_pool_header).await;
    let _ = session.socket.close(None).await;
    result
}

#[cfg(test)]
mod tests;
