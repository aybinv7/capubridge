use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub(super) const STAT_MARKER: &str = "__CB_STAT__";
pub(super) const MEM_MARKER: &str = "__CB_MEM__";
pub(super) const NET_MARKER: &str = "__CB_NET__";
pub(super) const TEMP_MARKER: &str = "__CB_TEMP__";
pub(super) const BATTERY_MARKER: &str = "__CB_BAT__";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CpuCoreMetric {
    pub core: u32,
    pub usage: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MemMetric {
    pub total_kb: u64,
    pub available_kb: u64,
    pub used_kb: u64,
    pub used_pct: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetMetric {
    pub rx_bps: f64,
    pub tx_bps: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatteryMetric {
    pub level: Option<u32>,
    pub temperature: Option<f32>,
    pub charging: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PerfMetrics {
    pub cpu_cores: Vec<CpuCoreMetric>,
    pub cpu_total: f32,
    pub memory: MemMetric,
    pub network: NetMetric,
    pub battery: BatteryMetric,
    pub cpu_temp: Option<f32>,
    pub cpu_temp_source: Option<String>,
    pub timestamp: u64,
}

/// Output of one combined sampling shell, split by the `__CB_*__` marker lines.
/// A section is `None` when its marker never appeared in the output.
#[derive(Debug, Default, PartialEq)]
pub(super) struct SampleSections {
    pub stat: Option<String>,
    pub meminfo: Option<String>,
    pub net_dev: Option<String>,
    pub temp: Option<String>,
    pub battery: Option<String>,
}

/// Builds the single shell command that dumps `/proc/stat`, `/proc/meminfo` and
/// `/proc/net/dev`, optionally followed by a temperature probe and `dumpsys battery`.
pub(super) fn sample_command(temp_probe: Option<&str>, include_battery: bool) -> String {
    let mut command = format!(
        "echo {STAT_MARKER}; cat /proc/stat; echo {MEM_MARKER}; cat /proc/meminfo; echo {NET_MARKER}; cat /proc/net/dev"
    );
    if let Some(probe) = temp_probe {
        command.push_str(&format!("; echo {TEMP_MARKER}; {{ {probe}; }}"));
    }
    if include_battery {
        command.push_str(&format!("; echo {BATTERY_MARKER}; dumpsys battery"));
    }
    command
}

/// Splits the combined sampling output into its sections. Lines before the first
/// marker are discarded; a marker line is recognised only when it stands alone.
pub(super) fn split_sample_sections(text: &str) -> SampleSections {
    const MARKERS: [&str; 5] = [
        STAT_MARKER,
        MEM_MARKER,
        NET_MARKER,
        TEMP_MARKER,
        BATTERY_MARKER,
    ];
    let mut slots: [Option<String>; 5] = Default::default();
    let mut current: Option<usize> = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(index) = MARKERS.iter().position(|marker| *marker == trimmed) {
            slots[index] = Some(String::new());
            current = Some(index);
            continue;
        }
        if let Some(buffer) = current.and_then(|index| slots[index].as_mut()) {
            buffer.push_str(line);
            buffer.push('\n');
        }
    }
    let [stat, meminfo, net_dev, temp, battery] = slots;
    SampleSections {
        stat,
        meminfo,
        net_dev,
        temp,
        battery,
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub(super) struct CpuTick {
    pub user: u64,
    pub nice: u64,
    pub system: u64,
    pub idle: u64,
    pub iowait: u64,
    pub irq: u64,
    pub softirq: u64,
}

impl CpuTick {
    fn total(&self) -> u64 {
        self.user + self.nice + self.system + self.idle + self.iowait + self.irq + self.softirq
    }

    fn busy(&self) -> u64 {
        self.total() - self.idle - self.iowait
    }

    fn usage_vs(&self, prev: &CpuTick) -> f32 {
        let dtotal = self.total().saturating_sub(prev.total()) as f32;
        if dtotal < 1.0 {
            return 0.0;
        }
        let dbusy = self.busy().saturating_sub(prev.busy()) as f32;
        (dbusy / dtotal * 100.0).clamp(0.0, 100.0)
    }
}

pub(super) fn parse_proc_stat(text: &str) -> HashMap<String, CpuTick> {
    let mut map = HashMap::new();
    for line in text.lines() {
        if !line.starts_with("cpu") {
            break;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 8 {
            continue;
        }
        let field = |index: usize| parts[index].parse().unwrap_or(0);
        map.insert(
            parts[0].to_string(),
            CpuTick {
                user: field(1),
                nice: field(2),
                system: field(3),
                idle: field(4),
                iowait: field(5),
                irq: field(6),
                softirq: field(7),
            },
        );
    }
    map
}

pub(super) fn cpu_metrics(
    prev: &HashMap<String, CpuTick>,
    curr: &HashMap<String, CpuTick>,
) -> (Vec<CpuCoreMetric>, f32) {
    let mut cores: Vec<CpuCoreMetric> = Vec::new();
    let mut idx: u32 = 0;
    loop {
        let key = format!("cpu{idx}");
        match (prev.get(&key), curr.get(&key)) {
            (Some(p), Some(c)) => {
                cores.push(CpuCoreMetric {
                    core: idx,
                    usage: c.usage_vs(p),
                });
                idx += 1;
            }
            _ => break,
        }
    }
    let total = match (prev.get("cpu"), curr.get("cpu")) {
        (Some(p), Some(c)) => c.usage_vs(p),
        _ if !cores.is_empty() => cores.iter().map(|c| c.usage).sum::<f32>() / cores.len() as f32,
        _ => 0.0,
    };
    (cores, total)
}

pub(super) fn parse_meminfo(text: &str) -> MemMetric {
    let mut total_kb: u64 = 0;
    let mut available_kb: u64 = 0;
    for line in text.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        match parts[0] {
            "MemTotal:" => total_kb = parts[1].parse().unwrap_or(0),
            "MemAvailable:" => available_kb = parts[1].parse().unwrap_or(0),
            _ => {}
        }
    }
    let used_kb = total_kb.saturating_sub(available_kb);
    let used_pct = if total_kb > 0 {
        (used_kb as f32 / total_kb as f32 * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };
    MemMetric {
        total_kb,
        available_kb,
        used_kb,
        used_pct,
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub(super) struct NetBytes {
    pub rx: u64,
    pub tx: u64,
}

/// Sums received and transmitted bytes over every interface except loopback.
pub(super) fn parse_net_dev(text: &str) -> NetBytes {
    let mut total = NetBytes::default();
    for line in text.lines() {
        let trimmed = line.trim();
        let Some(colon) = trimmed.find(':') else {
            continue;
        };
        let iface = trimmed[..colon].trim();
        if iface == "lo" || iface.contains('|') {
            continue;
        }
        let cols: Vec<&str> = trimmed[colon + 1..].split_whitespace().collect();
        if cols.len() < 10 {
            continue;
        }
        let rx: u64 = cols[0].parse().unwrap_or(0);
        let tx: u64 = cols[8].parse().unwrap_or(0);
        total.rx = total.rx.saturating_add(rx);
        total.tx = total.tx.saturating_add(tx);
    }
    total
}

pub(super) fn net_bps(prev: &NetBytes, curr: &NetBytes, elapsed_secs: f64) -> NetMetric {
    if elapsed_secs < 0.001 {
        return NetMetric {
            rx_bps: 0.0,
            tx_bps: 0.0,
        };
    }
    let rx_bps = (curr.rx.saturating_sub(prev.rx) as f64 / elapsed_secs).max(0.0);
    let tx_bps = (curr.tx.saturating_sub(prev.tx) as f64 / elapsed_secs).max(0.0);
    NetMetric { rx_bps, tx_bps }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROC_STAT: &str = "cpu  100 0 50 800 50 0 0 0 0 0\ncpu0 60 0 30 400 10 0 0 0 0 0\ncpu1 40 0 20 400 40 0 0 0 0 0\nintr 12345\nctxt 999\n";
    const PROC_STAT_NEXT: &str = "cpu  150 0 100 850 50 0 0 0 0 0\ncpu0 100 0 60 420 10 0 0 0 0 0\ncpu1 50 0 40 430 40 0 0 0 0 0\nintr 12399\n";
    const MEMINFO: &str = "MemTotal:        7864320 kB\nMemFree:          512000 kB\nMemAvailable:    3932160 kB\nBuffers:           1024 kB\n";
    const NET_DEV: &str = "Inter-|   Receive                                                |  Transmit\n face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n    lo:   5000      10    0    0    0     0          0         0     5000      10    0    0    0     0       0          0\n wlan0: 1000000    800    0    0    0     0          0         0   200000     600    0    0    0     0       0          0\nrmnet0:   3000      20    0    0    0     0          0         0     1000      10    0    0    0     0       0          0\n";

    #[test]
    fn splits_combined_output_by_markers() {
        let raw = format!(
            "noise\n{STAT_MARKER}\n{PROC_STAT}{MEM_MARKER}\n{MEMINFO}{NET_MARKER}\r\n{NET_DEV}{TEMP_MARKER}\n41000\n{BATTERY_MARKER}\n  level: 80\n"
        );
        let sections = split_sample_sections(&raw);
        assert_eq!(sections.stat.as_deref(), Some(PROC_STAT));
        assert_eq!(sections.meminfo.as_deref(), Some(MEMINFO));
        assert_eq!(sections.net_dev.as_deref(), Some(NET_DEV));
        assert_eq!(sections.temp.as_deref(), Some("41000\n"));
        assert_eq!(sections.battery.as_deref(), Some("  level: 80\n"));
    }

    #[test]
    fn missing_markers_leave_sections_empty() {
        let sections = split_sample_sections(&format!("{STAT_MARKER}\ncpu 1 2 3 4 5 6 7\n"));
        assert!(sections.stat.is_some());
        assert_eq!(sections.meminfo, None);
        assert_eq!(sections.temp, None);
        assert_eq!(sections.battery, None);
    }

    #[test]
    fn sample_command_appends_optional_sections() {
        let base = sample_command(None, false);
        assert!(base.contains(STAT_MARKER) && base.contains(NET_MARKER));
        assert!(!base.contains(TEMP_MARKER) && !base.contains(BATTERY_MARKER));
        let full = sample_command(Some("cat /x"), true);
        assert!(full.contains(&format!("echo {TEMP_MARKER}; {{ cat /x; }}")));
        assert!(full.ends_with(&format!("echo {BATTERY_MARKER}; dumpsys battery")));
    }

    #[test]
    fn parses_proc_stat_and_computes_usage() {
        let prev = parse_proc_stat(PROC_STAT);
        assert_eq!(prev.len(), 3);
        assert_eq!(prev["cpu0"].user, 60);
        assert_eq!(prev["cpu1"].iowait, 40);
        let curr = parse_proc_stat(PROC_STAT_NEXT);
        let (cores, total) = cpu_metrics(&prev, &curr);
        assert_eq!(cores.len(), 2);
        assert!((cores[0].usage - 70.0 / 90.0 * 100.0).abs() < 0.01);
        assert!((cores[1].usage - 50.0).abs() < 0.01);
        assert!((total - 100.0 / 150.0 * 100.0).abs() < 0.01);
    }

    #[test]
    fn parses_meminfo() {
        let mem = parse_meminfo(MEMINFO);
        assert_eq!(mem.total_kb, 7_864_320);
        assert_eq!(mem.available_kb, 3_932_160);
        assert_eq!(mem.used_kb, 3_932_160);
        assert!((mem.used_pct - 50.0).abs() < 0.01);
        assert_eq!(parse_meminfo("").used_pct, 0.0);
    }

    #[test]
    fn parses_net_dev_without_loopback_or_headers() {
        let bytes = parse_net_dev(NET_DEV);
        assert_eq!(
            bytes,
            NetBytes {
                rx: 1_003_000,
                tx: 201_000
            }
        );
        let rate = net_bps(&NetBytes { rx: 0, tx: 1_000 }, &bytes, 2.0);
        assert_eq!(rate.rx_bps, 501_500.0);
        assert_eq!(rate.tx_bps, 100_000.0);
    }
}
