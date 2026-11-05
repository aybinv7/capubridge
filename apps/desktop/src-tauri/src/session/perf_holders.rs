use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use parking_lot::Mutex;

/// Holder name used when a caller does not identify itself.
pub(crate) const DEFAULT_PERF_HOLDER: &str = "default";

/// Who currently needs the perf stream of each device. The stream starts with
/// the first holder and stops only when the last one lets go.
#[derive(Debug, Default)]
pub(crate) struct PerfHolders {
    by_serial: HashMap<String, HashSet<String>>,
}

/// Result of releasing one holder.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PerfRelease {
    pub stop_session: bool,
    pub still_held: bool,
}

impl PerfHolders {
    /// Adds `holder` for `serial` and says whether the perf session must be
    /// started: only for the first holder, or when no session is running anymore.
    pub fn acquire(&mut self, serial: &str, holder: &str, session_running: bool) -> bool {
        let holders = self.by_serial.entry(serial.to_string()).or_default();
        let was_empty = holders.is_empty();
        holders.insert(holder.to_string());
        was_empty || !session_running
    }

    /// Removes `holder` for `serial`; the session stops only once nobody holds it.
    pub fn release(&mut self, serial: &str, holder: &str) -> PerfRelease {
        let Some(holders) = self.by_serial.get_mut(serial) else {
            return PerfRelease {
                stop_session: true,
                still_held: false,
            };
        };
        holders.remove(holder);
        if holders.is_empty() {
            self.by_serial.remove(serial);
            return PerfRelease {
                stop_session: true,
                still_held: false,
            };
        }
        PerfRelease {
            stop_session: false,
            still_held: true,
        }
    }

    /// Forgets every holder of `serial`, for a session that ended on its own.
    pub fn clear(&mut self, serial: &str) {
        self.by_serial.remove(serial);
    }

    #[cfg(test)]
    pub fn is_held(&self, serial: &str) -> bool {
        self.by_serial
            .get(serial)
            .is_some_and(|holders| !holders.is_empty())
    }
}

/// Process-wide perf holder table shared by the perf lease commands.
pub(crate) static PERF_HOLDERS: LazyLock<Mutex<PerfHolders>> =
    LazyLock::new(|| Mutex::new(PerfHolders::default()));

/// Normalises an optional holder name from IPC, falling back to [`DEFAULT_PERF_HOLDER`].
pub(crate) fn holder_name(holder: Option<String>) -> String {
    holder
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| DEFAULT_PERF_HOLDER.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SERIAL: &str = "emulator-5554";

    #[test]
    fn first_acquire_starts_and_second_does_not() {
        let mut holders = PerfHolders::default();
        assert!(holders.acquire(SERIAL, "device-vitals", false));
        assert!(!holders.acquire(SERIAL, "recording", true));
        assert!(!holders.acquire(SERIAL, "device-vitals", true));
        assert!(holders.is_held(SERIAL));
    }

    #[test]
    fn second_acquire_restarts_a_session_that_died() {
        let mut holders = PerfHolders::default();
        holders.acquire(SERIAL, "device-vitals", false);
        assert!(holders.acquire(SERIAL, "recording", false));
    }

    #[test]
    fn first_release_keeps_the_stream_and_last_release_stops_it() {
        let mut holders = PerfHolders::default();
        holders.acquire(SERIAL, "device-vitals", false);
        holders.acquire(SERIAL, "recording", true);

        let first = holders.release(SERIAL, "device-vitals");
        assert_eq!(
            first,
            PerfRelease {
                stop_session: false,
                still_held: true
            }
        );

        let unknown = holders.release(SERIAL, "someone-else");
        assert!(unknown.still_held && !unknown.stop_session);

        let last = holders.release(SERIAL, "recording");
        assert_eq!(
            last,
            PerfRelease {
                stop_session: true,
                still_held: false
            }
        );
        assert!(!holders.is_held(SERIAL));
    }

    #[test]
    fn release_without_holders_stops_whatever_runs() {
        let mut holders = PerfHolders::default();
        let release = holders.release(SERIAL, DEFAULT_PERF_HOLDER);
        assert!(release.stop_session && !release.still_held);
    }

    #[test]
    fn self_stop_clears_every_holder() {
        let mut holders = PerfHolders::default();
        holders.acquire(SERIAL, "device-vitals", false);
        holders.acquire(SERIAL, "recording", true);
        holders.acquire("other", "recording", false);
        holders.clear(SERIAL);
        assert!(!holders.is_held(SERIAL));
        assert!(holders.is_held("other"));
        assert!(holders.acquire(SERIAL, "recording", false));
    }

    #[test]
    fn holder_names_default_when_missing_or_blank() {
        assert_eq!(holder_name(None), DEFAULT_PERF_HOLDER);
        assert_eq!(holder_name(Some("  ".to_string())), DEFAULT_PERF_HOLDER);
        assert_eq!(holder_name(Some(" recording ".to_string())), "recording");
    }
}
