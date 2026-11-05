mod battery;
mod parse;
mod sampler;
mod temperature;

pub use parse::PerfMetrics;

use adb_client::{server_device::ADBServerDevice, ADBDeviceExt};
use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::time::MissedTickBehavior;

use crate::blocking::run_blocking;
use crate::commands::adb::get_adb_device;
use parse::{sample_command, split_sample_sections};
use sampler::{PerfSampler, TickRequest, TickSample};
use temperature::{parse_probe_output, probe_command, ProbePlan, PROBES};

const SAMPLE_PERIOD: Duration = Duration::from_secs(1);

fn shell(device: &mut ADBServerDevice, cmd: &str) -> Result<String, String> {
    let mut out = Vec::new();
    device
        .shell_command(&cmd, Some(&mut out), None::<&mut dyn Write>)
        .map_err(|e| format!("shell failed: {e}"))?;
    Ok(String::from_utf8_lossy(&out).to_string())
}

fn discover_temperature(device: &mut ADBServerDevice) -> Option<(f32, usize)> {
    PROBES.iter().enumerate().find_map(|(index, (_, command))| {
        let raw = shell(device, command).unwrap_or_default();
        parse_probe_output(&raw).map(|value| (value, index))
    })
}

/// Runs one tick on the device: a single shell for the /proc files (plus the
/// known temperature probe and, when due, `dumpsys battery`), and the probe
/// discovery shells only when the probe is not known yet.
fn take_sample(serial: &str, request: TickRequest) -> Result<TickSample, String> {
    let mut device = get_adb_device(serial)?;
    let known_probe = match request.temp {
        ProbePlan::Known(index) => probe_command(index),
        ProbePlan::Discover | ProbePlan::Skip => None,
    };
    let raw = shell(&mut device, &sample_command(known_probe, request.battery))?;
    let sections = split_sample_sections(&raw);
    if sections.stat.is_none() {
        return Err("perf sample returned no /proc/stat output".to_string());
    }
    let temp = match request.temp {
        ProbePlan::Known(index) => sections
            .temp
            .as_deref()
            .and_then(parse_probe_output)
            .map(|value| (value, index)),
        ProbePlan::Discover => discover_temperature(&mut device),
        ProbePlan::Skip => None,
    };
    Ok(TickSample { sections, temp })
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

struct PerfSession {
    stop_flag: Arc<AtomicBool>,
}

static PERF_SESSIONS: LazyLock<Mutex<HashMap<String, PerfSession>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub(crate) fn stop_perf_session(serial: &str) {
    if let Ok(mut sessions) = PERF_SESSIONS.lock() {
        if let Some(s) = sessions.remove(serial) {
            s.stop_flag.store(true, Ordering::Relaxed);
        }
    }
}

/// True while a perf sampling loop is registered for `serial`.
pub(crate) fn perf_session_running(serial: &str) -> bool {
    PERF_SESSIONS
        .lock()
        .is_ok_and(|sessions| sessions.contains_key(serial))
}

async fn run_perf_loop<FMetric, FError, FStopped>(
    serial: String,
    stop_flag: Arc<AtomicBool>,
    on_metric: FMetric,
    on_error: FError,
    on_stopped: FStopped,
) where
    FMetric: Fn(PerfMetrics) + Send + 'static,
    FError: Fn(String) + Send + 'static,
    FStopped: Fn(String) + Send + 'static,
{
    let mut sampler = PerfSampler::default();
    let mut ticker = tokio::time::interval(SAMPLE_PERIOD);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

    while !stop_flag.load(Ordering::Relaxed) {
        ticker.tick().await;
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }
        let request = sampler.request(Instant::now());
        let device_serial = serial.clone();
        let result = run_blocking(move || take_sample(&device_serial, request)).await;
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }
        match result.and_then(|sample| sample) {
            Ok(sample) => {
                if let Some(metrics) = sampler.ingest(request, sample, Instant::now(), now_millis())
                {
                    on_metric(metrics);
                }
            }
            Err(error) => {
                on_error(error);
                break;
            }
        }
    }

    let still_owned = PERF_SESSIONS.lock().is_ok_and(|mut sessions| {
        let owned = sessions
            .get(&serial)
            .is_some_and(|current| Arc::ptr_eq(&current.stop_flag, &stop_flag));
        if owned {
            sessions.remove(&serial);
        }
        owned
    });
    if still_owned {
        on_stopped(serial);
    }
}

/// Registers a perf session for `serial` and spawns its sampling loop, replacing
/// any session already running for that device. Synchronous so a caller can
/// make the start atomic with its own bookkeeping.
pub(crate) fn spawn_perf_session<FMetric, FError, FStopped>(
    serial: String,
    on_metric: FMetric,
    on_error: FError,
    on_stopped: FStopped,
) -> Result<(), String>
where
    FMetric: Fn(PerfMetrics) + Send + 'static,
    FError: Fn(String) + Send + 'static,
    FStopped: Fn(String) + Send + 'static,
{
    stop_perf_session(&serial);

    let stop_flag = Arc::new(AtomicBool::new(false));
    PERF_SESSIONS
        .lock()
        .map_err(|_| "perf session table is poisoned".to_string())?
        .insert(
            serial.clone(),
            PerfSession {
                stop_flag: stop_flag.clone(),
            },
        );

    tauri::async_runtime::spawn(run_perf_loop(
        serial, stop_flag, on_metric, on_error, on_stopped,
    ));
    Ok(())
}

pub(crate) async fn start_perf_session_with_callbacks<FMetric, FError, FStopped>(
    serial: String,
    on_metric: FMetric,
    on_error: FError,
    on_stopped: FStopped,
) -> Result<(), String>
where
    FMetric: Fn(PerfMetrics) + Send + 'static,
    FError: Fn(String) + Send + 'static,
    FStopped: Fn(String) + Send + 'static,
{
    spawn_perf_session(serial, on_metric, on_error, on_stopped)
}

#[tauri::command]
pub async fn adb_perf_start(serial: String, app: AppHandle) -> Result<(), String> {
    let metric_app = app.clone();
    let error_app = app.clone();
    start_perf_session_with_callbacks(
        serial,
        move |metrics| {
            let _ = metric_app.emit("perf:metrics", metrics);
        },
        move |message| {
            let _ = error_app.emit("perf:error", message);
        },
        move |serial| {
            let _ = app.emit("perf:stopped", serial);
        },
    )
    .await
}

#[tauri::command]
pub async fn adb_perf_stop(serial: String) -> Result<(), String> {
    stop_perf_session(&serial);
    Ok(())
}
