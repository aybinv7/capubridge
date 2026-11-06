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
