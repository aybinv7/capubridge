use serde::{Deserialize, Serialize};

/// Permission string reported for an entry the shell user cannot stat.
const UNKNOWN_PERMISSIONS: &str = "?????????";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub size: u64,
    /// Raw `ls` timestamp (`YYYY-MM-DD HH:MM` or `Mon DD HH:MM`); empty when unknown.
    pub modified: String,
    /// `file`, `dir`, `symlink` or `other`.
    pub entry_type: String,
    /// Nine permission characters such as `rwxr-xr-x`, or `?????????` when unreadable.
    pub permissions: String,
    /// True for rows `ls` could not stat (all fields printed as `?`).
    pub no_access: bool,
}

/// Strip ANSI escape sequences (color codes) from ls output on Android.
pub(crate) fn strip_ansi(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' && chars.peek() == Some(&'[') {
            chars.next();
            for nc in chars.by_ref() {
                if nc.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            result.push(c);
        }
    }
    result
}

fn token_spans(line: &str) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
    let mut start: Option<usize> = None;
    for (index, ch) in line.char_indices() {
        match (ch.is_whitespace(), start) {
            (true, Some(begin)) => {
                spans.push((begin, index));
                start = None;
            }
            (false, None) => start = Some(index),
            _ => {}
        }
    }
    if let Some(begin) = start {
        spans.push((begin, line.len()));
    }
    spans
}

fn entry_type_for(type_char: char) -> &'static str {
    match type_char {
        'd' => "dir",
        'l' => "symlink",
        '-' => "file",
        _ => "other",
    }
}

fn is_toybox_date(token: &str) -> bool {
    let bytes = token.as_bytes();
    bytes.len() == 10 && bytes[4] == b'-' && bytes[7] == b'-'
}

fn strip_link_target(name: &str, entry_type: &str) -> String {
    if entry_type == "symlink" {
        if let Some((link, _)) = name.split_once(" -> ") {
            return link.to_string();
        }
    }
    name.to_string()
}

/// Parse one line from `ls -la` output into a FileEntry. Handles toybox
/// (`YYYY-MM-DD HH:MM`) and busybox (`Mon DD HH:MM`) dates, device nodes whose
/// size column is `major, minor`, and toybox rows for entries the shell user
/// cannot stat, which print every field as `?`.
pub(crate) fn parse_ls_line(line: &str) -> Option<FileEntry> {
    let stripped = strip_ansi(line);
    let clean = stripped.trim();

    let type_char = clean.chars().next()?;
    if !matches!(type_char, 'd' | '-' | 'l' | 'c' | 'b' | 's' | 'p') {
        return None;
    }

    let spans = token_spans(clean);
    let token = |index: usize| spans.get(index).map(|&(start, end)| &clean[start..end]);
    let perm_str = token(0)?;
    if perm_str.chars().count() < 10 {
        return None;
    }
    let entry_type = entry_type_for(type_char);
    let permissions: String = perm_str.chars().skip(1).take(9).collect();
    let no_access = permissions == UNKNOWN_PERMISSIONS;

    let (size, modified, name_index) = if no_access {
        (0, String::new(), 6)
    } else {
        let device_node = token(4).is_some_and(|value| value.ends_with(','));
        let size_index = if device_node { 5 } else { 4 };
        let size = if device_node {
            0
        } else {
            token(size_index)?.parse().unwrap_or(0)
        };
        let date_index = size_index + 1;
        let date = token(date_index)?;
        if is_toybox_date(date) {
            (
                size,
                format!("{} {}", date, token(date_index + 1)?),
                date_index + 2,
            )
        } else {
            let day = token(date_index + 1)?;
            let time = token(date_index + 2)?;
            (size, format!("{date} {day} {time}"), date_index + 3)
        }
    };

    let &(name_start, _) = spans.get(name_index)?;
    let name = strip_link_target(&clean[name_start..], entry_type);
    if name.is_empty() || name == "." || name == ".." {
        return None;
    }

    Some(FileEntry {
        name,
        size,
        modified,
        entry_type: entry_type.to_string(),
        permissions,
        no_access,
    })
}

pub(crate) fn parse_ls_entries(stdout: &str) -> Vec<FileEntry> {
    stdout.lines().filter_map(parse_ls_line).collect()
}

/// Path handed to `ls -la`: every directory but `/` gets a trailing slash so a
/// symlinked folder (`/sdcard`, `/etc`) lists its target instead of the link.
pub(crate) fn listing_path(normalized: &str) -> String {
    if normalized == "/" || normalized.ends_with('/') {
        normalized.to_string()
    } else {
        format!("{normalized}/")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(line: &str) -> FileEntry {
        parse_ls_line(line).unwrap_or_else(|| panic!("line should parse: {line}"))
    }

    #[test]
    fn unreadable_symlink_row() {
        let entry = parse("l?????????    ? ?      ?            ?                ? cache -> ?");
        assert_eq!(entry.name, "cache");
        assert_eq!(entry.entry_type, "symlink");
        assert_eq!(entry.size, 0);
        assert_eq!(entry.modified, "");
        assert_eq!(entry.permissions, "?????????");
        assert!(entry.no_access);
    }

    #[test]
    fn unreadable_dir_and_file_rows() {
        let dir = parse("d?????????    ? ?      ?            ?                ? data_mirror");
        assert_eq!(dir.name, "data_mirror");
        assert_eq!(dir.entry_type, "dir");
        assert!(dir.no_access);

        let file = parse("-?????????    ? ?      ?            ?                ? init.environ.rc");
        assert_eq!(file.name, "init.environ.rc");
        assert_eq!(file.entry_type, "file");
        assert_eq!(file.modified, "");
        assert!(file.no_access);
    }

    #[test]
    fn toybox_directory_row() {
        let entry = parse("drwxrws---  2 u0_a272  media_rw    3452 2026-08-04 10:10 Fonts");
        assert_eq!(
            entry,
            FileEntry {
                name: "Fonts".to_string(),
                size: 3452,
                modified: "2026-08-04 10:10".to_string(),
                entry_type: "dir".to_string(),
                permissions: "rwxrws---".to_string(),
                no_access: false,
            }
        );
    }

    #[test]
    fn name_with_spaces_is_kept_verbatim() {
        let entry = parse("-rwxrwx---  1 u0_a272  media_rw  131072 2026-08-20 16:07 cashew-2026-08-20-15-59-00-036079 (1).sql");
        assert_eq!(entry.name, "cashew-2026-08-20-15-59-00-036079 (1).sql");
        assert_eq!(entry.size, 131_072);
        assert_eq!(entry.modified, "2026-08-20 16:07");
        assert_eq!(entry.entry_type, "file");

        let doubled = parse("-rw-r--r-- 1 root root 1 2026-08-20 16:07 two  spaces");
        assert_eq!(doubled.name, "two  spaces");
    }

    #[test]
    fn readable_symlink_drops_target() {
        let entry =
            parse("lrw-r--r--    1 root   root        11 2009-01-01 01:00 bin -> /system/bin");
        assert_eq!(entry.name, "bin");
        assert_eq!(entry.entry_type, "symlink");
        assert_eq!(entry.size, 11);
        assert_eq!(entry.modified, "2009-01-01 01:00");
        assert!(!entry.no_access);
    }

    #[test]
    fn epoch_dates_stay_raw() {
        let entry = parse("-rw-r--r--  1 root root 0 1970-01-01 00:00 empty.txt");
        assert_eq!(entry.modified, "1970-01-01 00:00");
        assert_eq!(entry.name, "empty.txt");
    }

    #[test]
    fn busybox_month_day_time_row() {
        let entry = parse("-rw-rw-r--    1 root     root          1234 Jan  5 12:34 notes.txt");
        assert_eq!(entry.name, "notes.txt");
        assert_eq!(entry.size, 1234);
        assert_eq!(entry.modified, "Jan 5 12:34");
    }

    #[test]
    fn device_node_row_has_no_size() {
        let entry = parse("crw-rw-rw-  1 root root 1,   3 2026-01-01 00:00 null");
        assert_eq!(entry.name, "null");
        assert_eq!(entry.entry_type, "other");
        assert_eq!(entry.size, 0);
        assert_eq!(entry.modified, "2026-01-01 00:00");
    }

    #[test]
    fn total_dot_and_dotdot_rows_are_dropped() {
        let output = "total 24\ndrwxr-xr-x 20 root root 4096 2026-08-04 10:10 .\ndrwxr-xr-x 20 root root 4096 2026-08-04 10:10 ..\n\x1b[1;34mdrwxr-xr-x\x1b[0m 2 root root 40 2026-08-04 10:10 acct\nd?????????    ? ?      ?            ?                ? data_mirror\n";
        let entries = parse_ls_entries(output);
        let names: Vec<&str> = entries.iter().map(|entry| entry.name.as_str()).collect();
        assert_eq!(names, vec!["acct", "data_mirror"]);
    }

    #[test]
    fn listing_path_follows_symlinked_folders() {
        assert_eq!(listing_path("/"), "/");
        assert_eq!(listing_path("/sdcard"), "/sdcard/");
        assert_eq!(listing_path("/etc/"), "/etc/");
    }
}
