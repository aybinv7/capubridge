use adb_client::ADBDeviceExt;
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::commands::adb::{adb_shell_command_inner, catch_adb_panic, get_adb_device};
use crate::commands::logcat::leases::LogcatRun;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogcatEntryPayload {
    pub id: String,
    pub serial: String,
    pub date: String,
    pub time: String,
    pub pid: Option<u32>,
    pub tid: Option<u32>,
    pub level: String,
    pub tag: String,
    pub process_name: Option<String>,
    pub package_name: Option<String>,
    pub message: String,
    pub raw: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogcatErrorPayload {
    pub serial: String,
    pub message: String,
}

struct PendingLogcatEntry {
    date: String,
    time: String,
    pid: Option<u32>,
    tid: Option<u32>,
    level: String,
    tag: String,
    message: String,
    raw: String,
}

impl PendingLogcatEntry {
    fn into_payload(
        self,
        serial: &str,
        process_name: Option<String>,
        package_name: Option<String>,
    ) -> LogcatEntryPayload {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        serial.hash(&mut hasher);
        self.date.hash(&mut hasher);
        self.time.hash(&mut hasher);
        self.pid.hash(&mut hasher);
        self.tid.hash(&mut hasher);
        self.level.hash(&mut hasher);
        self.tag.hash(&mut hasher);
        self.raw.hash(&mut hasher);

        LogcatEntryPayload {
            id: format!("{serial}:{:x}", hasher.finish()),
            serial: serial.to_string(),
            date: self.date,
            time: self.time,
            pid: self.pid,
            tid: self.tid,
            level: self.level,
            tag: self.tag,
            process_name,
            package_name,
            message: self.message,
            raw: self.raw,
        }
    }
}

#[derive(Clone)]
struct LogcatProcessIdentity {
    process_name: Option<String>,
    package_name: Option<String>,
}

fn normalize_logcat_level(level: char) -> Option<String> {
    match level {
        'V' | 'D' | 'I' | 'W' | 'E' | 'F' => Some(level.to_string()),
        'A' => Some("F".to_string()),
        _ => None,
    }
}

fn parse_logcat_header(line: &str) -> Option<PendingLogcatEntry> {
    let mut parts = line.split_whitespace();
    let date = parts.next()?.to_string();
    let time = parts.next()?.to_string();
    let pid = parts.next()?.parse::<u32>().ok();
    let tid = parts.next()?.parse::<u32>().ok();
    let level = normalize_logcat_level(parts.next()?.chars().next()?)?;
    let remainder = parts.collect::<Vec<_>>().join(" ");
    let split = remainder.find(':')?;
    let tag = remainder[..split].trim().to_string();
    if tag.is_empty() {
        return None;
    }

    Some(PendingLogcatEntry {
        date,
        time,
        pid,
        tid,
        level,
        tag,
        message: remainder[split + 1..].trim_start().to_string(),
        raw: line.to_string(),
    })
}

fn resolve_logcat_identity(
    serial: &str,
    pid_cache: &mut HashMap<u32, LogcatProcessIdentity>,
    pid: Option<u32>,
) -> LogcatProcessIdentity {
    let Some(pid) = pid else {
        return LogcatProcessIdentity {
            process_name: None,
            package_name: None,
        };
    };

    if let Some(identity) = pid_cache.get(&pid) {
        return identity.clone();
    }

    let serial_owned = serial.to_string();
    let identity = catch_adb_panic("logcat_pid_identity", move || {
        let cmd = format!("cat /proc/{pid}/cmdline 2>/dev/null");
        let process_name = adb_shell_command_inner(&serial_owned, &cmd)
            .unwrap_or_default()
            .replace('\0', "")
            .trim()
            .to_string();
        let normalized_process = if process_name.is_empty() {
            None
        } else {
            Some(process_name)
        };
        let package_name = normalized_process
            .as_deref()
            .and_then(|value| value.split(':').next())
            .and_then(|value| {
                if value.contains('.') {
                    Some(value.to_string())
                } else {
                    None
                }
            });
        Ok(LogcatProcessIdentity {
            process_name: normalized_process,
            package_name,
        })
    });

    let resolved = identity.unwrap_or(LogcatProcessIdentity {
        process_name: None,
        package_name: None,
    });
    pid_cache.insert(pid, resolved.clone());
    resolved
}

fn parse_logcat_dump(
    serial: &str,
    dump: &str,
    pid_cache: &mut HashMap<u32, LogcatProcessIdentity>,
) -> Vec<LogcatEntryPayload> {
    let mut entries = Vec::new();
    let mut current: Option<PendingLogcatEntry> = None;

    for raw_line in dump.lines() {
        let line = raw_line.trim_end_matches('\r');
        if let Some(next_entry) = parse_logcat_header(line) {
            if let Some(entry) = current.take() {
                let identity = resolve_logcat_identity(serial, pid_cache, entry.pid);
                entries.push(entry.into_payload(
                    serial,
                    identity.process_name,
                    identity.package_name,
                ));
            }
            current = Some(next_entry);
            continue;
        }

        if let Some(entry) = current.as_mut() {
            let extra = line.trim();
            if !extra.is_empty() {
                entry.message.push('\n');
                entry.message.push_str(extra);
                entry.raw.push('\n');
                entry.raw.push_str(line);
            }
        }
    }

    if let Some(entry) = current {
        let identity = resolve_logcat_identity(serial, pid_cache, entry.pid);
        entries.push(entry.into_payload(serial, identity.process_name, identity.package_name));
    }

    entries
}

fn read_logcat_dump(
    serial: &str,
    since: Option<&str>,
    pid_cache: &mut HashMap<u32, LogcatProcessIdentity>,
) -> Result<Vec<LogcatEntryPayload>, String> {
    let serial_owned = serial.to_string();
    let dump = catch_adb_panic("start_logcat", move || {
        let mut device = get_adb_device(&serial_owned)?;
        let mut output = Vec::new();
        let command = since
            .map(|cursor| format!("logcat -d -v threadtime -T '{cursor}'"))
            .unwrap_or_else(|| "logcat -d -v threadtime -t 256".to_string());
        device
            .shell_command(&command, Some(&mut output), None::<&mut dyn Write>)
            .map_err(|e| format!("Logcat failed: {e}"))?;
        Ok(String::from_utf8_lossy(&output).into_owned())
    })?;

    Ok(parse_logcat_dump(serial, &dump, pid_cache))
}

/// Callbacks a capture run reports through.
pub(crate) struct LogcatCallbacks {
    pub on_entry: Box<dyn Fn(LogcatEntryPayload) + Send>,
    pub on_error: Box<dyn Fn(LogcatErrorPayload) + Send>,
    pub on_stopped: Box<dyn Fn(String, u64) + Send>,
}

/// Polls the device's logcat on a background thread until `run` is stopped.
pub(crate) fn spawn_logcat_run(serial: String, run: LogcatRun, callbacks: LogcatCallbacks) {
    std::thread::spawn(move || {
        let mut seen = HashSet::new();
        let mut order = VecDeque::new();
        let mut pid_cache = HashMap::new();
        let mut cursor: Option<String> = None;

        while !run.is_stopped() {
            match read_logcat_dump(&serial, cursor.as_deref(), &mut pid_cache) {
                Ok(entries) => {
                    for entry in entries {
                        if run.is_stopped() {
                            break;
                        }
                        cursor = Some(format!("{} {}", entry.date, entry.time));
                        if !seen.insert(entry.id.clone()) {
                            continue;
                        }
                        if order.len() >= 1024 {
                            if let Some(old_id) = order.pop_front() {
                                seen.remove(&old_id);
                            }
                        }
                        order.push_back(entry.id.clone());
                        (callbacks.on_entry)(entry);
                    }
                }
                Err(message) => {
                    if !run.is_stopped() {
                        (callbacks.on_error)(LogcatErrorPayload {
                            serial: serial.clone(),
                            message,
                        });
                    }
                    break;
                }
            }

            std::thread::sleep(Duration::from_millis(900));
        }

        (callbacks.on_stopped)(serial, run.generation);
    });
}
