use crate::commands::sqlite_opened::{checkpoint, opened_file_path};
use rusqlite::fallible_iterator::FallibleIterator;
use rusqlite::{Batch, Connection, OpenFlags};
use serde::{Deserialize, Serialize};

/// One staged change: an `UPDATE` of one row, or an `INSERT` of one row.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteChangeStatement {
    pub sql: String,
}

/// What each statement did: always one row, and the rowid an insert was given.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SqliteChangesetResult {
    pub inserted_row_ids: Vec<Option<i64>>,
    pub duration_ms: u64,
}

/// The number of SQL statements in `sql`, as SQLite itself splits them.
fn statement_count(conn: &Connection, sql: &str) -> Result<usize, String> {
    let mut batch = Batch::new(conn, sql);
    let mut count = 0;
    while batch.next().map_err(|e| e.to_string())?.is_some() {
        count += 1;
    }
    Ok(count)
}

fn is_insert(sql: &str) -> bool {
    sql.trim_start()
        .get(..6)
        .is_some_and(|head| head.eq_ignore_ascii_case("insert"))
}

/// Runs every statement in one transaction. Each must change exactly one row (a key that no
/// longer matches, or matches several rows, would make the save mean something else), and a
/// statement may hold only one SQL statement. Any failure rolls the whole changeset back.
pub(crate) fn apply_changeset(
    conn: &mut Connection,
    statements: &[SqliteChangeStatement],
) -> Result<SqliteChangesetResult, String> {
    let start = std::time::Instant::now();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut inserted_row_ids = Vec::with_capacity(statements.len());
    for (index, statement) in statements.iter().enumerate() {
        let count = statement_count(&tx, &statement.sql)
            .map_err(|e| format!("Change {} of {}: {e}", index + 1, statements.len()))?;
        if count != 1 {
            return Err(format!(
                "Change {} of {} holds {count} statements instead of one, so nothing was saved",
                index + 1,
                statements.len()
            ));
        }
        let changed = tx
            .execute(&statement.sql, [])
            .map_err(|e| format!("Change {} of {}: {e}", index + 1, statements.len()))?;
        if changed != 1 {
            return Err(format!(
                "Change {} of {} would touch {changed} rows instead of one, so nothing was saved",
                index + 1,
                statements.len()
            ));
        }
        inserted_row_ids.push(is_insert(&statement.sql).then(|| tx.last_insert_rowid()));
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(SqliteChangesetResult {
        inserted_row_ids,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Saves staged cell edits and new rows to a file opened on this computer, all or nothing.
/// A copy pulled from a phone or a page is refused: a change there would never reach the app.
#[tauri::command]
pub async fn sqlite_apply_changeset(
    serial: String,
    package: String,
    db_path: String,
    statements: Vec<SqliteChangeStatement>,
) -> Result<SqliteChangesetResult, String> {
    tokio::task::spawn_blocking(move || {
        let path = opened_file_path(&serial, &package, &db_path)?;
        let mut conn = Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|e| format!("Failed to open database (rw): {e}"))?;
        let result = apply_changeset(&mut conn, &statements)?;
        checkpoint(&conn)?;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shop() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL);
             INSERT INTO item VALUES (1, 'tea', 2.5), (2, 'cake', 4.0);",
        )
        .unwrap();
        conn
    }

    fn statement(sql: &str) -> SqliteChangeStatement {
        SqliteChangeStatement {
            sql: sql.to_string(),
        }
    }

    fn names(conn: &Connection) -> Vec<String> {
        let mut stmt = conn.prepare("SELECT name FROM item ORDER BY id").unwrap();
        stmt.query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    }

    #[test]
    fn a_changeset_that_fails_part_way_changes_nothing() {
        let mut conn = shop();
        let result = apply_changeset(
            &mut conn,
            &[
                statement("UPDATE item SET name = 'green tea' WHERE id = 1"),
                statement("INSERT INTO item (id, name) VALUES (3, NULL)"),
            ],
        );
        assert!(result.is_err());
        assert_eq!(names(&conn), vec!["tea", "cake"]);
    }

    #[test]
    fn an_edit_whose_row_is_gone_saves_nothing() {
        let mut conn = shop();
        let error = apply_changeset(
            &mut conn,
            &[
                statement("UPDATE item SET name = 'scone' WHERE id = 2"),
                statement("UPDATE item SET name = 'x' WHERE id = 99"),
            ],
        )
        .unwrap_err();
        assert!(error.contains("touch 0 rows"), "{error}");
        assert_eq!(names(&conn), vec!["tea", "cake"]);
    }

    #[test]
    fn a_statement_cannot_smuggle_a_second_one() {
        let mut conn = shop();
        let result = apply_changeset(
            &mut conn,
            &[statement(
                "UPDATE item SET name = 'a' WHERE id = 1; DELETE FROM item",
            )],
        );
        assert!(result.is_err());
        assert_eq!(names(&conn), vec!["tea", "cake"]);
    }

    #[test]
    fn edits_and_inserts_are_saved_together_with_the_new_rowids() {
        let mut conn = shop();
        let result = apply_changeset(
            &mut conn,
            &[
                statement("UPDATE item SET price = 3.0 WHERE id = 1"),
                statement("INSERT INTO item (name, price) VALUES ('scone', 1.5)"),
            ],
        )
        .unwrap();
        assert_eq!(result.inserted_row_ids, vec![None, Some(3)]);
        assert_eq!(names(&conn), vec!["tea", "cake", "scone"]);
    }

    #[tokio::test]
    async fn a_copy_pulled_from_a_phone_or_page_is_refused() {
        for (serial, package) in [("R5CT", "com.shop"), ("__local__", "com.shop")] {
            let error = sqlite_apply_changeset(
                serial.to_string(),
                package.to_string(),
                "/data/data/com.shop/databases/shop.db".to_string(),
                vec![statement("UPDATE item SET name = 'x' WHERE id = 1")],
            )
            .await
            .unwrap_err();
            assert!(
                error.contains("Only a file opened on this computer"),
                "{error}"
            );
        }
    }
}
