use super::sqlite_value_to_json;
use serde_json::Value;

/// Every row of a prepared statement as JSON cells, or the first `max_rows`. A row that fails
/// to read fails the whole read, so a page never shows fewer rows than the database holds
/// without saying so. The caller asks for one row more than it shows to learn there are more.
pub(super) fn read_rows(
    stmt: &mut rusqlite::Statement<'_>,
    col_count: usize,
    blob_limit: Option<usize>,
    context: &str,
    max_rows: Option<usize>,
) -> Result<Vec<Vec<Value>>, String> {
    let mut rows = stmt.query([]).map_err(|e| format!("{context}: {e}"))?;
    let mut out = Vec::new();
    while max_rows.is_none_or(|max| out.len() < max) {
        let Some(row) = rows
            .next()
            .map_err(|e| format!("A row could not be read: {e}"))?
        else {
            break;
        };
        let mut vals = Vec::with_capacity(col_count);
        for i in 0..col_count {
            let val = row
                .get_ref(i)
                .map(|v| v.into())
                .unwrap_or(rusqlite::types::Value::Null);
            vals.push(sqlite_value_to_json(&val, blob_limit));
        }
        out.push(vals);
    }
    Ok(out)
}
