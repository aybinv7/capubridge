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

#[tokio::test]
async fn a_row_that_fails_to_read_fails_the_query_instead_of_vanishing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("shop.db");
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE item (id INTEGER PRIMARY KEY); INSERT INTO item VALUES (1), (2), (3);",
        )
        .unwrap();
    let result = sqlite_execute_query(
        LOCAL_SERIAL.to_string(),
        "file".to_string(),
        path.to_string_lossy().to_string(),
        "SELECT CASE WHEN id = 2 THEN abs(-9223372036854775808) ELSE id END FROM item ORDER BY id"
            .to_string(),
        None,
        None,
    )
    .await;
    assert!(result.is_err(), "{result:?}");
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

#[tokio::test]
async fn a_query_reads_no_more_rows_than_asked() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("big.db");
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE n (v); WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c \
             WHERE x < 50) INSERT INTO n SELECT x FROM c;",
        )
        .unwrap();
    let result = sqlite_execute_query(
        LOCAL_SERIAL.to_string(),
        "file".to_string(),
        path.to_string_lossy().to_string(),
        "SELECT v FROM n".to_string(),
        None,
        Some(11),
    )
    .await
    .unwrap();
    assert_eq!(result.rows.len(), 11);
}

async fn page_ids(path: &std::path::Path, table: &str, order: Option<(&str, &str)>) -> Vec<i64> {
    let mut ids = Vec::new();
    let mut offset = 0;
    loop {
        let page = sqlite_table_rows(
            LOCAL_SERIAL.to_string(),
            "file".to_string(),
            path.to_string_lossy().to_string(),
            table.to_string(),
            offset,
            50,
            order.map(|(column, _)| column.to_string()),
            order.map(|(_, dir)| dir.to_string()),
        )
        .await
        .unwrap();
        if page.rows.is_empty() {
            break;
        }
        ids.extend(page.rows.iter().map(|row| row[0].as_i64().unwrap()));
        offset += 50;
    }
    ids
}

fn reference_ids(path: &std::path::Path, sql: &str) -> Vec<i64> {
    let conn = Connection::open(path).unwrap();
    let mut stmt = conn.prepare(sql).unwrap();
    let ids = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(|row| row.unwrap())
        .collect();
    ids
}

/// SQLite leaves the order of equal sort values undefined, and pages are read with
/// LIMIT/OFFSET: unless the row key breaks the tie, one plan may put a row on two pages and
/// another on none. Pages must follow exactly the order "sort column, then the row key".
#[tokio::test]
async fn sorted_pages_break_ties_by_the_row_key_so_each_row_shows_once() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("paging.db");
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE item (id INTEGER PRIMARY KEY, state TEXT, qty INTEGER);              CREATE INDEX item_state ON item(state);              WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 1000)              INSERT INTO item SELECT x, CASE x % 3 WHEN 0 THEN 'draft' WHEN 1 THEN 'done'              ELSE 'sent' END, x % 7 FROM c;              CREATE TABLE pair (a INTEGER, b INTEGER, v INTEGER, PRIMARY KEY (a, b)) WITHOUT ROWID;              INSERT INTO pair SELECT id % 10, id, qty FROM item;              CREATE VIEW recent AS SELECT id, qty FROM item;",
        )
        .unwrap();
    for (column, dir) in [
        ("state", "ASC"),
        ("state", "DESC"),
        ("qty", "ASC"),
        ("qty", "DESC"),
    ] {
        let paged = page_ids(&path, "item", Some((column, dir))).await;
        let expected = reference_ids(
            &path,
            &format!("SELECT id FROM item ORDER BY {column} {dir}, rowid {dir}"),
        );
        assert_eq!(paged, expected, "item by {column} {dir}");
    }
    assert_eq!(
        page_ids(&path, "pair", Some(("v", "DESC"))).await,
        reference_ids(&path, "SELECT a FROM pair ORDER BY v DESC, a DESC, b DESC"),
    );
    assert_eq!(
        page_ids(&path, "pair", None).await,
        reference_ids(&path, "SELECT a FROM pair ORDER BY a, b"),
    );
    assert_eq!(
        page_ids(&path, "recent", Some(("qty", "DESC"))).await,
        reference_ids(&path, "SELECT id FROM item ORDER BY qty DESC, id DESC"),
    );
}
