use std::collections::{HashMap, HashSet};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::Mutex;

use crate::commands::adb::adb_shell_command_inner;

/// First uid of an app (Android `FIRST_APPLICATION_UID`); uids below are system ones.
const FIRST_APP_UID: u32 = 10_000;
/// Uids are `user * 100_000 + app id`.
const PER_USER_RANGE: u32 = 100_000;
const MAX_REMEMBERED_PIDS: usize = 4_096;
const PROCESS_REFRESH: Duration = Duration::from_secs(1);
const PACKAGE_REFRESH: Duration = Duration::from_secs(10);

/// The process and app a log line came from.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct LineIdentity {
    pub process_name: Option<String>,
    pub package_name: Option<String>,
}

/// Parses `pm list packages -U`: `package:com.example uid:10145` per line.
pub(crate) fn parse_package_uids(output: &str) -> HashMap<u32, Vec<String>> {
    let mut by_app_id: HashMap<u32, Vec<String>> = HashMap::new();
    for line in output.lines() {
        let mut package = None;
        let mut uids = Vec::new();
        for part in line.split_whitespace() {
            if let Some(name) = part.strip_prefix("package:") {
                package = Some(name.to_string());
            } else if let Some(list) = part.strip_prefix("uid:") {
                uids.extend(
                    list.split(',')
                        .filter_map(|uid| uid.trim().parse::<u32>().ok()),
                );
            }
        }
        let Some(package) = package else { continue };
        for uid in uids {
            let packages = by_app_id.entry(uid % PER_USER_RANGE).or_default();
            if !packages.contains(&package) {
                packages.push(package.clone());
            }
        }
    }
    for packages in by_app_id.values_mut() {
        packages.sort();
    }
    by_app_id
}

/// Parses `ps -A -o PID,NAME` (or the older `ps` table) into pid to process name.
pub(crate) fn parse_process_names(output: &str) -> HashMap<u32, String> {
    let mut lines = output.lines();
    let Some(header) = lines.next() else {
        return HashMap::new();
    };
    let columns: Vec<&str> = header.split_whitespace().collect();
    let pid_column = columns
        .iter()
        .position(|column| *column == "PID")
        .unwrap_or(0);
    let name_last = columns.last().is_some_and(|column| *column == "NAME");

    lines
        .filter_map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let pid = fields.get(pid_column)?.parse::<u32>().ok()?;
            let name = if name_last {
                fields.last()?
            } else {
                fields.get(pid_column + 1)?
            };
            Some((pid, (*name).to_string()))
        })
        .collect()
}

fn package_of_process(process: &str) -> Option<&str> {
    let base = process.split(':').next()?;
    base.contains('.').then_some(base)
}

/// What the run knows about the device's processes and apps.
#[derive(Debug, Default)]
pub(crate) struct ProcessDirectory {
    packages_by_app_id: HashMap<u32, Vec<String>>,
    process_by_pid: HashMap<u32, String>,
    missing_pids: HashSet<u32>,
    missing_app_ids: HashSet<u32>,
}

impl ProcessDirectory {
    pub fn set_packages(&mut self, packages: HashMap<u32, Vec<String>>) {
        self.missing_app_ids
            .retain(|app_id| !packages.contains_key(app_id));
        self.packages_by_app_id = packages;
    }

    /// Merges a process snapshot. Names of processes that already ended are kept
    /// (a crash's last lines arrive after the process is gone) up to a cap.
    pub fn merge_processes(&mut self, processes: HashMap<u32, String>) {
        if self.process_by_pid.len() + processes.len() > MAX_REMEMBERED_PIDS {
            self.process_by_pid.clear();
        }
        self.missing_pids.retain(|pid| !processes.contains_key(pid));
        self.process_by_pid.extend(processes);
    }

    /// Labels a line. A uid survives app restarts, so the package comes from the
    /// uid whenever the line has one; the pid only adds the process name.
    pub fn identify(&mut self, uid: Option<u32>, pid: Option<u32>) -> LineIdentity {
        let process_name = pid.and_then(|pid| match self.process_by_pid.get(&pid) {
            Some(name) => Some(name.clone()),
            None => {
                self.missing_pids.insert(pid);
                None
            }
        });

        let app_packages = uid
            .filter(|uid| uid % PER_USER_RANGE >= FIRST_APP_UID)
            .map(|uid| uid % PER_USER_RANGE)
            .and_then(|app_id| match self.packages_by_app_id.get(&app_id) {
                Some(packages) => Some(packages),
                None => {
                    self.missing_app_ids.insert(app_id);
                    None
                }
            });

        let from_process = process_name.as_deref().and_then(package_of_process);
        let package_name = match (app_packages, from_process) {
            (Some(packages), Some(process)) if packages.iter().any(|name| name == process) => {
                Some(process.to_string())
            }
            (Some(packages), _) => packages.first().cloned(),
            (None, Some(process)) => Some(process.to_string()),
            (None, None) => None,
        };

        LineIdentity {
            process_name,
            package_name,
        }
    }

    fn wants_processes(&self) -> bool {
        !self.missing_pids.is_empty()
    }

    fn wants_packages(&self) -> bool {
        !self.missing_app_ids.is_empty()
    }
}

/// Keeps a run's [`ProcessDirectory`] fresh on its own thread, so lookups never
/// block the stream. The reader labels lines with what is known and nudges the
/// resolver when it meets a pid or app it does not know.
pub(crate) struct IdentityResolver {
    directory: Arc<Mutex<ProcessDirectory>>,
    nudge: Sender<()>,
}

fn refresh_packages(serial: &str, directory: &Mutex<ProcessDirectory>) {
    match adb_shell_command_inner(serial, "pm list packages -U") {
        Ok(output) => directory.lock().set_packages(parse_package_uids(&output)),
        Err(error) => log::warn!("[logcat] package list failed for {serial}: {error}"),
    }
}

fn refresh_processes(serial: &str, directory: &Mutex<ProcessDirectory>) {
    let output = adb_shell_command_inner(serial, "ps -A -o PID,NAME")
        .ok()
        .filter(|output| output.contains("PID"))
        .or_else(|| adb_shell_command_inner(serial, "ps").ok());
    match output {
        Some(output) => directory
            .lock()
            .merge_processes(parse_process_names(&output)),
        None => log::warn!("[logcat] process list failed for {serial}"),
    }
}

fn resolver_loop(serial: String, directory: Arc<Mutex<ProcessDirectory>>, nudges: Receiver<()>) {
    let mut processes_at = Instant::now();
    let mut packages_at = Instant::now();
    loop {
        match nudges.recv_timeout(PROCESS_REFRESH) {
            Ok(()) | Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return,
        }
        while nudges.try_recv().is_ok() {}
        let (wants_processes, wants_packages) = {
            let directory = directory.lock();
            (directory.wants_processes(), directory.wants_packages())
        };
        if wants_processes && processes_at.elapsed() >= PROCESS_REFRESH {
            refresh_processes(&serial, &directory);
            processes_at = Instant::now();
        }
        if wants_packages && packages_at.elapsed() >= PACKAGE_REFRESH {
            refresh_packages(&serial, &directory);
            packages_at = Instant::now();
        }
    }
}

impl IdentityResolver {
    /// Loads the package and process lists once, then refreshes them on demand
    /// on a background thread that ends when the resolver is dropped.
    pub fn start(serial: &str) -> Self {
        let directory = Arc::new(Mutex::new(ProcessDirectory::default()));
        refresh_packages(serial, &directory);
        refresh_processes(serial, &directory);

        let (nudge, nudges) = mpsc::channel();
        let thread_directory = directory.clone();
        let thread_serial = serial.to_string();
        let spawned = std::thread::Builder::new()
            .name(format!("logcat-identity-{serial}"))
            .spawn(move || resolver_loop(thread_serial, thread_directory, nudges));
        if let Err(error) = spawned {
            log::warn!("[logcat] identity refresh thread failed to start: {error}");
        }
        Self { directory, nudge }
    }

    pub fn identify(&self, uid: Option<u32>, pid: Option<u32>) -> LineIdentity {
        let mut directory = self.directory.lock();
        let identity = directory.identify(uid, pid);
        if directory.wants_processes() || directory.wants_packages() {
            let _ = self.nudge.send(());
        }
        identity
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PACKAGES: &str = "package:com.example.shop uid:10145\n\
        package:com.android.systemui uid:10101\n\
        package:com.android.providers.telephony uid:1001\n\
        package:com.android.phone uid:1001\n\
        package:com.example.shared.b uid:10200\n\
        package:com.example.shared.a uid:10200\n";

    const PS: &str =
        "  PID NAME\n    1 init\n  612 vold\n12345 com.example.shop\n12399 com.example.shop:sync\n";

    const OLD_PS: &str = "USER     PID   PPID  VSIZE  RSS     WCHAN    PC         NAME\n\
        root      1     0     8904   788   ffffffff 00000000 S /init\n\
        u0_a145   4321  180   1234   567   ffffffff 00000000 S com.example.shop\n";

    fn directory() -> ProcessDirectory {
        let mut directory = ProcessDirectory::default();
        directory.set_packages(parse_package_uids(PACKAGES));
        directory.merge_processes(parse_process_names(PS));
        directory
    }

    #[test]
    fn parses_package_uids_by_app_id() {
        let packages = parse_package_uids(PACKAGES);
        assert_eq!(
            packages.get(&10145),
            Some(&vec!["com.example.shop".to_string()])
        );
        assert_eq!(packages.get(&1001).map(Vec::len), Some(2));
        assert_eq!(
            packages.get(&10200),
            Some(&vec![
                "com.example.shared.a".to_string(),
                "com.example.shared.b".to_string()
            ])
        );
    }

    #[test]
    fn parses_both_ps_layouts() {
        let modern = parse_process_names(PS);
        assert_eq!(
            modern.get(&12399).map(String::as_str),
            Some("com.example.shop:sync")
        );
        let old = parse_process_names(OLD_PS);
        assert_eq!(old.get(&4321).map(String::as_str), Some("com.example.shop"));
    }

    #[test]
    fn a_line_from_a_live_app_process_gets_its_process_and_package() {
        let identity = directory().identify(Some(10145), Some(12399));
        assert_eq!(
            identity.process_name.as_deref(),
            Some("com.example.shop:sync")
        );
        assert_eq!(identity.package_name.as_deref(), Some("com.example.shop"));
    }

    #[test]
    fn a_crash_after_the_process_died_keeps_its_app_from_the_uid() {
        let mut directory = directory();
        let identity = directory.identify(Some(10145), Some(23456));
        assert_eq!(identity.process_name, None);
        assert_eq!(identity.package_name.as_deref(), Some("com.example.shop"));
        assert!(directory.wants_processes());
    }

    #[test]
    fn a_second_user_maps_to_the_same_app() {
        let identity = directory().identify(Some(1_010_145), None);
        assert_eq!(identity.package_name.as_deref(), Some("com.example.shop"));
    }

    #[test]
    fn system_uids_take_the_package_from_the_process_only() {
        let mut directory = directory();
        assert_eq!(directory.identify(Some(0), Some(612)).package_name, None);
        assert_eq!(
            directory
                .identify(Some(1001), Some(12345))
                .package_name
                .as_deref(),
            Some("com.example.shop")
        );
    }

    #[test]
    fn an_unknown_app_uid_asks_for_a_package_refresh() {
        let mut directory = directory();
        assert_eq!(directory.identify(Some(10999), None).package_name, None);
        assert!(directory.wants_packages());
        directory.set_packages(parse_package_uids("package:com.example.new uid:10999\n"));
        assert!(!directory.wants_packages());
        assert_eq!(
            directory
                .identify(Some(10999), None)
                .package_name
                .as_deref(),
            Some("com.example.new")
        );
    }

    #[test]
    fn ended_processes_are_remembered_until_the_cap() {
        let mut directory = directory();
        directory.merge_processes(parse_process_names("PID NAME\n  1 init\n"));
        assert_eq!(
            directory
                .identify(None, Some(12345))
                .process_name
                .as_deref(),
            Some("com.example.shop")
        );
        let flood: HashMap<u32, String> = (0..MAX_REMEMBERED_PIDS as u32)
            .map(|pid| (100_000 + pid, format!("p{pid}")))
            .collect();
        directory.merge_processes(flood);
        assert_eq!(directory.identify(None, Some(12345)).process_name, None);
    }
}
