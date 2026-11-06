use crate::commands::sqlite::{is_local, sqlite_temp_dir};
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

/// The package name every file opened on this computer is read under.
pub(crate) const OPENED_FILE_PACKAGE: &str = "file";

const SQLITE_MAGIC: &[u8; 16] = b"SQLite format 3\0";

const REFUSED: &str =
    "Only a file opened on this computer can be changed here; copies from a phone or a page are read-only";

/// What the original file looked like when it was opened or last saved, to notice another
/// program changing it in between.
#[derive(Debug, Clone, PartialEq)]
struct FileStamp {
    len: u64,
    modified: Option<SystemTime>,
    /// The header's file change counter (bytes 24 to 27), raised by every write transaction.
    counter: Option<[u8; 4]>,
}

#[derive(Debug, Clone)]
struct OpenedFile {
    original: PathBuf,
    stamp: FileStamp,
}

/// Working copies of files opened on this computer, by their path, with the original each
/// one saves back to. Only a path listed here is ever written.
static OPENED: LazyLock<Mutex<HashMap<PathBuf, OpenedFile>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// A file opened on this computer: its working copy and where it came from.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedLocalFile {
    pub path: String,
    pub name: String,
    pub original: String,
    pub size: u64,
    /// A write-ahead log sat beside the original; it was copied with it.
    pub wal_beside: bool,
}

/// Where an opened file was saved, and the copy of its previous version.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedOpenedFile {
    pub path: String,
    pub backup: String,
}

fn registry() -> Result<std::sync::MutexGuard<'static, HashMap<PathBuf, OpenedFile>>, String> {
    OPENED
        .lock()
        .map_err(|_| "The list of opened files is unavailable".to_string())
}

fn stamp_of(path: &Path) -> Result<FileStamp, String> {
    use std::io::Read;
    let meta = std::fs::metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut header = [0u8; 28];
    let counter = File::open(path)
        .and_then(|mut file| file.read_exact(&mut header))
        .ok()
        .map(|()| [header[24], header[25], header[26], header[27]]);
    Ok(FileStamp {
        len: meta.len(),
        modified: meta.modified().ok(),
        counter,
    })
}

fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{suffix}", path.display()))
}

fn has_live_wal(path: &Path) -> bool {
    std::fs::metadata(sidecar(path, "-wal")).is_ok_and(|meta| meta.len() > 0)
}

fn part_next_to(path: &Path, tag: &str) -> PathBuf {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    sidecar(path, &format!(".{tag}-{}-{n}", std::process::id()))
}

fn check_header(path: &Path) -> Result<(), String> {
    use std::io::Read;
    let mut header = [0u8; 16];
    File::open(path)
        .and_then(|mut file| file.read_exact(&mut header))
        .map_err(|_| "The file is too small to be a SQLite database".to_string())?;
    if &header != SQLITE_MAGIC {
        return Err("This is not a SQLite database (its first bytes do not say so)".to_string());
    }
    Ok(())
}

/// The working copy a write command may change: an opened file listed in the registry.
/// Anything else (a phone copy, a page copy, any other path) is refused.
pub(crate) fn opened_file_path(
    serial: &str,
    package: &str,
    db_path: &str,
) -> Result<PathBuf, String> {
    if !is_local(serial) || package != OPENED_FILE_PACKAGE {
        return Err(REFUSED.to_string());
    }
    let path = PathBuf::from(db_path);
    if !registry()?.contains_key(&path) {
        return Err(REFUSED.to_string());
    }
    if !path.exists() {
        return Err("The working copy of this file is gone; open the file again".to_string());
    }
    Ok(path)
}

/// Whether `path` is the working copy of an opened file.
pub(crate) fn is_opened_file(path: &Path) -> bool {
    registry().is_ok_and(|files| files.contains_key(path))
}

/// A page copy may be refreshed only inside Capubridge's own temp folder, and never over a
/// file opened on this computer, whose working copy holds the person's changes.
pub(crate) fn page_copy_refresh_allowed(path: &Path) -> Result<(), String> {
    let inside = path
        .parent()
        .is_some_and(|parent| parent == sqlite_temp_dir().as_path());
    if !inside || is_opened_file(path) {
        return Err("Only a copy read from a page can be refreshed here".to_string());
    }
    Ok(())
}

/// Folds a write-ahead log back into the main file, so a copy of the main file holds every
/// committed change.
pub(crate) fn checkpoint(conn: &Connection) -> Result<(), String> {
    let busy: i64 = conn
        .query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |row| row.get(0))
        .map_err(|e| format!("Could not fold the write-ahead log into the file: {e}"))?;
    if busy != 0 {
        return Err("The file is busy; nothing was copied. Try again".to_string());
    }
    Ok(())
}

/// Copies `working` to `dest` through a part file in the destination's folder, flushed to
/// disk, then renamed over `dest` in one step.
fn write_atomically(working: &Path, dest: &Path) -> Result<(), String> {
    let conn = Connection::open_with_flags(
        working,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Could not open the working copy: {e}"))?;
    checkpoint(&conn)?;
    drop(conn);
    let part = part_next_to(dest, "capubridge-save");
    let result = (|| {
        std::fs::copy(working, &part)
            .map_err(|e| format!("Could not write {}: {e}", part.display()))?;
        std::fs::OpenOptions::new()
            .write(true)
            .open(&part)
            .and_then(|file| file.sync_all())
            .map_err(|e| format!("Could not flush {}: {e}", part.display()))?;
        std::fs::rename(&part, dest)
            .map_err(|e| format!("Could not replace {}: {e}", dest.display()))
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&part);
    }
    result
}

fn open_local_file(original: &Path, dir: &Path) -> Result<OpenedLocalFile, String> {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    check_header(original)?;
    let stamp = stamp_of(original)?;
    let name = original
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "database.sqlite".to_string());
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | '.') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let working = dir.join(format!("file-{now}-{n}-{safe}"));
    std::fs::copy(original, &working).map_err(|e| format!("Could not copy the file: {e}"))?;
    let wal_beside = has_live_wal(original);
    if wal_beside {
        std::fs::copy(sidecar(original, "-wal"), sidecar(&working, "-wal"))
            .map_err(|e| format!("Could not copy the write-ahead log: {e}"))?;
    }
    registry()?.insert(
        working.clone(),
        OpenedFile {
            original: original.to_path_buf(),
            stamp: stamp.clone(),
        },
    );
    Ok(OpenedLocalFile {
        path: working.to_string_lossy().to_string(),
        name,
        original: original.to_string_lossy().to_string(),
        size: stamp.len,
        wal_beside,
    })
}

fn save_to_original(working: &Path) -> Result<SavedOpenedFile, String> {
    let opened = registry()?
        .get(working)
        .cloned()
        .ok_or_else(|| REFUSED.to_string())?;
    let original = &opened.original;
    if has_live_wal(original) {
        return Err(format!(
            "{} has a write-ahead log beside it, so another program may have it open. Nothing was written; close that program, or use Save as…",
            original.display()
        ));
    }
    if original.exists() && stamp_of(original)? != opened.stamp {
        return Err(format!(
            "{} was changed by another program since it was opened here. Nothing was written; use Save as… to keep these changes in another file",
            original.display()
        ));
    }
    let backup = sidecar(original, ".bak");
    if original.exists() {
        std::fs::copy(original, &backup).map_err(|e| {
            format!(
                "Could not keep the previous version as {}: {e}",
                backup.display()
            )
        })?;
    }
    write_atomically(working, original)?;
    let stamp = stamp_of(original)?;
    if let Some(entry) = registry()?.get_mut(working) {
        entry.stamp = stamp;
    }
    Ok(SavedOpenedFile {
        path: original.to_string_lossy().to_string(),
        backup: backup.to_string_lossy().to_string(),
    })
}

fn save_copy_as(working: &Path, dest: &Path) -> Result<(), String> {
    if has_live_wal(dest) {
        return Err(format!(
            "{} has a write-ahead log beside it, so another program may have it open. Nothing was written",
            dest.display()
        ));
    }
    write_atomically(working, dest)
}

fn close_opened_file(working: &Path) -> Result<(), String> {
    if registry()?.remove(working).is_none() {
        return Err(REFUSED.to_string());
    }
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let _ = std::fs::remove_file(sidecar(working, suffix));
    }
    Ok(())
}

/// Opens a SQLite file from this computer: copies it (and a write-ahead log beside it) to a
/// working copy that the app reads and changes. The original is written only by
/// `sqlite_save_opened_file`.
#[tauri::command]
pub async fn sqlite_open_local_file(path: String) -> Result<OpenedLocalFile, String> {
    tokio::task::spawn_blocking(move || open_local_file(Path::new(&path), &sqlite_temp_dir()))
        .await
        .map_err(|e| e.to_string())?
}

/// Writes the working copy back over the file it was opened from: through a part file in the
/// same folder, flushed and renamed, keeping the previous version beside it as `.bak`.
#[tauri::command]
pub async fn sqlite_save_opened_file(
    serial: String,
    package: String,
    db_path: String,
) -> Result<SavedOpenedFile, String> {
    tokio::task::spawn_blocking(move || {
        let working = opened_file_path(&serial, &package, &db_path)?;
        save_to_original(&working)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Writes the working copy of an opened file to `dest`, picked by the person.
#[tauri::command]
pub async fn sqlite_save_opened_file_as(
    serial: String,
    package: String,
    db_path: String,
    dest: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let working = opened_file_path(&serial, &package, &db_path)?;
        let dest = PathBuf::from(dest);
        save_copy_as(&working, &dest)?;
        Ok(dest.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Forgets an opened file and removes its working copy. The original is not touched.
#[tauri::command]
pub async fn sqlite_close_opened_file(
    serial: String,
    package: String,
    db_path: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let working = opened_file_path(&serial, &package, &db_path)?;
        close_opened_file(&working)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) fn database(path: &Path, rows: &[&str]) {
        let conn = Connection::open(path).unwrap();
        conn.execute_batch("CREATE TABLE IF NOT EXISTS item (id INTEGER PRIMARY KEY, name TEXT);")
            .unwrap();
        for name in rows {
            conn.execute("INSERT INTO item (name) VALUES (?1)", [name])
                .unwrap();
        }
    }

    pub(crate) fn names(path: &Path) -> Vec<String> {
        let conn = Connection::open(path).unwrap();
        let mut stmt = conn.prepare("SELECT name FROM item ORDER BY id").unwrap();
        stmt.query_map([], |row| row.get(0))
            .unwrap()
            .map(|row| row.unwrap())
            .collect()
    }

    /// Opens `original` into a working copy under `dir` and returns the working path.
    pub(crate) fn opened(original: &Path, dir: &Path) -> PathBuf {
        PathBuf::from(open_local_file(original, dir).unwrap().path)
    }

    #[test]
    fn opening_copies_the_file_and_never_writes_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea"]);
        let before = std::fs::read(&original).unwrap();
        let working = opened(&original, &dir.path().join("work"));
        database(&working, &["cake"]);
        assert_eq!(std::fs::read(&original).unwrap(), before);
        assert!(is_opened_file(&working));
    }

    #[test]
    fn a_file_that_is_not_sqlite_is_not_opened() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notes.db");
        std::fs::write(&path, "just some text, not a database").unwrap();
        assert!(open_local_file(&path, dir.path()).is_err());
    }

    #[test]
    fn save_writes_the_original_and_keeps_the_previous_version_as_bak() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea"]);
        let working = opened(&original, &dir.path().join("work"));
        database(&working, &["cake"]);
        let saved = save_to_original(&working).unwrap();
        assert_eq!(saved.path, original.to_string_lossy());
        assert_eq!(names(&original), vec!["tea", "cake"]);
        assert_eq!(names(Path::new(&saved.backup)), vec!["tea"]);
        let leftovers = std::fs::read_dir(dir.path())
            .unwrap()
            .filter(|entry| {
                entry
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .contains("capubridge-save")
            })
            .count();
        assert_eq!(leftovers, 0);

        database(&working, &["scone"]);
        save_to_original(&working).unwrap();
        assert_eq!(names(&original), vec!["tea", "cake", "scone"]);
        assert_eq!(names(Path::new(&saved.backup)), vec!["tea", "cake"]);
    }

    #[test]
    fn save_refuses_when_another_program_changed_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea"]);
        let working = opened(&original, &dir.path().join("work"));
        database(&working, &["cake"]);
        database(&original, &["from another program"]);
        let error = save_to_original(&working).unwrap_err();
        assert!(error.contains("changed by another program"), "{error}");
        assert_eq!(names(&original), vec!["tea", "from another program"]);
    }

    #[test]
    fn save_refuses_while_a_write_ahead_log_sits_beside_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea"]);
        let working = opened(&original, &dir.path().join("work"));
        std::fs::write(sidecar(&original, "-wal"), b"log").unwrap();
        let error = save_to_original(&working).unwrap_err();
        assert!(error.contains("write-ahead log"), "{error}");
    }

    #[test]
    fn rows_left_in_a_write_ahead_log_are_opened_and_saved() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea"]);
        let writer = Connection::open(&original).unwrap();
        writer
            .execute_batch(
                "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; \
                 INSERT INTO item (name) VALUES ('in the log');",
            )
            .unwrap();
        let file = open_local_file(&original, &dir.path().join("work")).unwrap();
        drop(writer);
        assert!(file.wal_beside);
        let working = PathBuf::from(&file.path);
        assert_eq!(names(&working), vec!["tea", "in the log"]);

        let dest = dir.path().join("copy.db");
        database(&working, &["cake"]);
        save_copy_as(&working, &dest).unwrap();
        assert_eq!(names(&dest), vec!["tea", "in the log", "cake"]);
    }

    #[test]
    fn save_as_writes_the_chosen_file_and_leaves_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea"]);
        let working = opened(&original, &dir.path().join("work"));
        database(&working, &["cake"]);
        let dest = dir.path().join("elsewhere.db");
        save_copy_as(&working, &dest).unwrap();
        assert_eq!(names(&dest), vec!["tea", "cake"]);
        assert_eq!(names(&original), vec!["tea"]);
    }

    #[tokio::test]
    async fn a_phone_copy_or_a_page_copy_cannot_be_saved_or_closed() {
        let dir = tempfile::tempdir().unwrap();
        let page_copy = dir.path().join("opfs-page.db");
        database(&page_copy, &["tea"]);
        let page = page_copy.to_string_lossy().to_string();
        for (serial, package, path) in [
            (
                "R5CT",
                "com.shop",
                "/data/data/com.shop/databases/shop.db".to_string(),
            ),
            ("__local__", "com.shop", page.clone()),
            ("__local__", "file", page.clone()),
        ] {
            let saved = sqlite_save_opened_file(serial.into(), package.into(), path.clone()).await;
            assert!(saved.unwrap_err().contains("Only a file opened"));
            let copied = sqlite_save_opened_file_as(
                serial.into(),
                package.into(),
                path.clone(),
                dir.path().join("x.db").to_string_lossy().to_string(),
            )
            .await;
            assert!(copied.unwrap_err().contains("Only a file opened"));
            let closed = sqlite_close_opened_file(serial.into(), package.into(), path).await;
            assert!(closed.unwrap_err().contains("Only a file opened"));
        }
        assert_eq!(names(&page_copy), vec!["tea"]);
    }

    #[tokio::test]
    async fn every_write_command_refuses_a_phone_copy_and_a_page_copy() {
        use crate::commands::sqlite::sqlite_execute_write;
        use crate::commands::sqlite_changeset::{sqlite_apply_changeset, SqliteChangeStatement};
        use crate::commands::sqlite_dump::sqlite_import_dump;

        let dir = tempfile::tempdir().unwrap();
        let page_copy = dir.path().join("opfs-page.db");
        database(&page_copy, &["tea"]);
        let page = page_copy.to_string_lossy().to_string();
        for (serial, package, path) in [
            (
                "R5CT",
                "com.shop",
                "/data/data/com.shop/databases/shop.db".to_string(),
            ),
            ("__local__", "com.shop", page.clone()),
            ("__local__", "file", page.clone()),
        ] {
            let write = sqlite_execute_write(
                serial.into(),
                package.into(),
                path.clone(),
                "DELETE FROM item".into(),
            )
            .await;
            assert!(
                write.unwrap_err().contains("Only a file opened"),
                "write {serial} {package}"
            );
            let dump = sqlite_import_dump(
                serial.into(),
                package.into(),
                path.clone(),
                "CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT);".into(),
            )
            .await;
            assert!(
                dump.unwrap_err().contains("Only a file opened"),
                "dump {serial} {package}"
            );
            let changes = sqlite_apply_changeset(
                serial.into(),
                package.into(),
                path,
                vec![SqliteChangeStatement {
                    sql: "UPDATE item SET name = 'x' WHERE id = 1".into(),
                }],
            )
            .await;
            assert!(
                changes.unwrap_err().contains("Only a file opened"),
                "changeset {serial} {package}"
            );
        }
        assert_eq!(names(&page_copy), vec!["tea"]);
    }

    #[tokio::test]
    async fn every_write_command_changes_an_opened_file() {
        use crate::commands::sqlite::sqlite_execute_write;
        use crate::commands::sqlite_changeset::{sqlite_apply_changeset, SqliteChangeStatement};

        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea", "cake"]);
        let working = opened(&original, &dir.path().join("work"));
        let path = working.to_string_lossy().to_string();
        sqlite_apply_changeset(
            "__local__".into(),
            "file".into(),
            path.clone(),
            vec![SqliteChangeStatement {
                sql: "UPDATE item SET name = 'scone' WHERE id IS 2".into(),
            }],
        )
        .await
        .unwrap();
        assert_eq!(names(&working), vec!["tea", "scone"]);
        sqlite_execute_write(
            "__local__".into(),
            "file".into(),
            path,
            "DELETE FROM item".into(),
        )
        .await
        .unwrap();
        assert!(names(&working).is_empty());
        assert_eq!(names(&original), vec!["tea", "cake"]);
    }

    #[test]
    fn closing_removes_the_working_copy_only() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("shop.db");
        database(&original, &["tea"]);
        let working = opened(&original, &dir.path().join("work"));
        close_opened_file(&working).unwrap();
        assert!(!working.exists());
        assert!(!is_opened_file(&working));
        assert_eq!(names(&original), vec!["tea"]);
    }
}
