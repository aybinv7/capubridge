use adb_client::{server_device::ADBServerDevice, ADBDeviceExt};
use base64::{engine::general_purpose, Engine as _};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{Mutex as TokioMutex, Notify};

use crate::commands::adb::{get_server, map_adb_server_err};

fn get_device(serial: &str) -> Result<ADBServerDevice, String> {
    let mut server = get_server().lock();
    server
        .get_device_by_name(serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))
}

static SCRCPY_STREAM_SHUTDOWNS: LazyLock<Mutex<HashMap<String, Arc<Notify>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static SCRCPY_CONTROL_SESSIONS: LazyLock<Mutex<HashMap<String, ScrcpyControlSession>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
struct ScrcpyControlSession {
    socket: Arc<TokioMutex<TcpStream>>,
    width: u16,
    height: u16,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyStreamSettings {
    pub max_size: u32,
    pub max_fps: u32,
    pub video_bit_rate: u32,
    pub video_codec: String,
}

impl Default for ScrcpyStreamSettings {
    fn default() -> Self {
        Self {
            max_size: 1280,
            max_fps: 60,
            video_bit_rate: 8_000_000,
            video_codec: "h264".to_string(),
        }
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(tag = "event", content = "data")]
pub enum ScrcpyFrameEvent {
    #[serde(rename = "config")]
    Config { codec: String, description: String },
    #[serde(rename = "packet")]
    Packet {
        key: bool,
        data: String,
        timestamp: u64,
    },
    #[serde(rename = "disconnected")]
    Disconnected { reason: String },
}

// ── Embedded scrcpy streaming ────────────────────────────────────────────────

const SCRCPY_REMOTE_SERVER_PATH: &str = "/data/local/tmp/scrcpy-server.jar";
const SCRCPY_SOCKET_NAME: &str = "localabstract:scrcpy";
const SCRCPY_FLAG_CONFIG: u64 = 1 << 63;
const SCRCPY_FLAG_KEY_FRAME: u64 = 1 << 62;
const SCRCPY_GITHUB_LATEST_RELEASE: &str = "https://api.github.com/repos/Genymobile/scrcpy/releases/latest";
const SCRCPY_MSG_TYPE_INJECT_TOUCH: u8 = 2;
const SCRCPY_TOUCH_ACTION_DOWN: u8 = 0;
const SCRCPY_TOUCH_ACTION_UP: u8 = 1;
const SCRCPY_TOUCH_ACTION_MOVE: u8 = 2;

fn stop_scrcpy_stream_session(serial: &str) {
    if let Ok(mut sessions) = SCRCPY_STREAM_SHUTDOWNS.lock() {
        if let Some(notify) = sessions.remove(serial) {
            notify.notify_waiters();
        }
    }
}

fn clamp_u16_size(size: u32) -> u16 {
    size.min(u16::MAX as u32) as u16
}

fn remove_scrcpy_control_session(serial: &str) {
    if let Ok(mut sessions) = SCRCPY_CONTROL_SESSIONS.lock() {
        sessions.remove(serial);
    }
}

fn get_scrcpy_control_session(serial: &str) -> Option<ScrcpyControlSession> {
    SCRCPY_CONTROL_SESSIONS
        .lock()
        .ok()
        .and_then(|sessions| sessions.get(serial).cloned())
}

fn touch_action_code(action: &str) -> Option<u8> {
    match action {
        "down" => Some(SCRCPY_TOUCH_ACTION_DOWN),
        "up" => Some(SCRCPY_TOUCH_ACTION_UP),
        "move" => Some(SCRCPY_TOUCH_ACTION_MOVE),
        _ => None,
    }
}

fn build_scrcpy_touch_message(
    action: &str,
    x: u32,
    y: u32,
    screen_w: u16,
    screen_h: u16,
) -> Result<Vec<u8>, String> {
    let action_code = touch_action_code(action)
        .ok_or_else(|| format!("Invalid touch action: {action}. Expected down|move|up"))?;
    let pressure: u16 = if action == "up" { 0 } else { 0xFFFF };
    let mut buf = Vec::with_capacity(32);
    buf.push(SCRCPY_MSG_TYPE_INJECT_TOUCH);
    buf.push(action_code);
    buf.extend_from_slice(&u64::MAX.to_be_bytes());
    buf.extend_from_slice(&x.to_be_bytes());
    buf.extend_from_slice(&y.to_be_bytes());
    buf.extend_from_slice(&screen_w.to_be_bytes());
    buf.extend_from_slice(&screen_h.to_be_bytes());
    buf.extend_from_slice(&pressure.to_be_bytes());
    buf.extend_from_slice(&1u32.to_be_bytes());
    buf.extend_from_slice(&1u32.to_be_bytes());
    Ok(buf)
}

async fn send_scrcpy_touch_event(serial: &str, action: &str, x: u32, y: u32) -> Result<(), String> {
    let session = get_scrcpy_control_session(serial)
        .ok_or_else(|| "No active scrcpy control session for device".to_string())?;
    let msg = build_scrcpy_touch_message(action, x, y, session.width, session.height)?;
    let started = std::time::Instant::now();
    let mut socket = session.socket.lock().await;
    socket
        .write_all(&msg)
        .await
        .map_err(|e| format!("Failed to send scrcpy touch event: {e}"))?;
    let took_ms = started.elapsed().as_secs_f64() * 1000.0;
    if action != "move" {
        log::info!(
            "[adb_mirror_touch_event] serial={} action={} x={} y={} tookMs={:.2}",
            serial,
            action,
            x,
            y,
            took_ms
        );
    } else if log::log_enabled!(log::Level::Debug) {
        log::debug!(
            "[adb_mirror_touch_event] serial={} action={} x={} y={} tookMs={:.2}",
            serial,
            action,
            x,
            y,
            took_ms
        );
    }
    Ok(())
}

fn split_nals(data: &[u8]) -> Vec<&[u8]> {
    let mut nals = Vec::new();
    let mut markers: Vec<(usize, usize)> = Vec::new();
    let mut i = 0usize;
    while i + 2 < data.len() {
        if data[i] == 0 && data[i + 1] == 0 && data[i + 2] == 1 {
            if i > 0 && data[i - 1] == 0 {
                markers.push((i - 1, 4));
            } else {
                markers.push((i, 3));
            }
            i += 3;
        } else {
            i += 1;
        }
    }

    for (idx, (pos, sc_len)) in markers.iter().enumerate() {
        let start = pos + sc_len;
        let end = if idx + 1 < markers.len() {
            markers[idx + 1].0
        } else {
            data.len()
        };
        if start < end {
            nals.push(&data[start..end]);
        }
    }
    nals
}

fn nals_to_avcc(data: &[u8]) -> Vec<u8> {
    let nals = split_nals(data);
    if nals.is_empty() {
        // Some codecs/devices may already provide length-prefixed packets.
        // Preserve the payload so the decoder can still attempt parsing.
        return data.to_vec();
    }
    let mut out = Vec::with_capacity(data.len());
    for nal in nals {
        let len = nal.len() as u32;
        out.extend_from_slice(&len.to_be_bytes());
        out.extend_from_slice(nal);
    }
    out
}

fn build_h264_avcc(sps_list: &[&[u8]], pps_list: &[&[u8]]) -> Vec<u8> {
    if sps_list.is_empty() {
        return Vec::new();
    }
    let sps = sps_list[0];
    if sps.len() < 4 {
        return Vec::new();
    }
    let mut out = vec![
        1,
        sps[1],
        sps[2],
        sps[3],
        0xFF,
        0xE0 | (sps_list.len() as u8 & 0x1F),
    ];
    for sps in sps_list {
        out.push((sps.len() >> 8) as u8);
        out.push(sps.len() as u8);
        out.extend_from_slice(sps);
    }
    out.push(pps_list.len() as u8);
    for pps in pps_list {
        out.push((pps.len() >> 8) as u8);
        out.push(pps.len() as u8);
        out.extend_from_slice(pps);
    }
    out
}

fn parse_h264_config(data: &[u8]) -> (String, Vec<u8>) {
    let mut sps_list: Vec<&[u8]> = Vec::new();
    let mut pps_list: Vec<&[u8]> = Vec::new();
    let mut codec = String::from("avc1.42001e");
    for nal in split_nals(data) {
        if nal.is_empty() {
            continue;
        }
        let nal_type = nal[0] & 0x1F;
        if nal_type == 7 && nal.len() >= 4 {
            codec = format!("avc1.{:02x}{:02x}{:02x}", nal[1], nal[2], nal[3]);
            sps_list.push(nal);
        } else if nal_type == 8 {
            pps_list.push(nal);
        }
    }
    let avcc = build_h264_avcc(&sps_list, &pps_list);
    if avcc.is_empty() {
        // Fallback for devices that don't expose Annex-B config NAL units.
        (codec, data.to_vec())
    } else {
        (codec, avcc)
    }
}

fn parse_scrcpy_codec(codec_buf: [u8; 4], requested: &str) -> String {
    match &codec_buf {
        b"h264" => "h264".to_string(),
        b"h265" => "h265".to_string(),
        b"av1 " | b"av01" => "av1".to_string(),
        _ => requested.to_ascii_lowercase(),
    }
}

fn parse_scrcpy_server_version(name: &str) -> Option<String> {
    let version = name.strip_prefix("scrcpy-server-v")?;
    Some(
        version
            .strip_suffix(".jar")
            .unwrap_or(version)
            .to_string(),
    )
}

fn find_scrcpy_server_file(dir: &Path) -> Option<(PathBuf, String)> {
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name()?.to_str()?;
        let version = parse_scrcpy_server_version(name)?;
        return Some((path, version));
    }
    None
}

async fn ensure_scrcpy_server(app: &AppHandle) -> Result<(PathBuf, String), String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?
        .join("scrcpy");
    std::fs::create_dir_all(&base_dir).map_err(|e| format!("Failed to create scrcpy dir: {e}"))?;

    // Reuse existing downloaded server if available.
    if let Some((path, version)) = find_scrcpy_server_file(&base_dir) {
        return Ok((path, version));
    }

    // Prefer bundled server from app resources for offline packaged builds.
    if let Ok(resource_dir) = app.path().resource_dir() {
        for candidate in [resource_dir.clone(), resource_dir.join("resources")] {
            if let Some((bundled_path, version)) = find_scrcpy_server_file(&candidate) {
                let cached_name = bundled_path
                    .file_name()
                    .ok_or_else(|| "Invalid bundled scrcpy-server filename".to_string())?;
                let cached_path = base_dir.join(cached_name);
                if !cached_path.exists() {
                    std::fs::copy(&bundled_path, &cached_path).map_err(|e| {
                        format!(
                            "Failed to copy bundled scrcpy-server from {}: {e}",
                            bundled_path.display()
                        )
                    })?;
                }
                log::info!(
                    "[adb_mirror_scrcpy_start] using bundled scrcpy-server {}",
                    cached_path.display()
                );
                return Ok((cached_path, version));
            }
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("capubridge-scrcpy-bootstrap")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;
    let release = client
        .get(SCRCPY_GITHUB_LATEST_RELEASE)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Failed to query scrcpy release: {e}. For offline use, bundle scrcpy-server-v* in src-tauri/resources."
            )
        })?
        .error_for_status()
        .map_err(|e| format!("Failed to query scrcpy release: {e}"))?;
    let release_json: serde_json::Value = release
        .json()
        .await
        .map_err(|e| format!("Failed to parse scrcpy release metadata: {e}"))?;

    let assets = release_json
        .get("assets")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "scrcpy release metadata missing assets".to_string())?;
    let mut selected_name: Option<String> = None;
    let mut selected_url: Option<String> = None;
    for asset in assets {
        let name = asset
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if !name.starts_with("scrcpy-server-v") {
            continue;
        }
        let url = asset
            .get("browser_download_url")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if url.is_empty() {
            continue;
        }
        selected_name = Some(name.to_string());
        selected_url = Some(url.to_string());
        break;
    }

    let name = selected_name.ok_or_else(|| "No scrcpy-server asset found in latest release".to_string())?;
    let url = selected_url.ok_or_else(|| "No scrcpy-server asset download URL found".to_string())?;
    let target = base_dir.join(&name);

    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download scrcpy-server: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Failed to download scrcpy-server: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read scrcpy-server bytes: {e}"))?;
    std::fs::write(&target, &bytes).map_err(|e| format!("Failed to save scrcpy-server: {e}"))?;

    let version = parse_scrcpy_server_version(&name).unwrap_or_else(|| "3.3.4".to_string());
    Ok((target, version))
}

async fn cleanup_scrcpy_device(serial: &str) {
    remove_scrcpy_control_session(serial);
    let mut device = match get_device(serial) {
        Ok(d) => d,
        Err(_) => return,
    };
    let _ = device.reverse_remove_all();
    let mut out = Vec::new();
    let _ = device.shell_command(
        &"pkill -f com.genymobile.scrcpy.Server 2>/dev/null; true",
        Some(&mut out),
        None::<&mut dyn Write>,
    );
}

async fn start_scrcpy_stream(
    serial: &str,
    app: &AppHandle,
    settings: &ScrcpyStreamSettings,
) -> Result<(TcpStream, Arc<TokioMutex<TcpStream>>, u32, u32, String), String> {
    let (server_path, server_version) = ensure_scrcpy_server(app).await?;
    let mut device = get_device(serial)?;

    let _ = device.reverse_remove_all();
    let mut kill_out = Vec::new();
    let _ = device.shell_command(
        &"pkill -f com.genymobile.scrcpy.Server 2>/dev/null; true",
        Some(&mut kill_out),
        None::<&mut dyn Write>,
    );

    let mut server_file = std::fs::File::open(&server_path)
        .map_err(|e| format!("Failed to open scrcpy-server at {}: {e}", server_path.display()))?;
    device
        .push(&mut server_file, &SCRCPY_REMOTE_SERVER_PATH)
        .map_err(|e| format!("Failed to push scrcpy-server: {e}"))?;

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("Failed to bind local stream socket: {e}"))?;
    let local_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to resolve local stream socket: {e}"))?
        .port();

    device
        .reverse(
            SCRCPY_SOCKET_NAME.to_string(),
            format!("tcp:{local_port}"),
        )
        .map_err(|e| format!("Failed to create adb reverse tunnel: {e}"))?;

    let codec = if settings.video_codec.eq_ignore_ascii_case("h265") {
        "h265"
    } else {
        "h264"
    };
    let max_size = settings.max_size.max(1);
    let max_fps = settings.max_fps.max(1);
    let bitrate = settings.video_bit_rate.max(500_000);

    let server_cmd = format!(
        "CLASSPATH={remote} app_process / com.genymobile.scrcpy.Server {version} \
tunnel_forward=false \
audio=false \
control=true \
video_codec={codec} \
max_size={max_size} \
max_fps={max_fps} \
video_bit_rate={bitrate} \
send_device_meta=true \
send_dummy_byte=false \
log_level=info",
        remote = SCRCPY_REMOTE_SERVER_PATH,
        version = server_version,
        codec = codec,
        max_size = max_size,
        max_fps = max_fps,
        bitrate = bitrate,
    );

    let adb = which::which("adb").map_err(|_| {
        "adb binary not found in PATH. Install Android SDK Platform Tools.".to_string()
    })?;
    let _server_child = tokio::process::Command::new(&adb)
        .args(["-s", serial, "shell", &server_cmd])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start scrcpy server process: {e}"))?;

    let (mut video_socket, _) = tokio::time::timeout(Duration::from_secs(12), listener.accept())
        .await
        .map_err(|_| "Timeout waiting for scrcpy video stream".to_string())?
        .map_err(|e| format!("Failed to accept scrcpy video stream: {e}"))?;

    let mut device_name_buf = [0u8; 64];
    video_socket
        .read_exact(&mut device_name_buf)
        .await
        .map_err(|e| format!("Failed to read scrcpy device metadata: {e}"))?;
    let mut codec_buf = [0u8; 4];
    video_socket
        .read_exact(&mut codec_buf)
        .await
        .map_err(|e| format!("Failed to read scrcpy codec metadata: {e}"))?;
    let mut size_buf = [0u8; 8];
    video_socket
        .read_exact(&mut size_buf)
        .await
        .map_err(|e| format!("Failed to read scrcpy size metadata: {e}"))?;

    let width = u32::from_be_bytes([size_buf[0], size_buf[1], size_buf[2], size_buf[3]]);
    let height = u32::from_be_bytes([size_buf[4], size_buf[5], size_buf[6], size_buf[7]]);
    let (control_socket_raw, _) =
        tokio::time::timeout(Duration::from_secs(5), listener.accept())
            .await
            .map_err(|_| "Timeout waiting for scrcpy control stream".to_string())?
            .map_err(|e| format!("Failed to accept scrcpy control stream: {e}"))?;
    let control_socket = Arc::new(TokioMutex::new(control_socket_raw));
    let negotiated_codec = parse_scrcpy_codec(codec_buf, codec);
    log::info!(
        "[adb_mirror_scrcpy_start] serial={} codec={} width={} height={}",
        serial,
        negotiated_codec,
        width,
        height
    );
    Ok((video_socket, control_socket, width, height, negotiated_codec))
}

async fn stream_scrcpy_packets(
    mut video_socket: TcpStream,
    on_frame: Channel<ScrcpyFrameEvent>,
    shutdown: Arc<Notify>,
    codec: String,
) -> Result<(), String> {
    loop {
        let mut header = [0u8; 12];
        tokio::select! {
            _ = shutdown.notified() => return Ok(()),
            read = video_socket.read_exact(&mut header) => {
                read.map_err(|e| format!("Failed to read scrcpy frame header: {e}"))?;
            }
        }

        let pts_flags = u64::from_be_bytes(
            header[0..8]
                .try_into()
                .map_err(|_| "Invalid scrcpy frame header".to_string())?,
        );
        let is_config = (pts_flags & SCRCPY_FLAG_CONFIG) != 0;
        let is_key = (pts_flags & SCRCPY_FLAG_KEY_FRAME) != 0;
        let pts = pts_flags & !(SCRCPY_FLAG_CONFIG | SCRCPY_FLAG_KEY_FRAME);
        let size = u32::from_be_bytes(
            header[8..12]
                .try_into()
                .map_err(|_| "Invalid scrcpy frame size header".to_string())?,
        ) as usize;
        if size == 0 {
            continue;
        }

        let mut payload = vec![0u8; size];
        tokio::select! {
            _ = shutdown.notified() => return Ok(()),
            read = video_socket.read_exact(&mut payload) => {
                read.map_err(|e| format!("Failed to read scrcpy frame payload: {e}"))?;
            }
        }

        if is_config {
            let (codec_string, description) = if codec.eq_ignore_ascii_case("h264") {
                parse_h264_config(&payload)
            } else {
                (String::from("hev1.1.6.L93.B0"), payload.clone())
            };
            log::info!(
                "[adb_mirror_scrcpy_start] config packet codec={} bytes={}",
                codec_string,
                payload.len()
            );
            on_frame
                .send(ScrcpyFrameEvent::Config {
                    codec: codec_string,
                    description: general_purpose::STANDARD.encode(description),
                })
                .map_err(|e| format!("Failed to send scrcpy config event: {e}"))?;
        } else {
            let avcc = nals_to_avcc(&payload);
            on_frame
                .send(ScrcpyFrameEvent::Packet {
                    key: is_key,
                    data: general_purpose::STANDARD.encode(avcc),
                    timestamp: pts,
                })
                .map_err(|e| format!("Failed to send scrcpy packet event: {e}"))?;
        }
    }
}

#[tauri::command]
pub async fn adb_mirror_scrcpy_start(
    serial: String,
    settings: Option<ScrcpyStreamSettings>,
    on_frame: Channel<ScrcpyFrameEvent>,
    app: AppHandle,
) -> Result<(u32, u32), String> {
    stop_scrcpy_stream_session(&serial);
    remove_scrcpy_control_session(&serial);

    let settings = settings.unwrap_or_default();
    let (video_socket, control_socket, width, height, codec) =
        start_scrcpy_stream(&serial, &app, &settings).await?;

    let shutdown = Arc::new(Notify::new());
    {
        let mut sessions = SCRCPY_STREAM_SHUTDOWNS
            .lock()
            .map_err(|_| "scrcpy shutdown map lock poisoned".to_string())?;
        sessions.insert(serial.clone(), shutdown.clone());
    }
    {
        let mut control_sessions = SCRCPY_CONTROL_SESSIONS
            .lock()
            .map_err(|_| "scrcpy control map lock poisoned".to_string())?;
        control_sessions.insert(
            serial.clone(),
            ScrcpyControlSession {
                socket: control_socket,
                width: clamp_u16_size(width),
                height: clamp_u16_size(height),
            },
        );
    }

    tokio::spawn(async move {
        let result = stream_scrcpy_packets(video_socket, on_frame.clone(), shutdown.clone(), codec).await;
        if let Ok(mut sessions) = SCRCPY_STREAM_SHUTDOWNS.lock() {
            sessions.remove(&serial);
        }
        remove_scrcpy_control_session(&serial);
        cleanup_scrcpy_device(&serial).await;
        if let Err(err) = result {
            let _ = on_frame.send(ScrcpyFrameEvent::Disconnected { reason: err });
        } else {
            let _ = on_frame.send(ScrcpyFrameEvent::Disconnected {
                reason: "stopped".to_string(),
            });
        }
    });

    Ok((width, height))
}

#[tauri::command]
pub async fn adb_mirror_scrcpy_stop(serial: String) -> Result<(), String> {
    stop_scrcpy_stream_session(&serial);
    cleanup_scrcpy_device(&serial).await;
    Ok(())
}

// ── Single screenshot ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn adb_mirror_screenshot(serial: String) -> Result<String, String> {
    let mut device = get_device(&serial)?;
    let mut output = Vec::new();
    device
        .shell_command(
            &format!("screencap -p"),
            Some(&mut output),
            None::<&mut dyn Write>,
        )
        .map_err(|e| format!("screencap failed: {e}"))?;
    if output.is_empty() {
        return Err("Empty screenshot output".to_string());
    }
    Ok(general_purpose::STANDARD.encode(&output))
}

// ── Screen size ───────────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenSize {
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub fn adb_mirror_get_screen_size(serial: String) -> Result<ScreenSize, String> {
    let mut device = get_device(&serial)?;
    let mut output = Vec::new();
    device
        .shell_command(
            &format!("wm size"),
            Some(&mut output),
            None::<&mut dyn Write>,
        )
        .map_err(|e| format!("wm size failed: {e}"))?;

    let text = String::from_utf8_lossy(&output);
    // "Physical size: 1080x1920" — last line wins (override takes precedence)
    for line in text.lines().rev() {
        if let Some(size_part) = line.split(": ").last() {
            let parts: Vec<&str> = size_part.trim().split('x').collect();
            if parts.len() == 2 {
                if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                    return Ok(ScreenSize { width: w, height: h });
                }
            }
        }
    }
    Err("Failed to parse screen size".to_string())
}

// ── Input events ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn adb_mirror_keyevent(serial: String, keycode: u32) -> Result<(), String> {
    let mut device = get_device(&serial)?;
    let mut out = Vec::new();
    device
        .shell_command(
            &format!("input keyevent {keycode}"),
            Some(&mut out),
            None::<&mut dyn Write>,
        )
        .map_err(|e| format!("keyevent failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn adb_mirror_touch_event(
    serial: String,
    action: String,
    x: u32,
    y: u32,
) -> Result<(), String> {
    send_scrcpy_touch_event(&serial, &action, x, y).await
}

#[tauri::command]
pub async fn adb_mirror_tap(serial: String, x: u32, y: u32) -> Result<(), String> {
    send_scrcpy_touch_event(&serial, "down", x, y).await?;
    send_scrcpy_touch_event(&serial, "up", x, y).await?;
    Ok(())
}

#[tauri::command]
pub async fn adb_mirror_swipe(
    serial: String,
    x1: u32,
    y1: u32,
    x2: u32,
    y2: u32,
    duration_ms: u32,
) -> Result<(), String> {
    send_scrcpy_touch_event(&serial, "down", x1, y1).await?;
    if duration_ms > 0 {
        tokio::time::sleep(Duration::from_millis((duration_ms / 2).max(1) as u64)).await;
    }
    send_scrcpy_touch_event(&serial, "move", x2, y2).await?;
    if duration_ms > 0 {
        tokio::time::sleep(Duration::from_millis((duration_ms / 2).max(1) as u64)).await;
    }
    send_scrcpy_touch_event(&serial, "up", x2, y2).await?;
    Ok(())
}

// ── Screen recording ──────────────────────────────────────────────────────────

static RECORDING_SESSIONS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static SCRCPY_SESSIONS: LazyLock<Mutex<HashMap<String, Child>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn stop_scrcpy_session(serial: &str) {
    if let Ok(mut sessions) = SCRCPY_SESSIONS.lock() {
        if let Some(mut child) = sessions.remove(serial) {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[tauri::command]
pub fn adb_mirror_launch_scrcpy(
    serial: String,
    max_size: Option<u32>,
    bit_rate_mbps: Option<u32>,
    max_fps: Option<u32>,
) -> Result<(), String> {
    stop_scrcpy_session(&serial);

    let scrcpy = which::which("scrcpy")
        .map_err(|_| "scrcpy not found in PATH. Install scrcpy and try again.".to_string())?;

    let mut cmd = Command::new(scrcpy);
    cmd.args([
        "--serial",
        &serial,
        "--no-audio",
        "--stay-awake",
        "--window-title",
        &format!("CapuBridge scrcpy - {serial}"),
    ]);

    if let Some(size) = max_size.filter(|v| *v > 0) {
        cmd.args(["--max-size", &size.to_string()]);
    }
    if let Some(rate) = bit_rate_mbps.filter(|v| *v > 0) {
        cmd.args(["--video-bit-rate", &format!("{rate}M")]);
    }
    if let Some(fps) = max_fps.filter(|v| *v > 0) {
        cmd.args(["--max-fps", &fps.to_string()]);
    }

    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start scrcpy: {e}"))?;

    if let Ok(mut sessions) = SCRCPY_SESSIONS.lock() {
        sessions.insert(serial, child);
    }
    Ok(())
}

#[tauri::command]
pub fn adb_mirror_stop_scrcpy(serial: String) -> Result<(), String> {
    stop_scrcpy_session(&serial);
    Ok(())
}

#[tauri::command]
pub async fn adb_mirror_start_recording(serial: String) -> Result<(), String> {
    // Stop any running recording first
    {
        if let Ok(mut sessions) = RECORDING_SESSIONS.lock() {
            if let Some(flag) = sessions.remove(&serial) {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }

    let stop_flag = Arc::new(AtomicBool::new(false));
    {
        let mut sessions = RECORDING_SESSIONS.lock().unwrap();
        sessions.insert(serial.clone(), stop_flag.clone());
    }

    // screenrecord runs until killed; background blocking thread
    let serial_clone = serial.clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(mut device) = get_device(&serial_clone) {
            let mut out = Vec::new();
            let _ = device.shell_command(
                &format!("screenrecord --time-limit 1800 /sdcard/capubridge_rec.mp4"),
                Some(&mut out),
                None::<&mut dyn Write>,
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn adb_mirror_stop_recording(serial: String, save_path: String) -> Result<(), String> {
    // Mark session as stopped
    {
        if let Ok(mut sessions) = RECORDING_SESSIONS.lock() {
            if let Some(flag) = sessions.remove(&serial) {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }

    // Send SIGINT to screenrecord on device so it finalizes the MP4
    let s = serial.clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(mut device) = get_device(&s) {
            let mut out = Vec::new();
            let _ = device.shell_command(
                &format!("kill -2 $(pidof screenrecord) 2>/dev/null; true"),
                Some(&mut out),
                None::<&mut dyn Write>,
            );
        }
    })
    .await
    .ok();

    // Wait for device to finalize the file
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Pull the file using the adb binary
    let adb = which::which("adb").map_err(|_| {
        "adb binary not found in PATH. Install Android SDK Platform Tools.".to_string()
    })?;

    let pull = tokio::process::Command::new(&adb)
        .args(["-s", &serial, "pull", "/sdcard/capubridge_rec.mp4", &save_path])
        .output()
        .await
        .map_err(|e| format!("adb pull failed: {e}"))?;

    if !pull.status.success() {
        return Err(format!(
            "adb pull error: {}",
            String::from_utf8_lossy(&pull.stderr)
        ));
    }

    // Remove the file from device
    let s2 = serial.clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(mut device) = get_device(&s2) {
            let mut out = Vec::new();
            let _ = device.shell_command(
                &format!("rm /sdcard/capubridge_rec.mp4"),
                Some(&mut out),
                None::<&mut dyn Write>,
            );
        }
    })
    .await
    .ok();

    Ok(())
}
