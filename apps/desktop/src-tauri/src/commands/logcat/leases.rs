use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock};

use parking_lot::Mutex;

/// Holder used when a caller does not name itself.
pub(crate) const DEFAULT_LOGCAT_HOLDER: &str = "default";

/// One capture run of a device. A new run gets a new generation, so callbacks
/// from a run that was replaced can tell they are stale.
#[derive(Debug, Clone)]
pub(crate) struct LogcatRun {
    pub generation: u64,
    pub stop: Arc<AtomicBool>,
}

impl LogcatRun {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
    }

    pub fn is_stopped(&self) -> bool {
        self.stop.load(Ordering::Relaxed)
    }
}

#[derive(Debug, Default)]
struct DeviceLease {
    holders: HashSet<String>,
    run: Option<LogcatRun>,
}

/// What a caller must do after taking a lease.
#[derive(Debug)]
pub(crate) enum LogcatAcquire {
    /// Start a new run with this handle. `replaced` is a run that must be stopped first.
    Start {
        run: LogcatRun,
        replaced: Option<LogcatRun>,
    },
    /// A run is already live; the holder shares it.
    Joined { generation: u64 },
}

/// Result of releasing one holder.
#[derive(Debug)]
pub(crate) struct LogcatRelease {
    pub stopped: Option<LogcatRun>,
    pub still_held: bool,
}

/// Who holds each device's logcat capture. One run per device, any number of
/// holders; the run starts with the first holder and stops with the last.
#[derive(Debug, Default)]
pub(crate) struct LogcatLeases {
    by_serial: HashMap<String, DeviceLease>,
    next_generation: u64,
}

impl LogcatLeases {
    fn new_run(&mut self) -> LogcatRun {
        self.next_generation += 1;
        LogcatRun {
            generation: self.next_generation,
            stop: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Adds `holder` for `serial`. A run starts when none is live, or when
    /// `restart` asks for a fresh one; otherwise the holder joins the live run.
    pub fn acquire(&mut self, serial: &str, holder: &str, restart: bool) -> LogcatAcquire {
        let joined = {
            let lease = self.by_serial.entry(serial.to_string()).or_default();
            lease.holders.insert(holder.to_string());
            match lease.run.as_ref() {
                Some(run) if !restart && !run.is_stopped() => Some(run.generation),
                _ => None,
            }
        };
        if let Some(generation) = joined {
            return LogcatAcquire::Joined { generation };
        }
        let run = self.new_run();
        let lease = self.by_serial.entry(serial.to_string()).or_default();
        let replaced = lease.run.replace(run.clone());
        LogcatAcquire::Start { run, replaced }
    }

    /// Removes `holder`; the run is handed back to be stopped once nobody holds it.
    pub fn release(&mut self, serial: &str, holder: &str) -> LogcatRelease {
        let Some(lease) = self.by_serial.get_mut(serial) else {
            return LogcatRelease {
                stopped: None,
                still_held: false,
            };
        };
        lease.holders.remove(holder);
        if !lease.holders.is_empty() {
            return LogcatRelease {
                stopped: None,
                still_held: true,
            };
        }
        let stopped = self.by_serial.remove(serial).and_then(|lease| lease.run);
        LogcatRelease {
            stopped,
            still_held: false,
        }
    }

    /// Removes `holder` from every device, for a window that closed without releasing.
    pub fn release_everywhere(&mut self, holder: &str) -> Vec<(String, LogcatRelease)> {
        let serials: Vec<String> = self
            .by_serial
            .iter()
            .filter(|(_, lease)| lease.holders.contains(holder))
            .map(|(serial, _)| serial.clone())
            .collect();
        serials
            .into_iter()
            .map(|serial| {
                let release = self.release(&serial, holder);
                (serial, release)
            })
            .collect()
    }

    /// Whether `generation` is still the run that owns `serial`.
    pub fn is_current(&self, serial: &str, generation: u64) -> bool {
        self.by_serial
            .get(serial)
            .and_then(|lease| lease.run.as_ref())
            .is_some_and(|run| run.generation == generation && !run.is_stopped())
    }

    /// Records that run `generation` ended on its own. Returns true only when it
    /// was the current run, so a stale run never changes the device's state.
    pub fn ended(&mut self, serial: &str, generation: u64) -> bool {
        let Some(lease) = self.by_serial.get_mut(serial) else {
            return false;
        };
        let current = lease
            .run
            .as_ref()
            .is_some_and(|run| run.generation == generation);
        if current {
            lease.run = None;
        }
        current
    }

    pub fn is_held(&self, serial: &str) -> bool {
        self.by_serial
            .get(serial)
            .is_some_and(|lease| !lease.holders.is_empty())
    }

    /// Every holder of `serial`, for diagnostics and tests.
    #[cfg(test)]
    pub fn holders(&self, serial: &str) -> Vec<String> {
        let mut holders: Vec<String> = self
            .by_serial
            .get(serial)
            .map(|lease| lease.holders.iter().cloned().collect())
            .unwrap_or_default();
        holders.sort();
        holders
    }
}

/// Process-wide logcat lease table.
pub(crate) static LOGCAT_LEASES: LazyLock<Mutex<LogcatLeases>> =
    LazyLock::new(|| Mutex::new(LogcatLeases::default()));

/// Normalises an optional holder name, falling back to [`DEFAULT_LOGCAT_HOLDER`].
pub(crate) fn logcat_holder_name(holder: Option<String>) -> String {
    holder
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| DEFAULT_LOGCAT_HOLDER.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SERIAL: &str = "emulator-5554";

    fn started(outcome: LogcatAcquire) -> (LogcatRun, Option<LogcatRun>) {
        match outcome {
            LogcatAcquire::Start { run, replaced } => (run, replaced),
            LogcatAcquire::Joined { .. } => panic!("expected a new run"),
        }
    }

    #[test]
    fn first_holder_starts_and_later_holders_join() {
        let mut leases = LogcatLeases::default();
        let (run, replaced) = started(leases.acquire(SERIAL, "main", false));
        assert!(replaced.is_none());
        match leases.acquire(SERIAL, "dock-logcat", false) {
            LogcatAcquire::Joined { generation } => assert_eq!(generation, run.generation),
            LogcatAcquire::Start { .. } => panic!("second holder must join"),
        }
        assert_eq!(leases.holders(SERIAL), vec!["dock-logcat", "main"]);
    }

    #[test]
    fn the_run_stops_only_with_the_last_holder() {
        let mut leases = LogcatLeases::default();
        let (run, _) = started(leases.acquire(SERIAL, "main", false));
        leases.acquire(SERIAL, "dock-logcat", false);

        let first = leases.release(SERIAL, "main");
        assert!(first.still_held && first.stopped.is_none());

        let last = leases.release(SERIAL, "dock-logcat");
        assert!(!last.still_held);
        assert_eq!(
            last.stopped.map(|stopped| stopped.generation),
            Some(run.generation)
        );
        assert!(!leases.is_held(SERIAL));
    }

    #[test]
    fn restart_replaces_the_run_and_keeps_holders() {
        let mut leases = LogcatLeases::default();
        let (first, _) = started(leases.acquire(SERIAL, "main", false));
        leases.acquire(SERIAL, "dock-logcat", false);
        let (second, replaced) = started(leases.acquire(SERIAL, "main", true));
        assert_eq!(replaced.map(|run| run.generation), Some(first.generation));
        assert!(second.generation > first.generation);
        assert_eq!(leases.holders(SERIAL).len(), 2);
    }

    #[test]
    fn a_stale_run_ending_changes_nothing() {
        let mut leases = LogcatLeases::default();
        let (first, _) = started(leases.acquire(SERIAL, "main", false));
        let (second, _) = started(leases.acquire(SERIAL, "main", true));
        assert!(!leases.ended(SERIAL, first.generation));
        assert!(leases.is_current(SERIAL, second.generation));
        assert!(leases.ended(SERIAL, second.generation));
        assert!(!leases.is_current(SERIAL, second.generation));
        assert!(leases.is_held(SERIAL));
    }

    #[test]
    fn a_holder_after_a_run_ended_starts_a_new_one() {
        let mut leases = LogcatLeases::default();
        let (first, _) = started(leases.acquire(SERIAL, "main", false));
        leases.ended(SERIAL, first.generation);
        let (second, replaced) = started(leases.acquire(SERIAL, "dock-logcat", false));
        assert!(replaced.is_none());
        assert!(second.generation > first.generation);
    }

    #[test]
    fn a_stopped_run_is_not_joined() {
        let mut leases = LogcatLeases::default();
        let (first, _) = started(leases.acquire(SERIAL, "main", false));
        first.stop();
        let (second, _) = started(leases.acquire(SERIAL, "main", false));
        assert_ne!(second.generation, first.generation);
    }

    #[test]
    fn a_closed_window_lets_go_of_every_device() {
        let mut leases = LogcatLeases::default();
        leases.acquire(SERIAL, "dock-logcat", false);
        leases.acquire(SERIAL, "main", false);
        leases.acquire("other", "dock-logcat", false);
        let released = leases.release_everywhere("dock-logcat");
        assert_eq!(released.len(), 2);
        assert!(leases.is_held(SERIAL));
        assert!(!leases.is_held("other"));
    }

    #[test]
    fn releasing_an_unknown_device_is_harmless() {
        let mut leases = LogcatLeases::default();
        let release = leases.release(SERIAL, "main");
        assert!(release.stopped.is_none() && !release.still_held);
    }

    #[test]
    fn holder_names_default_when_missing_or_blank() {
        assert_eq!(logcat_holder_name(None), DEFAULT_LOGCAT_HOLDER);
        assert_eq!(
            logcat_holder_name(Some(" ".to_string())),
            DEFAULT_LOGCAT_HOLDER
        );
        assert_eq!(logcat_holder_name(Some(" main ".to_string())), "main");
    }
}
