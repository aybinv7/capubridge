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
    async fn companions(&mut self, _path: &str, _sah_pool: bool) -> Result<Vec<Companion>, String> {
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
    conn.execute_batch(
        "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT); CREATE TABLE tags (name TEXT);",
    )
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
