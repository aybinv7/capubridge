/// One physical line of `logcat -v threadtime -v epoch -v uid` output, split
/// into its header fields. The message is the exact text after `TAG: `, with
/// every space kept.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct LogcatHeaderLine {
    pub ts_ms: i64,
    pub uid: Option<u32>,
    pub pid: Option<u32>,
    pub tid: Option<u32>,
    pub level: char,
    pub tag: String,
    pub message: String,
}

/// What one line of output turned out to be.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum LogcatLine {
    Header(LogcatHeaderLine),
    /// A buffer banner such as `--------- beginning of main`.
    Banner,
    /// Anything else: an error printed by logcat itself, or a stray line.
    Other(String),
}

fn split_token(text: &str) -> (&str, &str) {
    let text = text.trim_start_matches(' ');
    match text.find([' ', '\t']) {
        Some(end) => (&text[..end], &text[end..]),
        None => (text, ""),
    }
}

/// Parses `1699999999.123` (any number of fraction digits) into epoch milliseconds.
pub(crate) fn parse_epoch_ms(token: &str) -> Option<i64> {
    let (seconds, fraction) = token.split_once('.').unwrap_or((token, ""));
    if seconds.is_empty() || !seconds.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    if !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let seconds: i64 = seconds.parse().ok()?;
    let mut millis = 0i64;
    for (index, digit) in fraction.bytes().take(3).enumerate() {
        millis += i64::from(digit - b'0') * 10i64.pow(2 - index as u32);
    }
    Some(seconds * 1000 + millis)
}

fn normalize_level(level: char) -> Option<char> {
    match level {
        'V' | 'D' | 'I' | 'W' | 'E' | 'F' => Some(level),
        'A' => Some('F'),
        _ => None,
    }
}

fn parse_number(token: &str) -> Option<u32> {
    if token.is_empty() || !token.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    token.parse().ok()
}

/// Reads a uid column value: a number, a well-known name, or an app id such as
/// `u0_a145`.
fn parse_uid(token: &str) -> Option<u32> {
    if let Some(number) = parse_number(token) {
        return Some(number);
    }
    match token {
        "root" => return Some(0),
        "system" => return Some(1000),
        "shell" => return Some(2000),
        "nobody" => return Some(9999),
        _ => {}
    }
    let rest = token.strip_prefix('u')?;
    let (user, app) = rest.split_once('_')?;
    let user = parse_number(user)?;
    let app_id = if let Some(app) = app.strip_prefix('a') {
        10_000 + parse_number(app)?
    } else if let Some(isolated) = app.strip_prefix('i') {
        90_000 + parse_number(isolated)?
    } else {
        return None;
    };
    user.checked_mul(100_000)?.checked_add(app_id)
}

/// Collects the id columns between the time and the level. logcat prints them
/// as `uid pid tid`, `uid:pid tid` (a five-digit pid glued to the colon),
/// `uid: pid tid`, or `pid tid` when the uid column is absent.
fn collect_id_fields(mut rest: &str) -> Option<(Vec<String>, char, &str)> {
    let mut fields: Vec<String> = Vec::with_capacity(3);
    loop {
        let (token, after) = split_token(rest);
        if token.is_empty() {
            return None;
        }
        if fields.len() >= 2 && token.chars().count() == 1 {
            if let Some(level) = token.chars().next().and_then(normalize_level) {
                return Some((fields, level, after));
            }
        }
        match token.split_once(':') {
            Some((uid, pid)) => {
                fields.push(uid.to_string());
                if !pid.is_empty() {
                    fields.push(pid.to_string());
                }
            }
            None => fields.push(token.to_string()),
        }
        if fields.len() > 3 {
            return None;
        }
        rest = after;
    }
}

fn split_tag(rest: &str) -> Option<(String, String)> {
    let body = rest.strip_prefix(' ').unwrap_or(rest);
    if let Some(index) = body.find(": ") {
        return Some((
            body[..index].trim_end().to_string(),
            body[index + 2..].to_string(),
        ));
    }
    body.strip_suffix(':')
        .map(|tag| (tag.trim_end().to_string(), String::new()))
}

/// Parses a header line. Returns `None` when the line is not a log entry.
pub(crate) fn parse_header(line: &str) -> Option<LogcatHeaderLine> {
    let (time, rest) = split_token(line);
    let ts_ms = parse_epoch_ms(time)?;
    let (fields, level, rest) = collect_id_fields(rest)?;
    let (uid, pid, tid) = match fields.as_slice() {
        [pid, tid] => (None, pid, tid),
        [uid, pid, tid] => (parse_uid(uid), pid, tid),
        _ => return None,
    };
    let pid = parse_number(pid)?;
    let tid = parse_number(tid)?;
    let (tag, message) = split_tag(rest)?;
    Some(LogcatHeaderLine {
        ts_ms,
        uid,
        pid: Some(pid),
        tid: Some(tid),
        level,
        tag,
        message,
    })
}

/// Classifies one line of logcat output, with any trailing `\r` removed.
pub(crate) fn classify_line(raw: &str) -> LogcatLine {
    let line = raw.trim_end_matches('\r');
    if let Some(header) = parse_header(line) {
        return LogcatLine::Header(header);
    }
    if line.starts_with("--------- ") {
        return LogcatLine::Banner;
    }
    LogcatLine::Other(line.to_string())
}

/// A log entry: one or more physical lines that share the same header.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AssembledEntry {
    pub ts_ms: i64,
    pub uid: Option<u32>,
    pub pid: Option<u32>,
    pub tid: Option<u32>,
    pub level: char,
    pub tag: String,
    pub message: String,
}

impl AssembledEntry {
    fn from_header(header: LogcatHeaderLine) -> Self {
        Self {
            ts_ms: header.ts_ms,
            uid: header.uid,
            pid: header.pid,
            tid: header.tid,
            level: header.level,
            tag: header.tag,
            message: header.message,
        }
    }

    fn continues_with(&self, header: &LogcatHeaderLine) -> bool {
        self.ts_ms == header.ts_ms
            && self.pid == header.pid
            && self.tid == header.tid
            && self.level == header.level
            && self.tag == header.tag
    }
}

/// Joins the physical lines of a multi-line message back into one entry.
/// logcat repeats the header on every line of a message (a stack trace, a
/// pretty-printed payload), so consecutive lines with the same header belong
/// together. Nothing is dropped: every line's text ends up in an entry.
#[derive(Debug, Default)]
pub(crate) struct LineAssembler {
    pending: Option<AssembledEntry>,
}

impl LineAssembler {
    /// Feeds one classified line; returns the entry it completed, if any.
    pub fn push(&mut self, line: LogcatLine) -> Option<AssembledEntry> {
        match line {
            LogcatLine::Header(header) => {
                if let Some(pending) = self.pending.as_mut() {
                    if pending.continues_with(&header) {
                        pending.message.push('\n');
                        pending.message.push_str(&header.message);
                        return None;
                    }
                }
                self.pending.replace(AssembledEntry::from_header(header))
            }
            LogcatLine::Banner => None,
            LogcatLine::Other(text) => {
                if let Some(pending) = self.pending.as_mut() {
                    if !text.trim().is_empty() {
                        pending.message.push('\n');
                        pending.message.push_str(&text);
                    }
                }
                None
            }
        }
    }

    /// Hands back the entry still being assembled.
    pub fn flush(&mut self) -> Option<AssembledEntry> {
        self.pending.take()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CRASH: &str = "\
--------- beginning of crash
     1730000000.120 10145:12345 12345 E AndroidRuntime: FATAL EXCEPTION: main
     1730000000.120 10145:12345 12345 E AndroidRuntime: Process: com.example.shop, PID: 12345
     1730000000.120 10145:12345 12345 E AndroidRuntime: java.lang.IllegalStateException: boom
     1730000000.120 10145:12345 12345 E AndroidRuntime: \tat com.example.shop.Cart.add(Cart.kt:42)
     1730000000.121  root:  612   640 I vold    : Disk at 179:64 changed
";

    fn header(line: &str) -> LogcatHeaderLine {
        parse_header(line).expect("a header line")
    }

    #[test]
    fn parses_a_line_with_a_numeric_uid_glued_to_a_five_digit_pid() {
        let parsed = header("     1730000000.120 10145:12345 12346 D Presalio: sync done");
        assert_eq!(parsed.ts_ms, 1_730_000_000_120);
        assert_eq!(parsed.uid, Some(10145));
        assert_eq!(parsed.pid, Some(12345));
        assert_eq!(parsed.tid, Some(12346));
        assert_eq!(parsed.level, 'D');
        assert_eq!(parsed.tag, "Presalio");
        assert_eq!(parsed.message, "sync done");
    }

    #[test]
    fn parses_a_named_uid_and_a_padded_tag() {
        let parsed =
            header("     1730000000.121  root:  612   640 I vold    : Disk at 179:64 changed");
        assert_eq!(parsed.uid, Some(0));
        assert_eq!(parsed.pid, Some(612));
        assert_eq!(parsed.tag, "vold");
        assert_eq!(parsed.message, "Disk at 179:64 changed");
    }

    #[test]
    fn parses_the_uid_column_printed_without_a_colon() {
        let numeric = header(
            "         1793987330.497  1000  1203  1244 I libPerfCtl: xgfGetFPS pid:2763 fps:60",
        );
        assert_eq!(numeric.uid, Some(1000));
        assert_eq!(numeric.pid, Some(1203));
        assert_eq!(numeric.tid, Some(1244));
        assert_eq!(numeric.level, 'I');
        assert_eq!(numeric.tag, "libPerfCtl");
        assert_eq!(numeric.message, "xgfGetFPS pid:2763 fps:60");

        let named = header(
            "         1793987330.498 shell  1336  1336 I adbd    : adbd service requested 'shell'",
        );
        assert_eq!(named.uid, Some(2000));
        assert_eq!(named.pid, Some(1336));
        assert_eq!(named.tag, "adbd");

        let app = header("         1793987330.600 u0_a145 23762 23770 W chromium: slow frame");
        assert_eq!(app.uid, Some(10_145));
        assert_eq!(app.pid, Some(23762));
        assert_eq!(app.tid, Some(23770));
        assert_eq!(app.level, 'W');
    }

    /// Run with `CAPUBRIDGE_LOGCAT_SAMPLE=<file> cargo test -- --ignored` on a
    /// capture from a real device (`adb shell logcat -v threadtime -v epoch -v uid -d`).
    #[test]
    #[ignore]
    fn parses_a_real_device_capture() {
        let path = std::env::var("CAPUBRIDGE_LOGCAT_SAMPLE").expect("CAPUBRIDGE_LOGCAT_SAMPLE");
        let text = std::fs::read_to_string(path).expect("readable sample");
        let lines: Vec<&str> = text
            .lines()
            .filter(|line| !line.trim().is_empty() && !line.starts_with("--------- "))
            .collect();
        let parsed = lines.iter().filter(|line| parse_header(line).is_some()).count();
        let unparsed: Vec<&&str> = lines
            .iter()
            .filter(|line| parse_header(line).is_none())
            .take(5)
            .collect();
        assert!(
            parsed * 1000 >= lines.len() * 999,
            "{parsed} of {} lines parsed; first misses: {unparsed:?}",
            lines.len()
        );
    }

    #[test]
    fn reads_secondary_user_and_isolated_uids() {
        assert_eq!(parse_uid("u10_a7"), Some(1_010_007));
        assert_eq!(parse_uid("u0_i3"), Some(90_003));
        assert_eq!(parse_uid("media"), None);
    }

    #[test]
    fn parses_a_line_without_the_uid_column() {
        let parsed = header("1730000000.5 1234 1250 W chromium: [WARNING:x.cc(1)] slow");
        assert_eq!(parsed.ts_ms, 1_730_000_000_500);
        assert_eq!(parsed.uid, None);
        assert_eq!(parsed.pid, Some(1234));
        assert_eq!(parsed.message, "[WARNING:x.cc(1)] slow");
    }

    #[test]
    fn keeps_runs_of_spaces_inside_the_message() {
        let parsed =
            header("     1730000000.200 10145: 4321  4321 I Table   : | id |  name     |  qty  |");
        assert_eq!(parsed.message, "| id |  name     |  qty  |");
        let indented = header("     1730000000.200 10145: 4321  4321 I Json    :     \"key\":   1");
        assert_eq!(indented.message, "    \"key\":   1");
    }

    #[test]
    fn keeps_an_empty_message() {
        let parsed = header("     1730000000.200 10145: 4321  4321 I Empty   : ");
        assert_eq!(parsed.tag, "Empty");
        assert_eq!(parsed.message, "");
    }

    #[test]
    fn maps_assert_to_fatal_and_rejects_unknown_levels() {
        assert_eq!(header("1730000000.000 1 1 A libc: abort").level, 'F');
        assert!(parse_header("1730000000.000 1 1 X libc: abort").is_none());
        assert!(parse_header("11-06 10:00:00.000 1 1 I tag: old format").is_none());
    }

    #[test]
    fn reads_microsecond_and_nanosecond_fractions_as_milliseconds() {
        assert_eq!(parse_epoch_ms("1730000000.123456"), Some(1_730_000_000_123));
        assert_eq!(
            parse_epoch_ms("1730000000.123456789"),
            Some(1_730_000_000_123)
        );
        assert_eq!(parse_epoch_ms("1730000000"), Some(1_730_000_000_000));
        assert_eq!(parse_epoch_ms("17x0"), None);
    }

    #[test]
    fn joins_the_lines_of_a_multi_line_message() {
        let mut assembler = LineAssembler::default();
        let mut entries = Vec::new();
        for line in CRASH.lines() {
            entries.extend(assembler.push(classify_line(line)));
        }
        entries.extend(assembler.flush());

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].tag, "AndroidRuntime");
        assert_eq!(
            entries[0].message,
            "FATAL EXCEPTION: main\nProcess: com.example.shop, PID: 12345\n\
             java.lang.IllegalStateException: boom\n\tat com.example.shop.Cart.add(Cart.kt:42)"
        );
        assert_eq!(entries[1].tag, "vold");
    }

    #[test]
    fn keeps_identical_lines_from_different_threads_apart() {
        let mut assembler = LineAssembler::default();
        let first = classify_line("1730000000.000 10145:100 101 W Net: retry");
        let second = classify_line("1730000000.000 10145:100 102 W Net: retry");
        assert!(assembler.push(first).is_none());
        let completed = assembler.push(second).expect("first entry completes");
        assert_eq!(completed.tid, Some(101));
        assert_eq!(assembler.flush().map(|entry| entry.tid), Some(Some(102)));
    }

    #[test]
    fn a_clock_that_went_back_still_parses_in_arrival_order() {
        let mut assembler = LineAssembler::default();
        let mut entries = Vec::new();
        for line in [
            "1730000100.000 10145:100 100 I App: before the change",
            "1730000040.000 10145:100 100 I App: after the clock went back",
            "1730000040.001 10145:100 100 I App: next",
        ] {
            entries.extend(assembler.push(classify_line(line)));
        }
        entries.extend(assembler.flush());
        let stamps: Vec<i64> = entries.iter().map(|entry| entry.ts_ms).collect();
        assert_eq!(
            stamps,
            vec![1_730_000_100_000, 1_730_000_040_000, 1_730_000_040_001]
        );
    }

    #[test]
    fn strips_carriage_returns_and_classifies_other_lines() {
        assert_eq!(
            classify_line("--------- beginning of main\r"),
            LogcatLine::Banner
        );
        assert_eq!(
            classify_line("logcat: Unknown -v format 'epoch'\r"),
            LogcatLine::Other("logcat: Unknown -v format 'epoch'".to_string())
        );
    }
}
