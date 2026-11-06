use super::quote_ident;
use rusqlite::{Connection, OptionalExtension};

/// Names SQLite answers with the rowid, unless a column of the table takes the name.
const ROWID_ALIASES: [&str; 3] = ["rowid", "_rowid_", "oid"];

/// Terms that order a relation's rows completely: the rowid of a rowid table, the primary key
/// of a WITHOUT ROWID table, every result column of a view. Paging with LIMIT/OFFSET is only
/// stable when equal sort values are broken by such a key.
fn row_key_terms(conn: &Connection, table: &str) -> Result<RowKey, String> {
    let listed: Option<(String, i64)> = conn
        .query_row(
            "SELECT type, wr FROM pragma_table_list WHERE schema = 'main' AND name = ?1",
            [table],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| format!("Failed to read the table: {e}"))?;
    let Some((kind, without_rowid)) = listed else {
        return Ok(RowKey::None);
    };
    let mut stmt = conn
        .prepare("SELECT name, pk FROM pragma_table_info(?1)")
        .map_err(|e| format!("Failed to read the columns: {e}"))?;
    let mut columns: Vec<(String, i64)> = stmt
        .query_map([table], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to read the columns: {e}"))?
        .collect::<Result<_, _>>()
        .map_err(|e| format!("Failed to read the columns: {e}"))?;
    if kind == "view" {
        return Ok(RowKey::Positions(columns.len()));
    }
    if without_rowid != 0 {
        columns.retain(|(_, pk)| *pk > 0);
        columns.sort_by_key(|(_, pk)| *pk);
        return Ok(RowKey::Terms(
            columns.iter().map(|(name, _)| quote_ident(name)).collect(),
        ));
    }
    let taken = |alias: &str| {
        columns
            .iter()
            .any(|(name, _)| name.eq_ignore_ascii_case(alias))
    };
    Ok(match ROWID_ALIASES.iter().find(|alias| !taken(alias)) {
        Some(alias) => RowKey::Terms(vec![(*alias).to_string()]),
        None => RowKey::None,
    })
}

enum RowKey {
    Terms(Vec<String>),
    /// A view has no key; its result columns by position stand in, only under a sort.
    Positions(usize),
    None,
}

/// The ORDER BY of one page: the person's sort, then the row key in the same direction (so an
/// index on the sorted column still serves it), or the row key alone when nothing is sorted.
pub(super) fn page_order(
    conn: &Connection,
    table: &str,
    order_by: Option<&str>,
    descending: bool,
) -> Result<String, String> {
    let dir = if descending { "DESC" } else { "ASC" };
    let key = row_key_terms(conn, table)?;
    let tail: Vec<String> = match (&key, order_by) {
        (RowKey::Terms(terms), _) => terms.iter().map(|t| format!("{t} {dir}")).collect(),
        (RowKey::Positions(count), Some(_)) => (1..=*count).map(|n| format!("{n} {dir}")).collect(),
        _ => Vec::new(),
    };
    let mut terms = Vec::with_capacity(tail.len() + 1);
    if let Some(column) = order_by {
        terms.push(format!("{} {dir}", quote_ident(column)));
    }
    terms.extend(tail);
    Ok(if terms.is_empty() {
        String::new()
    } else {
        format!(" ORDER BY {}", terms.join(", "))
    })
}
