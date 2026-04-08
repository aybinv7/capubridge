use adb_client::{server_device::ADBServerDevice, ADBDeviceExt};
use serde::Serialize;
use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::{AppHandle, Emitter};

use crate::commands::adb::{get_server, map_adb_server_err};

fn get_device(serial: &str) -> Result<ADBServerDevice, String> {
    let mut server = get_server().lock();
    server
        .get_device_by_name(serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))
}

fn shell(device: &mut ADBServerDevice, cmd: &str) -> Result<String, String> {
    let mut out = Vec::new();
    device
        .shell_command(&format!("{cmd}"), Some(&mut out), None::<&mut dyn Write>)
        .map_err(|e| format!("shell failed: {e}"))?;
    Ok(String::from_utf8_lossy(&out).to_string())
}

// ── Metric types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CpuCoreMetric {
    pub core: u32,
    pub usage: f32,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MemMetric {
    pub total_kb: u64,
    pub available_kb: u64,
    pub used_kb: u64,
    pub used_pct: f32,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetMetric {
    pub rx_bps: f64,
    pub tx_bps: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BatteryMetric {
    pub level: u32,
    pub temperature: f32,
    pub charging: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PerfMetrics {
    pub cpu_cores: Vec<CpuCoreMetric>,
    pub cpu_total: f32,
    pub memory: MemMetric,
    pub network: NetMetric,
    pub battery: BatteryMetric,
    pub cpu_temp: Option<f32>,
    pub gpu_usage: Option<f32>,
    pub timestamp: u64,
}

// ── CPU parsing ───────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Default)]
struct CpuTick {
    user: u64,
    nice: u64,
    system: u64,
    idle: u64,
    iowait: u64,
    irq: u64,
    softirq: u64,
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

fn parse_proc_stat(text: &str) -> HashMap<String, CpuTick> {
    let mut map = HashMap::new();
    for line in text.lines() {
        if !line.starts_with("cpu") {
            break;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 8 {
            continue;
        }
        let tick = CpuTick {
            user: parts[1].parse().unwrap_or(0),
            nice: parts[2].parse().unwrap_or(0),
            system: parts[3].parse().unwrap_or(0),
            idle: parts[4].parse().unwrap_or(0),
            iowait: parts[5].parse().unwrap_or(0),
            irq: parts[6].parse().unwrap_or(0),
            softirq: parts[7].parse().unwrap_or(0),
        };
        map.insert(parts[0].to_string(), tick);
    }
    map
}

fn cpu_metrics(prev: &HashMap<String, CpuTick>, curr: &HashMap<String, CpuTick>) -> (Vec<CpuCoreMetric>, f32) {
    let mut cores: Vec<CpuCoreMetric> = Vec::new();
    let mut idx: u32 = 0;
    loop {
        let key = format!("cpu{idx}");
        match (prev.get(&key), curr.get(&key)) {
            (Some(p), Some(c)) => {
                cores.push(CpuCoreMetric { core: idx, usage: c.usage_vs(p) });
                idx += 1;
            }
            _ => break,
        }
    }
    let total = match (prev.get("cpu"), curr.get("cpu")) {
        (Some(p), Some(c)) => c.usage_vs(p),
        _ if !cores.is_empty() => {
            cores.iter().map(|c| c.usage).sum::<f32>() / cores.len() as f32
        }
        _ => 0.0,
    };
    (cores, total)
}

// ── Memory parsing ────────────────────────────────────────────────────────────

fn parse_meminfo(text: &str) -> MemMetric {
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
    let used_pct = if total_kb > 0 { (used_kb as f32 / total_kb as f32 * 100.0).clamp(0.0, 100.0) } else { 0.0 };
    MemMetric { total_kb, available_kb, used_kb, used_pct }
}

// ── Network parsing ───────────────────────────────────────────────────────────

#[derive(Clone, Debug, Default)]
struct NetBytes {
    rx: u64,
    tx: u64,
}

fn parse_net_dev(text: &str) -> NetBytes {
    let mut total = NetBytes::default();
    for line in text.lines().skip(2) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let colon = match trimmed.find(':') {
            Some(i) => i,
            None => continue,
        };
        let iface = trimmed[..colon].trim();
        // Skip loopback
        if iface == "lo" {
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

fn net_bps(prev: &NetBytes, curr: &NetBytes, elapsed_secs: f64) -> NetMetric {
    if elapsed_secs < 0.001 {
        return NetMetric { rx_bps: 0.0, tx_bps: 0.0 };
    }
    let rx_bps = (curr.rx.saturating_sub(prev.rx) as f64 / elapsed_secs).max(0.0);
    let tx_bps = (curr.tx.saturating_sub(prev.tx) as f64 / elapsed_secs).max(0.0);
    NetMetric { rx_bps, tx_bps }
}

// ── Battery parsing ───────────────────────────────────────────────────────────

fn parse_battery(text: &str) -> BatteryMetric {
    let mut level: u32 = 0;
    let mut temperature: f32 = 0.0;
    let mut charging = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed.strip_prefix("level: ") {
            level = val.parse().unwrap_or(0);
        } else if let Some(val) = trimmed.strip_prefix("temperature: ") {
            // dumpsys reports in tenths of degrees
            let raw: f32 = val.parse().unwrap_or(0.0);
            temperature = raw / 10.0;
        } else if let Some(val) = trimmed.strip_prefix("status: ") {
            // 2 = charging
            charging = val.trim() == "2";
        }
    }
    BatteryMetric { level, temperature, charging }
}

// ── Session state ─────────────────────────────────────────────────────────────

struct PerfSession {
    stop_flag: Arc<AtomicBool>,
}

static PERF_SESSIONS: LazyLock<Mutex<HashMap<String, PerfSession>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn stop_perf_session(serial: &str) {
    if let Ok(mut sessions) = PERF_SESSIONS.lock() {
        if let Some(s) = sessions.remove(serial) {
            s.stop_flag.store(true, Ordering::Relaxed);
        }
    }
}

// ── Tauri commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn adb_perf_start(serial: String, app: AppHandle) -> Result<(), String> {
    stop_perf_session(&serial);

    let stop_flag = Arc::new(AtomicBool::new(false));
    {
        let mut sessions = PERF_SESSIONS.lock().unwrap();
        sessions.insert(serial.clone(), PerfSession { stop_flag: stop_flag.clone() });
    }

    let serial_clone = serial.clone();
    tokio::spawn(async move {
        let mut prev_cpu: HashMap<String, CpuTick> = HashMap::new();
        let mut prev_net = NetBytes::default();
        let mut prev_time = std::time::Instant::now();

        // Warm up CPU baseline
        {
            let s = serial_clone.clone();
            if let Ok(Ok(stat)) = tokio::task::spawn_blocking(move || {
                get_device(&s).and_then(|mut d| shell(&mut d, "cat /proc/stat"))
            })
            .await
            {
                prev_cpu = parse_proc_stat(&stat);
            }
        }
        // Warm up net baseline
        {
            let s = serial_clone.clone();
            if let Ok(Ok(net)) = tokio::task::spawn_blocking(move || {
                get_device(&s).and_then(|mut d| shell(&mut d, "cat /proc/net/dev"))
            })
            .await
            {
                prev_net = parse_net_dev(&net);
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        while !stop_flag.load(Ordering::Relaxed) {
            let s = serial_clone.clone();
            let result = tokio::task::spawn_blocking(move || -> Result<(String, String, String, String, String, String), String> {
                let mut device = get_device(&s)?;
                let stat = shell(&mut device, "cat /proc/stat")?;
                let meminfo = shell(&mut device, "cat /proc/meminfo")?;
                let net = shell(&mut device, "cat /proc/net/dev")?;
                let battery = shell(&mut device, "dumpsys battery")?;
                // Best-effort — don't fail if not present
                let cpu_temp = shell(&mut device, "cat /sys/class/thermal/thermal_zone0/temp").unwrap_or_default();
                let gpu = shell(&mut device, "cat /sys/class/kgsl/kgsl-3d0/gpu_busy_percentage").unwrap_or_default();
                Ok((stat, meminfo, net, battery, cpu_temp, gpu))
            })
            .await;

            if stop_flag.load(Ordering::Relaxed) {
                break;
            }

            match result {
                Ok(Ok((stat, meminfo, net_raw, battery_raw, cpu_temp_raw, gpu_raw))) => {
                    let now = std::time::Instant::now();
                    let elapsed = now.duration_since(prev_time).as_secs_f64();
                    prev_time = now;

                    let curr_cpu = parse_proc_stat(&stat);
                    let (cpu_cores, cpu_total) = cpu_metrics(&prev_cpu, &curr_cpu);
                    prev_cpu = curr_cpu;

                    let memory = parse_meminfo(&meminfo);

                    let curr_net = parse_net_dev(&net_raw);
                    let network = net_bps(&prev_net, &curr_net, elapsed);
                    prev_net = curr_net;

                    let battery = parse_battery(&battery_raw);

                    let cpu_temp = cpu_temp_raw.trim().parse::<f32>().ok().map(|t| {
                        // Some devices report in millidegrees
                        if t > 1000.0 { t / 1000.0 } else { t }
                    });

                    let gpu_usage = gpu_raw
                        .trim()
                        .trim_end_matches('%')
                        .parse::<f32>()
                        .ok()
                        .map(|v| v.clamp(0.0, 100.0));

                    let timestamp = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    let metrics = PerfMetrics {
                        cpu_cores,
                        cpu_total,
                        memory,
                        network,
                        battery,
                        cpu_temp,
                        gpu_usage,
                        timestamp,
                    };

                    let _ = app.emit("perf:metrics", metrics);
                }
                Ok(Err(e)) => {
                    let _ = app.emit("perf:error", e);
                    break;
                }
                _ => break,
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
        }

        if let Ok(mut sessions) = PERF_SESSIONS.lock() {
            sessions.remove(&serial_clone);
        }
        let _ = app.emit("perf:stopped", serial_clone);
    });

    Ok(())
}

#[tauri::command]
pub async fn adb_perf_stop(serial: String) -> Result<(), String> {
    stop_perf_session(&serial);
    Ok(())
}
