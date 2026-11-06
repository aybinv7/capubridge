use crate::commands::sqlite::{obtain_local_path, open_db};
use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

/// A foreign-key column of a table and whether an index starts with it.
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SqliteForeignKeyFact {
    pub column: String,
    pub target_table: String,
    pub indexed: bool,
}

/// What the overview needs of one table or view, read in the same pass as the rest.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteTableFacts {
    pub name: String,
    pub kind: String,
    pub without_rowid: bool,
    pub columns: Vec<String>,
    pub has_primary_key: bool,
    pub index_count: usize,
    /// Bytes on disk of the table and its indexes (`dbstat`); `None` when it cannot be read.
    pub bytes: Option<i64>,
    pub foreign_keys: Vec<SqliteForeignKeyFact>,
}

/// The database at a glance: the file, how SQLite keeps it, and every table's facts.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqliteDatabaseFacts {
    pub file_bytes: u64,
    /// Size of a write-ahead log beside the copy, when there is one.
    pub wal_bytes: Option<u64>,
    pub page_size: i64,
    pub page_count: i64,
    pub freelist_count: i64,
    pub journal_mode: String,
    pub user_version: i64,
    pub encoding: String,
    /// `dbstat` answered, so `bytes` per table is known.
    pub sizes_known: bool,
    pub tables: Vec<SqliteTableFacts>,
}

fn pragma_i64(conn: &Connection, name: &str) -> Result<i64, String> {
    conn.query_row(&format!("PRAGMA {name}"), [], |row| row.get(0))
        .map_err(|e| format!("Failed to read {name}: {e}"))
}

fn pragma_text(conn: &Connection, name: &str) -> Result<String, String> {
    conn.query_row(&format!("PRAGMA {name}"), [], |row| row.get(0))
        .map_err(|e| format!("Failed to read {name}: {e}"))
}

/// Bytes per table and index name, from `dbstat`; `None` when it is not compiled in or refuses.
fn dbstat_sizes(conn: &Connection) -> Option<HashMap<String, i64>> {
    let mut stmt = conn
        .prepare("SELECT name, SUM(pgsize) FROM dbstat GROUP BY name")
        .ok()?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .ok()?;
    rows.collect::<Result<HashMap<_, _>, _>>().ok()
}

fn strings(conn: &Connection, sql: &str, arg: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("Failed to read the schema: {e}"))?;
    let values = stmt
        .query_map([arg], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to read the schema: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read the schema: {e}"));
    values
}

fn table_facts(
    conn: &Connection,
    name: &str,
    kind: &str,
    without_rowid: bool,
    sizes: Option<&HashMap<String, i64>>,
) -> Result<SqliteTableFacts, String> {
    let columns = strings(
        conn,
        "SELECT name FROM pragma_table_info(?1) ORDER BY cid",
        name,
    )?;
    let has_primary_key = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE pk > 0",
            [name],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| format!("Failed to read the key of {name}: {e}"))?
        > 0;
    let index_names = strings(conn, "SELECT name FROM pragma_index_list(?1)", name)?;
    let mut leading = Vec::with_capacity(index_names.len());
    for index in &index_names {
        let first = conn
            .query_row(
                "SELECT name FROM pragma_index_info(?1) ORDER BY seqno LIMIT 1",
                [index],
                |row| row.get::<_, Option<String>>(0),
            )
            .ok()
            .flatten();
        if let Some(column) = first {
            leading.push(column);
        }
    }
    let first_key = conn
        .query_row(
            "SELECT name FROM pragma_table_info(?1) WHERE pk = 1",
            [name],
            |row| row.get::<_, String>(0),
        )
        .ok();
    let mut stmt = conn
        .prepare(
            "SELECT \"from\", \"table\" FROM pragma_foreign_key_list(?1) ORDER BY id DESC, seq",
        )
        .map_err(|e| format!("Failed to read the links of {name}: {e}"))?;
    let foreign_keys = stmt
        .query_map([name], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to read the links of {name}: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read the links of {name}: {e}"))?
        .into_iter()
        .map(|(column, target_table)| SqliteForeignKeyFact {
            indexed: leading.contains(&column) || first_key.as_deref() == Some(column.as_str()),
            column,
            target_table,
        })
        .collect();
    let bytes = sizes.map(|sizes| {
        let own = sizes.get(name).copied().unwrap_or(0);
        own + index_names
            .iter()
            .map(|index| sizes.get(index).copied().unwrap_or(0))
            .sum::<i64>()
    });
    Ok(SqliteTableFacts {
        name: name.to_string(),
        kind: kind.to_string(),
        without_rowid,
        columns,
        has_primary_key,
        index_count: index_names.len(),
        bytes: if kind == "view" { None } else { bytes },
        foreign_keys,
    })
}

/// Every fact of the overview from one read-only connection.
pub(crate) fn read_facts(path: &Path) -> Result<SqliteDatabaseFacts, String> {
    let conn = open_db(&path.to_path_buf())?;
    let sizes = dbstat_sizes(&conn);
    let mut stmt = conn
        .prepare(
            "SELECT m.name, m.type, COALESCE(l.wr, 0) FROM sqlite_master AS m \
             LEFT JOIN pragma_table_list AS l ON l.name = m.name AND l.schema = 'main' \
             WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite_%' ORDER BY m.name",
        )
        .map_err(|e| format!("Failed to read the schema: {e}"))?;
    let listed = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to read the schema: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read the schema: {e}"))?;
    let tables = listed
        .iter()
        .map(|(name, kind, wr)| table_facts(&conn, name, kind, *wr != 0, sizes.as_ref()))
        .collect::<Result<Vec<_>, _>>()?;
    let wal = path.with_file_name(format!(
        "{}-wal",
        path.file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default()
    ));
    Ok(SqliteDatabaseFacts {
        file_bytes: std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0),
        wal_bytes: std::fs::metadata(&wal).ok().map(|meta| meta.len()),
        page_size: pragma_i64(&conn, "page_size")?,
        page_count: pragma_i64(&conn, "page_count")?,
        freelist_count: pragma_i64(&conn, "freelist_count")?,
        journal_mode: pragma_text(&conn, "journal_mode")?,
        user_version: pragma_i64(&conn, "user_version")?,
        encoding: pragma_text(&conn, "encoding")?,
        sizes_known: sizes.is_some(),
        tables,
    })
}

/// The overview's facts of a database, read from the same copy its rows come from.
#[tauri::command]
pub async fn sqlite_database_facts(
    serial: String,
    package: String,
    db_path: String,
) -> Result<SqliteDatabaseFacts, String> {
    tokio::task::spawn_blocking(move || {
        let local = obtain_local_path(&serial, &package, &db_path, false)?;
        read_facts(&local)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(dir: &Path) -> std::path::PathBuf {
        let path = dir.join("facts.db");
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "PRAGMA foreign_keys = OFF; PRAGMA user_version = 37; \
             CREATE TABLE partner (id INTEGER PRIMARY KEY, name TEXT); \
             CREATE TABLE sale (id INTEGER PRIMARY KEY, partner_id INTEGER REFERENCES partner(id), \
               note TEXT, user_id INTEGER REFERENCES partner(id)); \
             CREATE INDEX sale_partner ON sale(partner_id); \
             CREATE TABLE log (line TEXT); \
             CREATE TABLE pair (a, b, PRIMARY KEY (a, b)) WITHOUT ROWID; \
             CREATE VIEW recent AS SELECT * FROM sale; \
             WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 2000) \
             INSERT INTO sale SELECT x, x % 10, hex(randomblob(64)), x % 3 FROM c;",
        )
        .unwrap();
        path
    }

    #[test]
    fn facts_describe_the_file_the_tables_and_their_links() {
        let dir = tempfile::tempdir().unwrap();
        let path = fixture(dir.path());
        let facts = read_facts(&path).unwrap();
        assert_eq!(facts.user_version, 37);
        assert_eq!(facts.encoding, "UTF-8");
        assert!(facts.sizes_known);
        assert_eq!(facts.file_bytes as i64, facts.page_size * facts.page_count);
        let by_name: HashMap<_, _> = facts.tables.iter().map(|t| (t.name.as_str(), t)).collect();
        let sale = by_name["sale"];
        assert!(sale.has_primary_key);
        assert_eq!(sale.index_count, 1);
        assert_eq!(
            sale.foreign_keys,
            vec![
                SqliteForeignKeyFact {
                    column: "partner_id".into(),
                    target_table: "partner".into(),
                    indexed: true
                },
                SqliteForeignKeyFact {
                    column: "user_id".into(),
                    target_table: "partner".into(),
                    indexed: false
                },
            ]
        );
        assert!(!by_name["log"].has_primary_key);
        assert!(by_name["pair"].without_rowid);
        assert_eq!(by_name["recent"].kind, "view");
        assert_eq!(by_name["recent"].bytes, None);
    }

    #[test]
    fn sizes_add_up_to_the_file_within_its_free_pages_and_schema() {
        let dir = tempfile::tempdir().unwrap();
        let path = fixture(dir.path());
        let facts = read_facts(&path).unwrap();
        let tables: i64 = facts.tables.iter().filter_map(|t| t.bytes).sum();
        let file = facts.page_size * facts.page_count;
        let slack = facts.page_size * (facts.freelist_count + 2);
        assert!(
            tables <= file && tables >= file - slack,
            "{tables} of {file}"
        );
    }

    #[test]
    fn a_write_ahead_log_beside_the_copy_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let path = fixture(dir.path());
        assert_eq!(read_facts(&path).unwrap().wal_bytes, None);
        let writer = Connection::open(&path).unwrap();
        writer
            .execute_batch("PRAGMA journal_mode = WAL; INSERT INTO log VALUES ('x');")
            .unwrap();
        let facts = read_facts(&path).unwrap();
        assert_eq!(facts.journal_mode, "wal");
        assert!(facts.wal_bytes.unwrap_or(0) > 0);
        drop(writer);
    }
}
