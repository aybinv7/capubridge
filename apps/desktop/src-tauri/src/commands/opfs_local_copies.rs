//! Where the local copies of OPFS databases live on this computer, and for how long.
//!
//! A pull opened for viewing lives in `<temp>/capubridge/opfs-pulls` and is only read while the
//! app runs: nothing kept across restarts points at it. A later start removes the ones older than
//! `PULL_MAX_AGE`, so a second Capubridge running at the same time keeps the copies it has open.
//!
//! A backup, the database as it was before Capubridge changed it, lives in the app's local data
//! folder (`opfs-backups`), away from the system's temp cleanup. It is kept for `BACKUP_MAX_AGE`,
//! and only the newest `BACKUPS_PER_DATABASE` of each database. These copies hold the app's data,
//! so they are not kept longer than a mistake takes to notice.
//!
//! Before this folder existed every copy went straight into the temp folder as `opfs-*.db`;
//! those are removed once they are older than `BACKUP_MAX_AGE`.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::Manager;

pub(crate) const BACKUP_MAX_AGE: Duration = Duration::from_secs(14 * 24 * 60 * 60);
pub(crate) const BACKUPS_PER_DATABASE: usize = 5;
pub(crate) const PULL_MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);

const BACKUPS_FOLDER: &str = "opfs-backups";
const NAME_PREFIX: &str = "opfs-";
const NAME_SUFFIX: &str = ".db";

/// A copy's file name, read back: when it was made, its order within that second, and the
/// database it copies.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CopyName {
    pub(crate) made_at: u64,
    pub(crate) counter: u64,
    pub(crate) label: String,
}

impl CopyName {
    /// `None` for any file Capubridge did not name, which is never touched.
    pub(crate) fn parse(file_name: &str) -> Option<Self> {
        let rest = file_name
            .strip_prefix(NAME_PREFIX)?
            .strip_suffix(NAME_SUFFIX)?;
        let (made_at, rest) = rest.split_once('-')?;
        let (counter, label) = rest.split_once('-')?;
        if label.is_empty() {
            return None;
        }
        Some(Self {
            made_at: digits(made_at)?,
            counter: digits(counter)?,
            label: label.to_string(),
        })
    }

    fn age(&self, now: SystemTime) -> Duration {
        let made = UNIX_EPOCH + Duration::from_secs(self.made_at);
        now.duration_since(made).unwrap_or(Duration::ZERO)
    }
}

fn digits(text: &str) -> Option<u64> {
    if text.is_empty() || !text.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

fn safe_label(label: &str) -> String {
    let safe: String = label
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if safe.is_empty() {
        "database".to_string()
    } else {
        safe
    }
}

/// A new, unused path in `dir` for a copy of the database `label`, creating `dir` if needed.
pub(crate) fn new_copy_path(dir: &Path, label: &str) -> Result<PathBuf, String> {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Could not create the folder {}: {e}", dir.display()))?;
    let counter = COUNTER.fetch_add(1, Ordering::SeqCst);
    let made_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let name = format!(
        "{NAME_PREFIX}{made_at}-{counter}-{}{NAME_SUFFIX}",
        safe_label(label)
    );
    Ok(dir.join(name))
}

pub(crate) fn pulls_dir() -> PathBuf {
    std::env::temp_dir().join("capubridge").join("opfs-pulls")
}

pub(crate) fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join(BACKUPS_FOLDER))
        .map_err(|error| format!("Could not find the folder for database backups: {error}"))
}

fn copies_in(dir: &Path) -> Vec<(PathBuf, CopyName)> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|entry| entry.file_type().map(|t| t.is_file()).unwrap_or(false))
        .filter_map(|entry| {
            let name = CopyName::parse(entry.file_name().to_str()?)?;
            Some((entry.path(), name))
        })
        .collect()
}

/// Removes what `doomed` picks; a file the system will not let go of (still open) stays for the
/// next sweep. Returns how many went.
fn remove_all(doomed: Vec<PathBuf>) -> usize {
    doomed
        .into_iter()
        .filter(|path| match std::fs::remove_file(path) {
            Ok(()) => true,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
            Err(error) => {
                log::warn!("[opfs-copies] Could not remove {}: {error}", path.display());
                false
            }
        })
        .count()
}

/// The copies in `dir` older than `max_age`.
pub(crate) fn older_than(dir: &Path, max_age: Duration, now: SystemTime) -> Vec<PathBuf> {
    copies_in(dir)
        .into_iter()
        .filter(|(_, name)| name.age(now) > max_age)
        .map(|(path, _)| path)
        .collect()
}

/// The backups in `dir` past their keeping: older than `BACKUP_MAX_AGE`, or beyond the newest
/// `BACKUPS_PER_DATABASE` of their database.
pub(crate) fn expired_backups(dir: &Path, now: SystemTime) -> Vec<PathBuf> {
    let mut by_database: BTreeMap<String, Vec<(PathBuf, CopyName)>> = BTreeMap::new();
    for (path, name) in copies_in(dir) {
        by_database
            .entry(name.label.clone())
            .or_default()
            .push((path, name));
    }
    by_database
        .into_values()
        .flat_map(|mut copies| {
            copies.sort_by_key(|(_, name)| std::cmp::Reverse((name.made_at, name.counter)));
            copies
                .into_iter()
                .enumerate()
                .filter(move |(rank, (_, name))| {
                    *rank >= BACKUPS_PER_DATABASE || name.age(now) > BACKUP_MAX_AGE
                })
                .map(|(_, (path, _))| path)
        })
        .collect()
}

/// Drops the backups of `dir` past their keeping; run after each new backup.
pub(crate) fn prune_backups(dir: &Path) -> usize {
    remove_all(expired_backups(dir, SystemTime::now()))
}

/// The cleanup run once at start: old pulls, expired backups, and old copies left in the temp
/// folder by earlier versions. Runs off the main thread; it never fails the start.
pub(crate) fn sweep_at_start(app: &tauri::AppHandle) {
    let backups = backups_dir(app);
    tauri::async_runtime::spawn_blocking(move || {
        let now = SystemTime::now();
        let pulls = remove_all(older_than(&pulls_dir(), PULL_MAX_AGE, now));
        let legacy = remove_all(older_than(&std::env::temp_dir(), BACKUP_MAX_AGE, now));
        let expired = match backups {
            Ok(dir) => remove_all(expired_backups(&dir, now)),
            Err(error) => {
                log::warn!("[opfs-copies] {error}");
                0
            }
        };
        if pulls + legacy + expired > 0 {
            log::info!(
                "[opfs-copies] Removed {pulls} old pulls, {expired} expired backups, {legacy} old copies from the temp folder"
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: u64 = 24 * 60 * 60;

    fn touch(dir: &Path, name: &str) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, b"x").expect("write");
        path
    }

    fn names(mut paths: Vec<PathBuf>) -> Vec<String> {
        paths.sort();
        paths
            .into_iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect()
    }

    fn at(seconds: u64) -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(seconds)
    }

    #[test]
    fn a_copy_name_reads_back_with_dashes_in_its_label() {
        assert_eq!(
            CopyName::parse("opfs-1700000000-3-presalio-retail.sqlite3.db"),
            Some(CopyName {
                made_at: 1_700_000_000,
                counter: 3,
                label: "presalio-retail.sqlite3".to_string(),
            })
        );
    }

    #[test]
    fn a_file_capubridge_did_not_name_is_never_a_copy() {
        for name in [
            "opfs-.db",
            "opfs-12-x-app.db",
            "opfs-12-3-.db",
            "opfs-12-3-app.sqlite",
            "other-12-3-app.db",
            "opfs-1a-3-app.db",
        ] {
            assert_eq!(CopyName::parse(name), None, "{name}");
        }
    }

    #[test]
    fn a_new_copy_path_is_unique_and_reads_back() {
        let dir = tempfile::tempdir().expect("temp dir");
        let first = new_copy_path(&dir.path().join("nested"), "my db/1").expect("path");
        let second = new_copy_path(&dir.path().join("nested"), "my db/1").expect("path");
        assert_ne!(first, second);
        assert!(dir.path().join("nested").is_dir());
        let name = CopyName::parse(first.file_name().unwrap().to_str().unwrap()).expect("name");
        assert_eq!(name.label, "my_db_1");
    }

    #[test]
    fn backups_keep_the_newest_five_of_each_database_within_fourteen_days() {
        let dir = tempfile::tempdir().expect("temp dir");
        let now = 100 * DAY;
        for counter in 0..7 {
            touch(dir.path(), &format!("opfs-{}-{counter}-app.db", now - DAY));
        }
        touch(dir.path(), &format!("opfs-{}-0-other.db", now - 13 * DAY));
        touch(dir.path(), &format!("opfs-{}-1-other.db", now - 15 * DAY));
        touch(dir.path(), "notes.txt");

        let expired = names(expired_backups(dir.path(), at(now)));

        assert_eq!(
            expired,
            vec![
                format!("opfs-{}-1-other.db", now - 15 * DAY),
                format!("opfs-{}-0-app.db", now - DAY),
                format!("opfs-{}-1-app.db", now - DAY),
            ]
        );
    }

    #[test]
    fn only_old_copies_are_picked_and_other_files_stay() {
        let dir = tempfile::tempdir().expect("temp dir");
        let now = 10 * DAY;
        let old = touch(dir.path(), &format!("opfs-{}-0-app.db", now - 2 * DAY));
        touch(dir.path(), &format!("opfs-{}-1-app.db", now - 60));
        touch(dir.path(), &format!("other-{}-0-app.db", now - 9 * DAY));

        assert_eq!(older_than(dir.path(), PULL_MAX_AGE, at(now)), vec![old]);
    }

    #[test]
    fn pruning_removes_the_files_it_picks() {
        let dir = tempfile::tempdir().expect("temp dir");
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        for counter in 0..6 {
            touch(dir.path(), &format!("opfs-{now}-{counter}-app.db"));
        }

        assert_eq!(prune_backups(dir.path()), 1);
        assert!(!dir.path().join(format!("opfs-{now}-0-app.db")).exists());
        assert_eq!(copies_in(dir.path()).len(), BACKUPS_PER_DATABASE);
    }
}
