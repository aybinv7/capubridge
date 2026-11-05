use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};

use adb_client::{server_device::ADBServerDevice, ADBDeviceExt};
use parking_lot::Mutex;
use serde_json::Value;

/// How long one `dumpsys diskstats` snapshot answers size lookups for a device.
const DISKSTATS_TTL: Duration = Duration::from_secs(60);

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct PackageDiskStats {
    pub app_size: u64,
    pub data_size: u64,
    pub cache_size: u64,
}

fn parse_json_string_array(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw.trim()).unwrap_or_default()
}

fn parse_json_u64_array(raw: &str) -> Vec<u64> {
    serde_json::from_str::<Vec<Value>>(raw.trim())
        .map(|values| {
            values
                .into_iter()
                .map(|value| match value {
                    Value::Number(number) => number.as_u64().unwrap_or(0),
                    Value::String(string) => string.parse::<u64>().unwrap_or(0),
                    _ => 0,
                })
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn parse_diskstats(output: &str) -> HashMap<String, PackageDiskStats> {
    let mut package_names = Vec::new();
    let mut app_sizes = Vec::new();
    let mut data_sizes = Vec::new();
    let mut cache_sizes = Vec::new();

    for line in output.lines().map(str::trim) {
        if let Some(rest) = line.strip_prefix("Package Names:") {
            package_names = parse_json_string_array(rest);
        } else if let Some(rest) = line.strip_prefix("App Sizes:") {
            app_sizes = parse_json_u64_array(rest);
        } else if let Some(rest) = line.strip_prefix("App Data Sizes:") {
            data_sizes = parse_json_u64_array(rest);
        } else if let Some(rest) = line.strip_prefix("Cache Sizes:") {
            cache_sizes = parse_json_u64_array(rest);
        }
    }

    package_names
        .into_iter()
        .enumerate()
        .map(|(index, package_name)| {
            let size_at = |sizes: &[u64]| sizes.get(index).copied().unwrap_or(0);
            (
                package_name,
                PackageDiskStats {
                    app_size: size_at(&app_sizes),
                    data_size: size_at(&data_sizes),
                    cache_size: size_at(&cache_sizes),
                },
            )
        })
        .collect()
}

/// One device's parsed diskstats snapshot and when it was taken.
#[derive(Debug, Default)]
pub(crate) struct DiskstatsSlot {
    fetched_at: Option<Instant>,
    stats: HashMap<String, PackageDiskStats>,
}

impl DiskstatsSlot {
    fn is_fresh(&self, now: Instant) -> bool {
        self.fetched_at
            .is_some_and(|fetched_at| now.saturating_duration_since(fetched_at) < DISKSTATS_TTL)
    }

    /// Answers from the snapshot while it is fresh, otherwise runs `fetch` and
    /// replaces it. An empty snapshot is not kept, so a failed read retries next time.
    pub fn lookup(
        &mut self,
        package: &str,
        now: Instant,
        fetch: impl FnOnce() -> String,
    ) -> PackageDiskStats {
        if !self.is_fresh(now) {
            let stats = parse_diskstats(&fetch());
            if stats.is_empty() {
                self.fetched_at = None;
            } else {
                self.fetched_at = Some(now);
            }
            self.stats = stats;
        }
        self.stats.get(package).cloned().unwrap_or_default()
    }
}

static DISKSTATS_CACHE: LazyLock<Mutex<HashMap<String, Arc<Mutex<DiskstatsSlot>>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn slot_for(serial: &str) -> Arc<Mutex<DiskstatsSlot>> {
    DISKSTATS_CACHE
        .lock()
        .entry(serial.to_string())
        .or_default()
        .clone()
}

/// Sizes of `package` on `serial`, read from a per-device `dumpsys diskstats`
/// snapshot refreshed at most once per minute. Concurrent lookups for the same
/// device wait for one refresh instead of each running the slow dump.
pub(crate) fn package_sizes(
    serial: &str,
    device: &mut ADBServerDevice,
    package: &str,
) -> PackageDiskStats {
    let slot = slot_for(serial);
    let mut slot = slot.lock();
    slot.lookup(package, Instant::now(), || {
        let mut output = Vec::new();
        let _ = device.shell_command(
            &"dumpsys diskstats 2>/dev/null",
            Some(&mut output),
            None::<&mut dyn Write>,
        );
        String::from_utf8_lossy(&output).to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    const DISKSTATS: &str = "Latency: 2ms [512B Data Write]\nData-Free: 1000K / 2000K total = 50% free\nPackage Names: [\"com.example.app\",\"com.other\"]\nApp Sizes: [1024,\"2048\"]\nApp Data Sizes: [10,20]\nCache Sizes: [5]\n";

    #[test]
    fn parses_diskstats_arrays_by_index() {
        let stats = parse_diskstats(DISKSTATS);
        assert_eq!(
            stats["com.example.app"],
            PackageDiskStats {
                app_size: 1024,
                data_size: 10,
                cache_size: 5
            }
        );
        assert_eq!(
            stats["com.other"],
            PackageDiskStats {
                app_size: 2048,
                data_size: 20,
                cache_size: 0
            }
        );
        assert!(parse_diskstats("garbage").is_empty());
    }

    #[test]
    fn snapshot_is_reused_within_ttl_and_refreshed_after() {
        let fetches = Cell::new(0);
        let fetch = || {
            fetches.set(fetches.get() + 1);
            DISKSTATS.to_string()
        };
        let start = Instant::now();
        let mut slot = DiskstatsSlot::default();

        assert_eq!(slot.lookup("com.example.app", start, fetch).app_size, 1024);
        assert_eq!(fetches.get(), 1);

        let within = start + Duration::from_secs(59);
        assert_eq!(slot.lookup("com.other", within, fetch).data_size, 20);
        assert_eq!(
            slot.lookup("com.missing", within, fetch),
            PackageDiskStats::default()
        );
        assert_eq!(fetches.get(), 1);

        slot.lookup("com.example.app", start + DISKSTATS_TTL, fetch);
        assert_eq!(fetches.get(), 2);
    }

    #[test]
    fn empty_snapshot_is_not_cached() {
        let fetches = Cell::new(0);
        let start = Instant::now();
        let mut slot = DiskstatsSlot::default();
        let empty = || {
            fetches.set(fetches.get() + 1);
            String::new()
        };
        slot.lookup("com.example.app", start, empty);
        slot.lookup("com.example.app", start, empty);
        assert_eq!(fetches.get(), 2);
    }
}
