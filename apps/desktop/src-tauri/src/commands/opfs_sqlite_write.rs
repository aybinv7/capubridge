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
mod tests {
    use super::*;
    use crate::commands::opfs_pull::OpfsFileStat;
    use std::collections::HashMap;

    #[derive(Default)]
    struct FakePage {
        files: HashMap<String, Vec<u8>>,
        companions: Vec<Companion>,
        pending: Option<(String, Vec<u8>)>,
        fail_writes_after: Option<usize>,
        writes: usize,
        removed: Vec<String>,
    }

    impl OpfsSource for FakePage {
        async fn stat(&mut self, path: &str) -> Result<OpfsFileStat, String> {
            let bytes = self.files.get(path).ok_or("not found")?;
            Ok(OpfsFileStat {
                size: bytes.len() as u64,
                last_modified: 1.0,
            })
        }

        async fn read_chunk(
            &mut self,
            path: &str,
            offset: u64,
            length: u64,
        ) -> Result<Vec<u8>, String> {
            let bytes = self.files.get(path).ok_or("not found")?;
            let start = (offset as usize).min(bytes.len());
            let end = ((offset + length) as usize).min(bytes.len());
            Ok(bytes[start..end].to_vec())
        }
    }

    impl OpfsSink for FakePage {
        async fn begin(&mut self, path: &str) -> Result<(), String> {
            let bytes = self.files.get(path).cloned().ok_or("not found")?;
            self.pending = Some((path.to_string(), bytes));
            Ok(())
        }

        async fn write(&mut self, at: u64, bytes: &[u8]) -> Result<(), String> {
            self.writes += 1;
            if self
                .fail_writes_after
                .is_some_and(|limit| self.writes > limit)
            {
                return Err("the page went away".to_string());
            }
            let (_, file) = self.pending.as_mut().ok_or("not begun")?;
            let end = at as usize + bytes.len();
            if file.len() < end {
                file.resize(end, 0);
            }
            file[at as usize..end].copy_from_slice(bytes);
            Ok(())
        }

        async fn finish(&mut self, size: u64) -> Result<(), String> {
            let (path, mut file) = self.pending.take().ok_or("not begun")?;
            file.resize(size as usize, 0);
            self.files.insert(path, file);
            Ok(())
        }

        async fn abort(&mut self) {
            self.pending = None;
        }
    }

    impl OpfsSqliteFiles for FakePage {
        async fn companions(
            &mut self,
            _path: &str,
            _sah_pool: bool,
        ) -> Result<Vec<Companion>, String> {
            Ok(self.companions.clone())
        }

        async fn remove_files(&mut self, paths: &[String]) -> Result<(), String> {
            for path in paths {
                self.files.remove(path);
                self.removed.push(path.clone());
            }
            Ok(())
        }
    }

    fn database(rows: usize) -> Vec<u8> {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("seed.db");
        let conn = Connection::open(&path).expect("open");
        conn.execute_batch("CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT); CREATE TABLE tags (name TEXT);")
            .expect("schema");
        for index in 0..rows {
            conn.execute(
                "INSERT INTO notes (body) VALUES (?1)",
                [format!("note {index}")],
            )
            .expect("insert");
        }
        drop(conn);
        std::fs::read(&path).expect("read")
    }

    fn slot(bytes: &[u8]) -> Vec<u8> {
        let mut out = vec![0u8; SAH_POOL_HEADER_DATA_OFFSET as usize];
        out[..9].copy_from_slice(b"/notes.db");
        out.extend_from_slice(bytes);
        out
    }

    fn rows_in(bytes: &[u8], offset: usize) -> i64 {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("check.db");
        std::fs::write(&path, &bytes[offset..]).expect("write");
        let conn = Connection::open(&path).expect("open");
        conn.query_row("SELECT count(*) FROM notes", [], |row| row.get(0))
            .expect("count")
    }

    #[tokio::test]
    async fn a_rewrite_keeps_the_slot_header_and_applies_the_sql() {
        let mut page = FakePage::default();
        let original = slot(&database(50));
        page.files.insert("p/slot".into(), original.clone());
        let scratch = tempfile::tempdir().expect("temp dir");
        let result = rewrite(
            &mut page,
            "p/slot",
            &scratch.path().join("backup.db"),
            true,
            SqlChange::Statements("DELETE FROM notes".into()),
        )
        .await
        .expect("rewrites");
        let now = &page.files["p/slot"];
        assert_eq!(&now[..4096], &original[..4096]);
        assert_eq!(rows_in(now, 4096), 0);
        assert_eq!(result.size as usize, now.len() - 4096);
        assert_eq!(
            std::fs::read(&result.backup).expect("backup"),
            original[4096..]
        );
    }

    #[tokio::test]
    async fn emptying_every_table_reads_the_tables_from_the_fresh_copy() {
        let mut page = FakePage::default();
        page.files.insert("app.db".into(), database(20));
        let scratch = tempfile::tempdir().expect("temp dir");
        rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::EmptyEveryTable,
        )
        .await
        .expect("rewrites");
        assert_eq!(rows_in(&page.files["app.db"], 0), 0);
    }

    fn linked() -> Vec<u8> {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("linked.db");
        let conn = Connection::open(&path).expect("open");
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE product (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE pack_item (id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES product(id));
             CREATE TABLE stale (id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES product(id));
             INSERT INTO product (id, name) VALUES (1, 'a'), (2, 'b');
             INSERT INTO pack_item (product_id) VALUES (1), (2), (2);
             PRAGMA foreign_keys = OFF;
             INSERT INTO stale (product_id) VALUES (99);",
        )
        .expect("schema");
        drop(conn);
        std::fs::read(&path).expect("read")
    }

    fn count(bytes: &[u8], table: &str) -> i64 {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("count.db");
        std::fs::write(&path, bytes).expect("write");
        let conn = Connection::open(&path).expect("open");
        conn.query_row(&format!("SELECT count(*) FROM {table}"), [], |row| {
            row.get(0)
        })
        .expect("count")
    }

    #[tokio::test]
    async fn a_referenced_table_is_emptied_and_the_rows_left_pointing_at_it_are_named() {
        let mut page = FakePage::default();
        page.files.insert("app.db".into(), linked());
        let scratch = tempfile::tempdir().expect("temp dir");
        let result = rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::Statements("DELETE FROM \"product\";".into()),
        )
        .await
        .expect("rewrites");
        assert_eq!(count(&page.files["app.db"], "product"), 0);
        assert_eq!(count(&page.files["app.db"], "pack_item"), 3);
        assert_eq!(
            result.dangling,
            vec![OpfsDanglingRows {
                table: "pack_item".into(),
                parent: "product".into(),
                rows: 3,
            }]
        );
    }

    #[tokio::test]
    async fn a_referenced_table_can_be_dropped() {
        let mut page = FakePage::default();
        page.files.insert("app.db".into(), linked());
        let scratch = tempfile::tempdir().expect("temp dir");
        rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::Statements("DROP TABLE \"product\";".into()),
        )
        .await
        .expect("rewrites");
        assert_eq!(count(&page.files["app.db"], "pack_item"), 3);
    }

    #[tokio::test]
    async fn emptying_every_table_ignores_the_order_of_linked_tables() {
        let mut page = FakePage::default();
        page.files.insert("app.db".into(), linked());
        let scratch = tempfile::tempdir().expect("temp dir");
        let result = rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::EmptyEveryTable,
        )
        .await
        .expect("rewrites");
        assert_eq!(count(&page.files["app.db"], "pack_item"), 0);
        assert!(result.dangling.is_empty());
    }

    fn change(sql: &str) -> SqliteChangeStatement {
        SqliteChangeStatement { sql: sql.into() }
    }

    #[tokio::test]
    async fn staged_edits_are_applied_together() {
        let mut page = FakePage::default();
        page.files.insert("app.db".into(), linked());
        let scratch = tempfile::tempdir().expect("temp dir");
        rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::Changeset(vec![
                change("DELETE FROM \"pack_item\" WHERE \"id\" IS 1"),
                change("UPDATE \"product\" SET \"name\" = 'z' WHERE \"id\" IS 2"),
                change("INSERT INTO \"product\" (\"name\") VALUES ('c')"),
            ]),
        )
        .await
        .expect("rewrites");
        let now = &page.files["app.db"];
        assert_eq!(count(now, "pack_item"), 2);
        assert_eq!(count(now, "product"), 3);
    }

    #[tokio::test]
    async fn an_edit_of_a_row_that_is_gone_changes_nothing_on_the_page() {
        let mut page = FakePage::default();
        let original = linked();
        page.files.insert("app.db".into(), original.clone());
        let scratch = tempfile::tempdir().expect("temp dir");
        let error = rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::Changeset(vec![
                change("DELETE FROM \"pack_item\" WHERE \"id\" IS 1"),
                change("UPDATE \"product\" SET \"name\" = 'z' WHERE \"id\" IS 42"),
            ]),
        )
        .await
        .expect_err("refused");
        assert!(error.contains("instead of one"));
        assert_eq!(page.files["app.db"], original);
        assert_eq!(page.writes, 0);
    }

    #[tokio::test]
    async fn bad_sql_changes_nothing_on_the_page() {
        let mut page = FakePage::default();
        let original = database(5);
        page.files.insert("app.db".into(), original.clone());
        let scratch = tempfile::tempdir().expect("temp dir");
        let error = rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::Statements("DELETE FROM missing".into()),
        )
        .await
        .expect_err("refused");
        assert!(error.contains("nothing was changed"));
        assert_eq!(page.files["app.db"], original);
        assert_eq!(page.writes, 0);
    }

    #[tokio::test]
    async fn a_hot_journal_is_refused_before_anything_is_read() {
        let mut page = FakePage::default();
        page.files.insert("app.db".into(), database(1));
        page.companions = vec![Companion {
            path: "app.db-journal".into(),
            role: CompanionRole::Journal,
            hot: true,
        }];
        let scratch = tempfile::tempdir().expect("temp dir");
        let error = rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::Statements("DELETE FROM notes".into()),
        )
        .await
        .expect_err("refused");
        assert!(error.contains("rollback journal"));
    }

    #[tokio::test]
    async fn a_failed_write_puts_the_database_back() {
        let mut page = FakePage::default();
        let original = database(3000);
        page.files.insert("app.db".into(), original.clone());
        page.fail_writes_after = Some(0);
        let scratch = tempfile::tempdir().expect("temp dir");
        let error = rewrite(
            &mut page,
            "app.db",
            &scratch.path().join("backup.db"),
            false,
            SqlChange::Statements("DELETE FROM notes".into()),
        )
        .await
        .expect_err("fails");
        assert!(error.contains("putting the database back failed") || error.contains("put back"));
        assert_eq!(page.files["app.db"], original);
    }

    #[tokio::test]
    async fn erasing_a_slot_empties_it_and_its_journal_slots_first() {
        let mut page = FakePage::default();
        page.files.insert("p/a".into(), slot(&database(2)));
        page.files.insert("p/j".into(), slot(b"journal bytes"));
        page.companions = vec![Companion {
            path: "p/j".into(),
            role: CompanionRole::Journal,
            hot: false,
        }];
        let result = erase(&mut page, "p/a", true).await.expect("erases");
        assert_eq!(result.erased, vec!["p/j".to_string(), "p/a".to_string()]);
        assert_eq!(page.files["p/a"], vec![0u8; 4096]);
        assert_eq!(page.files["p/j"], vec![0u8; 4096]);
    }

    #[tokio::test]
    async fn erasing_a_plain_file_removes_it_with_its_journals() {
        let mut page = FakePage::default();
        page.files.insert("app.db".into(), database(1));
        page.companions = vec![Companion {
            path: "app.db-wal".into(),
            role: CompanionRole::Wal,
            hot: false,
        }];
        let result = erase(&mut page, "app.db", false).await.expect("erases");
        assert_eq!(
            page.removed,
            vec!["app.db-wal".to_string(), "app.db".to_string()]
        );
        assert_eq!(result.erased.len(), 2);
    }
}
