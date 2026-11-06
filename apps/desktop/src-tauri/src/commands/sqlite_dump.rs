use crate::commands::sqlite::{hex_of, obtain_local_path, open_db, quote_ident};
use crate::commands::sqlite_opened::opened_file_path;
use rusqlite::limits::Limit;
use rusqlite::types::ValueRef;
use rusqlite::{Connection, OpenFlags};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// A value as an SQL literal that reads back exactly: integers in full, reals with their
/// fraction kept, text quoted, BLOBs as `X'…'` with every byte.
fn sql_literal(value: ValueRef<'_>) -> String {
    match value {
        ValueRef::Null => "NULL".to_string(),
        ValueRef::Integer(i) => i.to_string(),
        ValueRef::Real(f) if f.is_nan() => "NULL".to_string(),
        ValueRef::Real(f) if f.is_infinite() => {
            if f > 0.0 { "9e999" } else { "-9e999" }.to_string()
        }
        ValueRef::Real(f) => format!("{f:?}"),
        ValueRef::Text(t) => format!("'{}'", String::from_utf8_lossy(t).replace('\'', "''")),
        ValueRef::Blob(b) => format!("X'{}'", hex_of(b)),
    }
}

struct SchemaEntry {
    kind: String,
    name: String,
    sql: String,
}

fn schema(conn: &Connection) -> Result<Vec<SchemaEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT type, name, sql FROM sqlite_master \
             WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SchemaEntry {
                kind: row.get(0)?,
                name: row.get(1)?,
                sql: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn has_table(conn: &Connection, name: &str) -> bool {
    conn.query_row(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
        [name],
        |_| Ok(()),
    )
    .is_ok()
}

/// Writes every row of `table` as INSERT statements, reading the table once in order
/// (no OFFSET paging, so a large table costs one pass). Returns the number of rows.
fn write_rows(conn: &Connection, table: &str, out: &mut impl Write) -> Result<u64, String> {
    let ident = quote_ident(table);
    let mut stmt = conn
        .prepare(&format!("SELECT * FROM {ident}"))
        .map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt.column_names().iter().map(|c| quote_ident(c)).collect();
    let head = format!("INSERT INTO {ident} ({}) VALUES (", columns.join(","));
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut count = 0u64;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut line = head.clone();
        for index in 0..columns.len() {
            if index > 0 {
                line.push(',');
            }
            line.push_str(&sql_literal(row.get_ref(index).map_err(|e| e.to_string())?));
        }
        line.push_str(");\n");
        out.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

/// The whole database as SQL: tables, their rows, the AUTOINCREMENT counters, then indexes,
/// views and triggers (after the rows, so a trigger never fires on the replay).
pub(crate) fn write_dump(conn: &Connection, out: &mut impl Write) -> Result<u64, String> {
    let entries = schema(conn)?;
    let mut rows = 0u64;
    let w =
        |out: &mut dyn Write, text: &str| out.write_all(text.as_bytes()).map_err(|e| e.to_string());
    w(out, "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n")?;
    for entry in entries.iter().filter(|e| e.kind == "table") {
        w(out, &format!("{};\n", entry.sql))?;
        if !entry
            .sql
            .trim_start()
            .to_ascii_uppercase()
            .starts_with("CREATE VIRTUAL")
        {
            rows += write_rows(conn, &entry.name, out)?;
        }
    }
    if has_table(conn, "sqlite_sequence") {
        w(out, "DELETE FROM sqlite_sequence;\n")?;
        write_rows(conn, "sqlite_sequence", out)?;
    }
    for kind in ["index", "view", "trigger"] {
        for entry in entries.iter().filter(|e| e.kind == kind) {
            w(out, &format!("{};\n", entry.sql))?;
        }
    }
    w(out, "COMMIT;\nPRAGMA foreign_keys=ON;\n")?;
    Ok(rows)
}

fn part_path(path: &Path, tag: &str) -> PathBuf {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    PathBuf::from(format!(
        "{}.{tag}-{}-{n}",
        path.display(),
        std::process::id()
    ))
}

/// Writes the dump of `source` to `dest` through a part file renamed only when complete,
/// so a failure never leaves a truncated dump in place of the person's file.
pub(crate) fn export_dump(source: &Path, dest: &Path) -> Result<u64, String> {
    let conn = open_db(&source.to_path_buf())?;
    let part = part_path(dest, "capubridge-part");
    let result = (|| {
        let file = File::create(&part).map_err(|e| format!("Could not write the file: {e}"))?;
        let mut out = BufWriter::new(file);
        let rows = write_dump(&conn, &mut out)?;
        let file = out.into_inner().map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        Ok(rows)
    })();
    match result {
        Ok(rows) => {
            std::fs::rename(&part, dest).map_err(|e| format!("Could not save the file: {e}"))?;
            Ok(rows)
        }
        Err(error) => {
            let _ = std::fs::remove_file(&part);
            Err(error)
        }
    }
}

fn drop_everything(conn: &Connection) -> Result<(), String> {
    let entries = schema(conn)?;
    let mut statements = String::from("PRAGMA foreign_keys=OFF;\n");
    for kind in ["trigger", "view", "table"] {
        for entry in entries.iter().filter(|e| e.kind == kind) {
            statements.push_str(&format!(
                "DROP {} IF EXISTS {};\n",
                kind.to_ascii_uppercase(),
                quote_ident(&entry.name)
            ));
        }
    }
    conn.execute_batch(&statements).map_err(|e| e.to_string())
}

/// Replaces a database file with the result of replaying `dump` on an empty schema. The work
/// happens on a copy: the original is swapped for it only once the whole dump ran and the
/// copy passes `quick_check`, so a dump that fails half way changes nothing.
pub(crate) fn replace_with_dump(target: &Path, dump: &str) -> Result<(), String> {
    let scratch = part_path(target, "capubridge-import");
    let result = (|| {
        let source = open_db(&target.to_path_buf())?;
        source
            .execute("VACUUM INTO ?1", [scratch.to_string_lossy().to_string()])
            .map_err(|e| format!("Could not copy the database: {e}"))?;
        drop(source);
        let conn = Connection::open_with_flags(
            &scratch,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|e| e.to_string())?;
        conn.set_limit(Limit::SQLITE_LIMIT_ATTACHED, 0)
            .map_err(|e| e.to_string())?;
        drop_everything(&conn)?;
        conn.execute_batch(dump)
            .map_err(|e| format!("The dump did not run: {e}"))?;
        if !conn.is_autocommit() {
            return Err("The dump left a transaction open".to_string());
        }
        let check: String = conn
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        if check != "ok" {
            return Err(format!("The result is damaged: {check}"));
        }
        conn.close().map_err(|(_, e)| e.to_string())?;
        Ok(())
    })();
    match result {
        Ok(()) => {
            for suffix in ["-wal", "-shm"] {
                let _ = std::fs::remove_file(format!("{}{suffix}", target.display()));
            }
            std::fs::rename(&scratch, target)
                .map_err(|e| format!("Could not replace the file: {e}"))
        }
        Err(error) => {
            let _ = std::fs::remove_file(&scratch);
            Err(error)
        }
    }
}

/// Saves the open database as an SQL dump at `dest`, with every value exact. Returns the
/// number of rows written.
#[tauri::command]
pub async fn sqlite_export_dump(
    serial: String,
    package: String,
    db_path: String,
    dest: String,
) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        let source = obtain_local_path(&serial, &package, &db_path, false)?;
        export_dump(&source, Path::new(&dest))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Replays an SQL dump over the working copy of a file opened on this computer, all or
/// nothing. Phone and page copies are refused: they are read-only here.
#[tauri::command]
pub async fn sqlite_import_dump(
    serial: String,
    package: String,
    db_path: String,
    sql: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let target = opened_file_path(&serial, &package, &db_path)?;
        replace_with_dump(&target, &sql)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(dir: &Path) -> PathBuf {
        let path = dir.join("shop.db");
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE item (id INTEGER PRIMARY KEY AUTOINCREMENT, big INTEGER, price REAL, \
               name TEXT, picture BLOB);
             INSERT INTO item (big, price, name, picture) VALUES \
               (9007199254740993, 1.0, 'it''s', X'00FF10'), (-5, 2.5, NULL, NULL);
             CREATE INDEX item_name ON item(name);
             CREATE VIEW cheap AS SELECT * FROM item WHERE price < 2;
             CREATE TRIGGER stamp AFTER INSERT ON item BEGIN SELECT 1; END;",
        )
        .unwrap();
        path
    }

    fn rows(path: &Path) -> Vec<(i64, Option<f64>, Option<String>, Option<Vec<u8>>)> {
        let conn = Connection::open(path).unwrap();
        let mut stmt = conn
            .prepare("SELECT big, price, name, picture FROM item ORDER BY id")
            .unwrap();
        stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .unwrap()
        .map(|row| row.unwrap())
        .collect()
    }

    #[test]
    fn a_dump_reads_back_every_value_exactly() {
        let dir = tempfile::tempdir().unwrap();
        let source = fixture(dir.path());
        let dump_path = dir.path().join("shop.sql");
        assert_eq!(export_dump(&source, &dump_path).unwrap(), 2);
        let dump = std::fs::read_to_string(&dump_path).unwrap();
        assert!(dump.contains("X'00ff10'"));
        assert!(dump.contains("9007199254740993"));
        assert!(dump.contains("1.0"));

        let copy = dir.path().join("copy.db");
        Connection::open(&copy)
            .unwrap()
            .execute_batch(&dump)
            .unwrap();
        assert_eq!(rows(&copy), rows(&source));
    }

    #[test]
    fn a_failing_dump_leaves_the_database_as_it_was() {
        let dir = tempfile::tempdir().unwrap();
        let path = fixture(dir.path());
        let before = rows(&path);
        let error = replace_with_dump(&path, "CREATE TABLE a (x); INSERT INTO missing VALUES (1);")
            .unwrap_err();
        assert!(error.contains("did not run"));
        assert_eq!(rows(&path), before);
        let conn = Connection::open(&path).unwrap();
        let views: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'view'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(views, 1);
        let leftovers = std::fs::read_dir(dir.path())
            .unwrap()
            .filter(|entry| {
                entry
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .contains("capubridge-import")
            })
            .count();
        assert_eq!(leftovers, 0);
    }

    #[test]
    fn a_dump_with_views_and_triggers_replaces_the_database() {
        let dir = tempfile::tempdir().unwrap();
        let path = fixture(dir.path());
        let dump_path = dir.path().join("shop.sql");
        export_dump(&path, &dump_path).unwrap();
        let dump = std::fs::read_to_string(&dump_path).unwrap();
        Connection::open(&path)
            .unwrap()
            .execute("DELETE FROM item", [])
            .unwrap();
        replace_with_dump(&path, &dump).unwrap();
        assert_eq!(rows(&path).len(), 2);
    }

    #[test]
    fn a_dump_cannot_write_outside_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = fixture(dir.path());
        let before = rows(&path);
        let outside = dir.path().join("outside.db");
        let outside_sql = outside.to_string_lossy().replace('\'', "''");
        for dump in [
            format!("ATTACH '{outside_sql}' AS other; CREATE TABLE other.t (x);"),
            format!("VACUUM INTO '{outside_sql}';"),
        ] {
            assert!(replace_with_dump(&path, &dump).is_err(), "{dump}");
            assert!(!outside.exists(), "{dump} created a file");
        }
        assert_eq!(rows(&path), before);
    }

    #[test]
    fn a_failed_export_keeps_the_file_it_would_replace() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("keep.sql");
        std::fs::write(&dest, "old").unwrap();
        assert!(export_dump(&dir.path().join("missing.db"), &dest).is_err());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "old");
    }
}
