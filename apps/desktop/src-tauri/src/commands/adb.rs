use adb_client::{
    server::{ADBServer, DeviceLong, DeviceState},
    server_device::ADBServerDevice,
    ADBDeviceExt, RebootType,
};
use base64::{engine::general_purpose, Engine as _};
use parking_lot::Mutex;
use prost::Message;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Read, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener, TcpStream};
use std::sync::LazyLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn create_adb_server() -> ADBServer {
    #[cfg(target_os = "windows")]
    {
        // adb_client runs `adb start-server` on local connect().
        // On some Windows setups this triggers repeated RunDLL popups due to
        // third-party DLL injection into spawned adb.exe processes.
        // Force manual adb server startup to avoid popups.
        return ADBServer::new_from_path(
            SocketAddrV4::new(Ipv4Addr::LOCALHOST, 5037),
            Some("__capubridge_disable_adb_autostart__".to_string()),
        );
    }

    #[cfg(not(target_os = "windows"))]
    {
        ADBServer::default()
    }
}

pub(crate) fn map_adb_server_err(err: impl std::fmt::Display) -> String {
    let msg = err.to_string();
    #[cfg(target_os = "windows")]
    {
        if msg.contains("Connection refused")
            || msg.contains("NotConnected")
            || msg.contains("failed to lookup address information")
        {
            return format!(
                "{msg}. adb auto-start is disabled on Windows to avoid RunDLL popups. Start adb once manually with: adb start-server"
            );
        }
    }
    msg
}

static ADB_SERVER: LazyLock<Mutex<ADBServer>> = LazyLock::new(|| Mutex::new(create_adb_server()));
static AYA_FORWARD_PORTS: LazyLock<Mutex<HashMap<String, u16>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static PACKAGE_SCAN_CANCELLATIONS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

const APP_HELPER_REMOTE_DEX_PATH: &str = "/data/local/tmp/capubridge/capubridge-device-helper.dex";
const AYA_SOCKET_NAME: &str = "localabstract:aya";
const APP_HELPER_DEX_BYTES: &[u8] = include_bytes!("../../resources/capubridge-device-helper.dex");
const AYA_PACKAGE_INFO_CHUNK_SIZE: usize = 120;

#[derive(Clone, PartialEq, Message)]
struct AyaRequest {
    #[prost(string, tag = "1")]
    id: String,
    #[prost(string, tag = "2")]
    method: String,
    #[prost(string, tag = "3")]
    params: String,
}

#[derive(Clone, PartialEq, Message)]
struct AyaResponse {
    #[prost(string, tag = "1")]
    id: String,
    #[prost(string, tag = "2")]
    result: String,
}

#[allow(dead_code)]
pub fn get_server() -> &'static Mutex<ADBServer> {
    &ADB_SERVER
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdbDevice {
    pub serial: String,
    pub model: String,
    pub product: String,
    pub transport_id: String,
    pub connection_type: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub serial: String,
    pub model: String,
    pub manufacturer: String,
    pub android_version: String,
    pub api_level: u32,
    pub screen_resolution: String,
    pub screen_dpi: u32,
    pub cpu_arch: String,
    pub total_ram: u64,
    pub available_ram: u64,
    pub total_storage: u64,
    pub available_storage: u64,
    pub battery_level: u32,
    pub battery_charging: bool,
    pub ip_addresses: Vec<String>,
}

fn state_to_string(state: &DeviceState) -> String {
    match state {
        DeviceState::Device => "online".to_string(),
        DeviceState::Offline => "offline".to_string(),
        DeviceState::Unauthorized => "unauthorized".to_string(),
        DeviceState::Connecting => "connecting".to_string(),
        DeviceState::Bootloader => "bootloader".to_string(),
        DeviceState::Host => "host".to_string(),
        DeviceState::Recovery => "recovery".to_string(),
        DeviceState::Sideload => "sideload".to_string(),
        DeviceState::NoDevice => "no_device".to_string(),
        DeviceState::Authorizing => "authorizing".to_string(),
        DeviceState::NoPerm => "no_perm".to_string(),
        DeviceState::Detached => "detached".to_string(),
        DeviceState::Rescue => "rescue".to_string(),
    }
}

fn connection_type_from_serial(serial: &str) -> String {
    if serial.contains('.') || serial.contains(':') {
        "wifi".to_string()
    } else {
        "usb".to_string()
    }
}

fn get_prop(device: &mut ADBServerDevice, prop: &str) -> String {
    let mut output = Vec::new();
    let _ = device.shell_command(
        &format!("getprop {prop}"),
        Some(&mut output),
        None::<&mut dyn Write>,
    );
    String::from_utf8_lossy(&output).trim().to_string()
}

fn shell_output(device: &mut ADBServerDevice, cmd: &str) -> String {
    let mut output = Vec::new();
    let _ = device.shell_command(&cmd, Some(&mut output), None::<&mut dyn Write>);
    String::from_utf8_lossy(&output).to_string()
}

fn shell_escape(value: &str) -> String {
    value.replace('\'', "'\\''")
}

fn get_current_user(device: &mut ADBServerDevice) -> u32 {
    shell_output(device, "am get-current-user")
        .trim()
        .parse()
        .unwrap_or(0)
}

fn parse_package_list_entry(line: &str) -> Option<(Option<String>, String)> {
    let entry = line.trim().strip_prefix("package:")?;
    let primary = entry.split_whitespace().next()?.trim();
    if primary.is_empty() {
        return None;
    }

    if let Some(eq_pos) = primary.rfind('=') {
        let apk_path = primary[..eq_pos].trim().to_string();
        let package_name = primary[eq_pos + 1..].trim().to_string();
        if package_name.is_empty() {
            return None;
        }
        return Some((Some(apk_path), package_name));
    }

    Some((None, primary.to_string()))
}

fn list_package_name_set(device: &mut ADBServerDevice, cmd: &str) -> HashSet<String> {
    shell_output(device, cmd)
        .lines()
        .filter_map(|line| parse_package_list_entry(line).map(|(_, package_name)| package_name))
        .collect()
}

fn list_package_names(device: &mut ADBServerDevice, cmd: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut seen = HashSet::new();

    for name in shell_output(device, cmd)
        .lines()
        .filter_map(|line| parse_package_list_entry(line).map(|(_, package_name)| package_name))
    {
        if seen.insert(name.clone()) {
            names.push(name);
        }
    }

    names
}

fn extract_token_value(line: &str, key: &str) -> Option<String> {
    let start = line.find(key)? + key.len();
    let rest = &line[start..];
    let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
    let value = rest[..end].trim_matches(',').trim();
    if value.is_empty() {
        return None;
    }
    Some(value.to_string())
}

fn resolve_launchable_activity(
    device: &mut ADBServerDevice,
    package_name: &str,
    current_user: u32,
) -> Option<String> {
    let cmd = format!(
        "cmd package resolve-activity --brief --user {} {} 2>/dev/null",
        current_user, package_name
    );
    let resolved = shell_output(device, &cmd);
    if let Some(activity) = resolved
        .lines()
        .map(str::trim)
        .rev()
        .find(|line| line.contains('/') && !line.starts_with("priority="))
    {
        return Some(activity.to_string());
    }

    let package_dump = shell_output(
        device,
        &format!("dumpsys package '{}' 2>/dev/null", shell_escape(package_name)),
    );
    let mut saw_main_action = false;
    for line in package_dump.lines() {
        let trimmed = line.trim();
        if trimmed.contains("android.intent.action.MAIN") {
            saw_main_action = true;
            continue;
        }

        if saw_main_action {
            if let Some(component) = trimmed
                .split_whitespace()
                .find(|token| token.starts_with(&format!("{package_name}/")))
            {
                return Some(component.trim_end_matches(':').to_string());
            }

            if trimmed.is_empty() {
                saw_main_action = false;
            }
        }
    }

    None
}

fn get_package_apk_path(
    device: &mut ADBServerDevice,
    package_name: &str,
    current_user: u32,
) -> Option<String> {
    let output = shell_output(
        device,
        &format!(
            "pm path --user {} '{}' 2>/dev/null",
            current_user,
            shell_escape(package_name)
        ),
    );

    output
        .lines()
        .find_map(|line| line.trim().strip_prefix("package:").map(str::to_string))
}

fn get_package_apk_paths(
    device: &mut ADBServerDevice,
    package_name: &str,
    current_user: u32,
) -> Vec<String> {
    let output = shell_output(
        device,
        &format!(
            "pm path --user {} '{}' 2>/dev/null",
            current_user,
            shell_escape(package_name)
        ),
    );

    output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:").map(str::to_string))
        .collect()
}

#[derive(Debug, Default, Clone)]
struct PackageDiskStats {
    app_size: u64,
    data_size: u64,
    cache_size: u64,
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

fn parse_diskstats(output: &str) -> HashMap<String, PackageDiskStats> {
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

    let mut stats = HashMap::new();
    for (index, package_name) in package_names.into_iter().enumerate() {
        stats.insert(
            package_name,
            PackageDiskStats {
                app_size: *app_sizes.get(index).unwrap_or(&0),
                data_size: *data_sizes.get(index).unwrap_or(&0),
                cache_size: *cache_sizes.get(index).unwrap_or(&0),
            },
        );
    }

    stats
}

fn read_length_delimited_payload(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let mut length: u64 = 0;
    let mut shift = 0;
    let mut consumed = 0;

    while consumed < 10 {
        let mut byte = [0_u8; 1];
        stream
            .read_exact(&mut byte)
            .map_err(|e| format!("Failed to read aya message prefix: {e}"))?;
        let value = byte[0];
        length |= u64::from(value & 0x7f) << shift;
        consumed += 1;

        if (value & 0x80) == 0 {
            break;
        }
        shift += 7;
    }

    if consumed == 10 && (length & (1_u64 << 63)) != 0 {
        return Err("Invalid aya message length".to_string());
    }

    if length == 0 {
        return Err("Empty aya message payload".to_string());
    }
    if length > 8 * 1024 * 1024 {
        return Err("Aya message too large".to_string());
    }

    let mut payload = vec![0_u8; length as usize];
    stream
        .read_exact(&mut payload)
        .map_err(|e| format!("Failed to read aya message payload: {e}"))?;
    Ok(payload)
}

fn send_aya_request(port: u16, method: &str, params: &Value) -> Result<Value, String> {
    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .map_err(|e| format!("Failed to connect to aya socket on port {port}: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(8)))
        .map_err(|e| format!("Failed to set aya read timeout: {e}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(8)))
        .map_err(|e| format!("Failed to set aya write timeout: {e}"))?;

    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis()
        .to_string();
    let request = AyaRequest {
        id: id.clone(),
        method: method.to_string(),
        params: params.to_string(),
    };
    let mut request_buf = Vec::new();
    request
        .encode_length_delimited(&mut request_buf)
        .map_err(|e| format!("Failed to encode aya request: {e}"))?;
    stream
        .write_all(&request_buf)
        .map_err(|e| format!("Failed to write aya request: {e}"))?;

    let payload = read_length_delimited_payload(&mut stream)?;
    let response = AyaResponse::decode(payload.as_slice())
        .map_err(|e| format!("Failed to decode aya response: {e}"))?;
    if response.id != id {
        return Err("Aya response id mismatch".to_string());
    }
    serde_json::from_str::<Value>(&response.result)
        .map_err(|e| format!("Invalid aya response payload: {e}"))
}

fn aya_server_running(device: &mut ADBServerDevice) -> bool {
    shell_output(device, "cat /proc/net/unix 2>/dev/null").contains("@aya")
}

fn ensure_aya_server(device: &mut ADBServerDevice) -> Result<(), String> {
    if aya_server_running(device) {
        return Ok(());
    }

    let mut dex_stream = Cursor::new(APP_HELPER_DEX_BYTES);
    shell_output(device, "mkdir -p /data/local/tmp/capubridge 2>/dev/null");
    device
        .push(&mut dex_stream, &APP_HELPER_REMOTE_DEX_PATH)
        .map_err(|e| format!("Failed to push app helper dex: {e}"))?;

    shell_output(
        device,
        &format!(
            "CLASSPATH={} app_process /system/bin io.liriliri.aya.Server >/dev/null 2>&1 &",
            APP_HELPER_REMOTE_DEX_PATH
        ),
    );

    for _ in 0..30 {
        if aya_server_running(device) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(120));
    }

    Err("Aya helper server did not start on device".to_string())
}

fn allocate_local_port() -> Result<u16, String> {
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to allocate local port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to inspect local port: {e}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn create_aya_forward(device: &mut ADBServerDevice) -> Result<u16, String> {
    for _ in 0..8 {
        let local_port = allocate_local_port()?;
        let local = format!("tcp:{local_port}");
        let remote = AYA_SOCKET_NAME.to_string();
        if device.forward(remote.clone(), local).is_ok() {
            return Ok(local_port);
        }
    }
    Err("Failed to create adb forward for aya socket".to_string())
}

fn ensure_aya_forward(device: &mut ADBServerDevice, serial: &str) -> Result<u16, String> {
    if let Some(port) = AYA_FORWARD_PORTS.lock().get(serial).copied() {
        if send_aya_request(port, "getVersion", &Value::Object(Default::default())).is_ok() {
            return Ok(port);
        }
        AYA_FORWARD_PORTS.lock().remove(serial);
    }

    let port = create_aya_forward(device)?;
    AYA_FORWARD_PORTS.lock().insert(serial.to_string(), port);
    Ok(port)
}

fn aya_call(
    device: &mut ADBServerDevice,
    serial: &str,
    method: &str,
    params: &Value,
) -> Result<Value, String> {
    ensure_aya_server(device)?;

    for attempt in 0..2 {
        let port = ensure_aya_forward(device, serial)?;
        match send_aya_request(port, method, params) {
            Ok(result) => return Ok(result),
            Err(err) if attempt == 0 => {
                log::warn!(
                    "[aya_call] retrying serial={} method={} after error: {}",
                    serial,
                    method,
                    err
                );
                AYA_FORWARD_PORTS.lock().remove(serial);
            }
            Err(err) => return Err(err),
        }
    }

    Err("Aya helper request failed".to_string())
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AyaPackageInfo {
    package_name: String,
    apk_path: Option<String>,
    label: Option<String>,
    icon: Option<String>,
    system: Option<bool>,
    enabled: Option<bool>,
}

fn request_package_scan_cancel(serial: &str) {
    PACKAGE_SCAN_CANCELLATIONS.lock().insert(serial.to_string());
}

fn clear_package_scan_cancel(serial: &str) {
    PACKAGE_SCAN_CANCELLATIONS.lock().remove(serial);
}

fn package_scan_canceled(serial: &str) -> bool {
    PACKAGE_SCAN_CANCELLATIONS.lock().contains(serial)
}

fn aya_get_package_infos(
    device: &mut ADBServerDevice,
    serial: &str,
    package_names: &[String],
) -> Result<HashMap<String, AyaPackageInfo>, String> {
    let mut map = HashMap::new();
    for chunk in package_names.chunks(AYA_PACKAGE_INFO_CHUNK_SIZE) {
        if package_scan_canceled(serial) {
            break;
        }

        let params = serde_json::json!({ "packageNames": chunk });
        let response = aya_call(device, serial, "getPackageInfos", &params)?;
        let infos = response
            .get("packageInfos")
            .and_then(Value::as_array)
            .ok_or_else(|| "Aya response missing packageInfos".to_string())?;

        for info in infos {
            if let Ok(parsed) = serde_json::from_value::<AyaPackageInfo>(info.clone()) {
                map.insert(parsed.package_name.clone(), parsed);
            }
        }
    }

    Ok(map)
}

fn parse_device_long(dl: &DeviceLong) -> AdbDevice {
    let identifier = dl.identifier.clone();
    let connection_type = connection_type_from_serial(&identifier);
    let status = state_to_string(&dl.state);
    let model = dl.model.clone();
    let product = dl.product.clone();

    AdbDevice {
        serial: identifier,
        model,
        product,
        transport_id: dl.transport_id.to_string(),
        connection_type,
        status,
    }
}

#[tauri::command]
pub fn adb_list_devices() -> Result<Vec<AdbDevice>, String> {
    let mut server = ADB_SERVER.lock();
    let devices = server.devices_long().map_err(map_adb_server_err)?;

    Ok(devices
        .iter()
        .filter(|d| matches!(d.state, DeviceState::Device))
        .map(|d| parse_device_long(d))
        .collect())
}

#[tauri::command]
pub fn adb_get_device_info(serial: String) -> Result<DeviceInfo, String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    let model = get_prop(&mut device, "ro.product.model");
    let manufacturer = get_prop(&mut device, "ro.product.manufacturer");
    let android_version = get_prop(&mut device, "ro.build.version.release");
    let api_level: u32 = get_prop(&mut device, "ro.build.version.sdk")
        .parse()
        .unwrap_or(0);
    let cpu_arch = get_prop(&mut device, "ro.product.cpu.abi");

    let screen_resolution = shell_output(&mut device, "wm size")
        .lines()
        .find(|l| l.contains(":"))
        .map(|l| l.split(':').last().unwrap_or("").trim().to_string())
        .unwrap_or_default();

    let screen_dpi: u32 = shell_output(&mut device, "wm density")
        .split(':')
        .last()
        .map(|s| s.trim().parse().unwrap_or(0))
        .unwrap_or(0);

    let total_ram: u64 = shell_output(&mut device, "cat /proc/meminfo")
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse::<u64>().ok())
        .map(|kb| kb * 1024)
        .unwrap_or(0);

    let available_ram: u64 = 0;

    let (total_storage, available_storage) = {
        let out = shell_output(&mut device, "df /data");
        let lines: Vec<&str> = out.lines().collect();
        if lines.len() >= 2 {
            let parts: Vec<&str> = lines[1].split_whitespace().collect();
            let total = parts
                .get(1)
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0)
                * 1024;
            let avail = parts
                .get(3)
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0)
                * 1024;
            (total, avail)
        } else {
            (0, 0)
        }
    };

    let (battery_level, battery_charging) = {
        let out = shell_output(&mut device, "dumpsys battery");
        let level = out
            .lines()
            .find(|l| l.contains("level"))
            .and_then(|l| l.split(':').last().map(|s| s.trim().parse().unwrap_or(0)))
            .unwrap_or(0);
        let charging = out
            .lines()
            .find(|l| l.contains("AC powered") || l.contains("USB powered"))
            .map(|l| l.contains("true"))
            .unwrap_or(false);
        (level, charging)
    };

    let ip_addresses = shell_output(&mut device, "ip -4 addr show")
        .lines()
        .filter(|l| l.trim().starts_with("inet "))
        .filter_map(|l| {
            l.split_whitespace()
                .nth(1)
                .map(|s| s.split('/').next().unwrap_or("").to_string())
        })
        .filter(|ip| !ip.starts_with("127."))
        .collect();

    Ok(DeviceInfo {
        serial,
        model,
        manufacturer,
        android_version,
        api_level,
        screen_resolution,
        screen_dpi,
        cpu_arch,
        total_ram,
        available_ram,
        total_storage,
        available_storage,
        battery_level,
        battery_charging,
        ip_addresses,
    })
}

#[tauri::command]
pub fn adb_shell_command(serial: String, command: String) -> Result<String, String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    let mut output = Vec::new();
    device
        .shell_command(&command, Some(&mut output), None::<&mut dyn Write>)
        .map_err(|e| format!("Shell command failed: {e}"))?;

    Ok(String::from_utf8_lossy(&output).to_string())
}

#[tauri::command]
pub fn adb_connect_device(host: String, port: u16) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let addr = SocketAddrV4::new(host.parse::<Ipv4Addr>().map_err(|e| e.to_string())?, port);
    server.connect_device(addr).map_err(map_adb_server_err)
}

#[tauri::command]
pub fn adb_disconnect_device(host: String, port: u16) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let addr = SocketAddrV4::new(host.parse::<Ipv4Addr>().map_err(|e| e.to_string())?, port);
    server.disconnect_device(addr).map_err(map_adb_server_err)
}

#[tauri::command]
pub fn adb_pair_device(host: String, port: u16, code: String) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let addr = SocketAddrV4::new(host.parse::<Ipv4Addr>().map_err(|e| e.to_string())?, port);
    server.pair(addr, code).map_err(map_adb_server_err)
}

#[tauri::command]
pub fn adb_tcpip(serial: String, port: u16) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;
    device.tcpip(port).map_err(map_adb_server_err)
}

#[tauri::command]
pub fn adb_reboot(serial: String, mode: Option<String>) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;
    let reboot_type = match mode.as_deref() {
        Some("recovery") => RebootType::Recovery,
        Some("bootloader") => RebootType::Bootloader,
        _ => RebootType::System,
    };
    device.reboot(reboot_type).map_err(map_adb_server_err)
}

#[tauri::command]
pub fn adb_root(serial: String) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;
    device.root().map_err(map_adb_server_err)
}

#[tauri::command]
pub fn adb_restart_server() -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    server.kill().map_err(map_adb_server_err)?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdbPackage {
    pub package_name: String,
    pub apk_path: String,
    pub system: bool,
    pub enabled: bool,
    pub label: Option<String>,
    pub icon_path: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PackageListScope {
    ThirdParty,
    All,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdbPackageDetails {
    pub package_name: String,
    pub apk_path: Option<String>,
    pub version_name: Option<String>,
    pub version_code: Option<String>,
    pub first_install_time: Option<String>,
    pub last_update_time: Option<String>,
    pub min_sdk_version: Option<u32>,
    pub target_sdk_version: Option<u32>,
    pub installer_package_name: Option<String>,
    pub data_dir: Option<String>,
    pub external_data_dir: Option<String>,
    pub media_dir: Option<String>,
    pub obb_dir: Option<String>,
    pub app_size: Option<u64>,
    pub data_size: Option<u64>,
    pub cache_size: Option<u64>,
    pub launchable_activity: Option<String>,
}

#[tauri::command]
pub fn adb_list_packages(serial: String, scope: Option<PackageListScope>) -> Result<Vec<AdbPackage>, String> {
    clear_package_scan_cancel(&serial);
    let result = (|| -> Result<Vec<AdbPackage>, String> {
        let mut server = ADB_SERVER.lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

        let list_scope = scope.unwrap_or(PackageListScope::All);
        let current_user = get_current_user(&mut device);
        if package_scan_canceled(&serial) {
            return Ok(Vec::new());
        }

        let package_list_cmd = match list_scope {
            PackageListScope::ThirdParty => format!("pm list packages -3 --user {}", current_user),
            PackageListScope::All => format!("pm list packages --user {}", current_user),
        };
        let package_names = list_package_names(
            &mut device,
            &package_list_cmd,
        );
        if package_scan_canceled(&serial) {
            return Ok(Vec::new());
        }

        let system_packages = if list_scope == PackageListScope::All {
            list_package_name_set(
                &mut device,
                &format!("pm list packages -s --user {}", current_user),
            )
        } else {
            HashSet::new()
        };
        if package_scan_canceled(&serial) {
            return Ok(Vec::new());
        }

        let disabled_packages = list_package_name_set(
            &mut device,
            &format!("pm list packages -d --user {}", current_user),
        );
        if package_scan_canceled(&serial) {
            return Ok(Vec::new());
        }

        let package_path_map: HashMap<String, String> = shell_output(
            &mut device,
            &match list_scope {
                PackageListScope::ThirdParty => {
                    format!("pm list packages -f -3 --user {}", current_user)
                }
                PackageListScope::All => format!("pm list packages -f --user {}", current_user),
            },
        )
        .lines()
        .filter_map(|line| {
            let (apk_path, package_name) = parse_package_list_entry(line)?;
            Some((package_name, apk_path.unwrap_or_default()))
        })
        .collect();

        let aya_info_map = match aya_get_package_infos(&mut device, &serial, &package_names) {
            Ok(info) => info,
            Err(err) => {
                log::warn!(
                    "[adb_list_packages] aya metadata unavailable for serial {}: {}",
                    serial,
                    err
                );
                HashMap::new()
            }
        };
        if package_scan_canceled(&serial) {
            return Ok(Vec::new());
        }

        let mut packages = Vec::with_capacity(package_names.len());
        for package_name in package_names {
            if package_scan_canceled(&serial) {
                break;
            }
            let aya_info = aya_info_map.get(&package_name);
            let apk_path = package_path_map
                .get(&package_name)
                .cloned()
                .filter(|path| !path.is_empty())
                .or_else(|| aya_info.and_then(|info| info.apk_path.clone()))
                .or_else(|| get_package_apk_path(&mut device, &package_name, current_user))
                .unwrap_or_default();

            packages.push(AdbPackage {
                system: aya_info
                    .and_then(|info| info.system)
                    .unwrap_or_else(|| {
                        if list_scope == PackageListScope::ThirdParty {
                            false
                        } else {
                            system_packages.contains(&package_name)
                        }
                    }),
                enabled: aya_info
                    .and_then(|info| info.enabled)
                    .unwrap_or_else(|| !disabled_packages.contains(&package_name)),
                package_name,
                apk_path,
                label: aya_info.and_then(|info| info.label.clone()),
                icon_path: aya_info.and_then(|info| info.icon.clone()),
            });
        }

        packages.sort_by(|a, b| a.package_name.cmp(&b.package_name));
        Ok(packages)
    })();
    clear_package_scan_cancel(&serial);
    result
}

#[tauri::command]
pub fn adb_cancel_list_packages(serial: String) -> Result<(), String> {
    request_package_scan_cancel(&serial);
    Ok(())
}

#[tauri::command]
pub fn adb_get_package_details(
    serial: String,
    package_name: String,
) -> Result<AdbPackageDetails, String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    let current_user = get_current_user(&mut device);
    let package_dump = shell_output(
        &mut device,
        &format!("dumpsys package '{}' 2>/dev/null", shell_escape(&package_name)),
    );
    let diskstats = parse_diskstats(&shell_output(&mut device, "dumpsys diskstats 2>/dev/null"));
    let sizes = diskstats.get(&package_name).cloned().unwrap_or_default();

    let mut details = AdbPackageDetails {
        package_name: package_name.clone(),
        apk_path: get_package_apk_path(&mut device, &package_name, current_user),
        version_name: None,
        version_code: None,
        first_install_time: None,
        last_update_time: None,
        min_sdk_version: None,
        target_sdk_version: None,
        installer_package_name: None,
        data_dir: None,
        external_data_dir: Some(format!("/sdcard/Android/data/{package_name}")),
        media_dir: Some(format!("/sdcard/Android/media/{package_name}")),
        obb_dir: Some(format!("/sdcard/Android/obb/{package_name}")),
        app_size: (sizes.app_size > 0).then_some(sizes.app_size),
        data_size: (sizes.data_size > 0).then_some(sizes.data_size),
        cache_size: (sizes.cache_size > 0).then_some(sizes.cache_size),
        launchable_activity: None,
    };

    for line in package_dump.lines() {
        let trimmed = line.trim();

        if let Some(version_name) = trimmed.strip_prefix("versionName=") {
            details.version_name = Some(version_name.to_string());
        } else if let Some(first_install_time) = trimmed.strip_prefix("firstInstallTime=") {
            details.first_install_time = Some(first_install_time.to_string());
        } else if let Some(last_update_time) = trimmed.strip_prefix("lastUpdateTime=") {
            details.last_update_time = Some(last_update_time.to_string());
        } else if let Some(installer_package_name) = trimmed.strip_prefix("installerPackageName=") {
            details.installer_package_name = Some(installer_package_name.to_string());
        } else if let Some(data_dir) = extract_token_value(trimmed, "dataDir=") {
            details.data_dir = Some(data_dir);
        } else if details.version_code.is_none() {
            details.version_code = extract_token_value(trimmed, "versionCode=");
        }

        if details.min_sdk_version.is_none() {
            details.min_sdk_version = extract_token_value(trimmed, "minSdk=")
                .or_else(|| extract_token_value(trimmed, "minSdkVersion="))
                .and_then(|value| value.parse::<u32>().ok());
        }

        if details.target_sdk_version.is_none() {
            details.target_sdk_version = extract_token_value(trimmed, "targetSdk=")
                .or_else(|| extract_token_value(trimmed, "targetSdkVersion="))
                .and_then(|value| value.parse::<u32>().ok());
        }
    }

    if details.data_dir.is_none() {
        details.data_dir = Some(format!("/data/data/{package_name}"));
    }

    details.launchable_activity =
        resolve_launchable_activity(&mut device, &package_name, current_user);

    Ok(details)
}

#[tauri::command]
pub fn adb_open_package(serial: String, package_name: String) -> Result<String, String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    let current_user = get_current_user(&mut device);
    if let Some(activity) = resolve_launchable_activity(&mut device, &package_name, current_user) {
        let output = shell_output(
            &mut device,
            &format!("am start --user {} -n '{}' 2>&1", current_user, shell_escape(&activity)),
        );
        let trimmed = output.trim();
        if trimmed.contains("Error")
            || trimmed.contains("Exception")
            || trimmed.contains("Activity not started")
        {
            return Err(if trimmed.is_empty() {
                "Failed to launch app".to_string()
            } else {
                trimmed.to_string()
            });
        }
        return Ok(trimmed.to_string());
    }

    let output = shell_output(
        &mut device,
        &format!(
            "monkey -p '{}' --pct-syskeys 0 -c android.intent.category.LAUNCHER 1 2>&1",
            shell_escape(&package_name)
        ),
    );
    let trimmed = output.trim();
    if trimmed.contains("No activities found") || trimmed.contains("Exception") || trimmed.contains("Error")
    {
        return Err(if trimmed.is_empty() {
            "No launchable activity found".to_string()
        } else {
            trimmed.to_string()
        });
    }

    Ok(trimmed.to_string())
}

/// Extract the app icon from an APK already installed on the device.
/// Uses `unzip -p` (available via toybox on Android 6+) to stream just the icon
/// without pulling the whole APK. Returns a `data:<mime>;base64,...` URL.
#[tauri::command]
pub async fn adb_get_app_icon(
    serial: String,
    apk_path: String,
    package_name: Option<String>,
    icon_path: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Independent connection so multiple icon fetches run in parallel
        let mut server = create_adb_server();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {e}"))?;

        if let Some(icon_path) = icon_path.as_ref().filter(|path| !path.trim().is_empty()) {
            let mut icon_bytes = Vec::new();
            if device.pull(icon_path, &mut icon_bytes).is_ok() && !icon_bytes.is_empty() {
                let encoded = general_purpose::STANDARD.encode(icon_bytes);
                return Ok(format!("data:image/png;base64,{encoded}"));
            }
        }

        // Try densities from high to medium; prefer PNG then WebP
        let candidates: &[(&str, &str)] = &[
            ("res/mipmap-xhdpi-v4/ic_launcher.png", "image/png"),
            ("res/mipmap-hdpi-v4/ic_launcher.png", "image/png"),
            ("res/drawable-xhdpi-v4/ic_launcher.png", "image/png"),
            ("res/drawable-hdpi-v4/ic_launcher.png", "image/png"),
            ("res/mipmap-mdpi-v4/ic_launcher.png", "image/png"),
            ("res/mipmap-xhdpi-v4/ic_launcher.webp", "image/webp"),
            ("res/mipmap-hdpi-v4/ic_launcher.webp", "image/webp"),
            ("res/mipmap-mdpi-v4/ic_launcher.webp", "image/webp"),
            ("res/mipmap-xhdpi-v4/ic_launcher_round.png", "image/png"),
            ("res/mipmap-hdpi-v4/ic_launcher_round.png", "image/png"),
        ];

        let current_user = get_current_user(&mut device);
        let mut apk_paths = Vec::new();
        if !apk_path.trim().is_empty() {
            apk_paths.push(apk_path.clone());
        }
        if let Some(package_name) = package_name.as_ref().filter(|name| !name.trim().is_empty()) {
            apk_paths.extend(get_package_apk_paths(&mut device, package_name, current_user));
        }
        if apk_paths.is_empty() {
            return Err("no apk path".to_string());
        }

        let mut seen = HashSet::new();
        apk_paths.retain(|path| seen.insert(path.clone()));

        for current_apk_path in apk_paths {
            let escaped = current_apk_path.replace('\'', "'\\''");

            let try_icon_path = |device: &mut ADBServerDevice, icon_path: &str, mime: &str| {
                let mut out = Vec::new();
                let cmd = format!("unzip -p '{}' '{}' 2>/dev/null | base64", escaped, icon_path);
                let _ = device.shell_command(&cmd, Some(&mut out), None::<&mut dyn Write>);
                // Strip whitespace (base64 wraps at 76 chars on Android)
                let b64: String = out
                    .iter()
                    .filter(|&&b| !matches!(b, b'\n' | b'\r' | b' '))
                    .map(|&b| b as char)
                    .collect();
                // Validate magic bytes in base64 to reject unzip error text:
                //   PNG  -> raw \x89PNG -> base64 "iVBOR"
                //   WebP -> raw RIFF   -> base64 "UklGR"
                let is_valid =
                    (b64.starts_with("iVBOR") || b64.starts_with("UklGR")) && b64.len() > 100;
                if is_valid {
                    return Some(format!("data:{};base64,{}", mime, b64));
                }
                None
            };

            for (icon_path, mime) in candidates {
                if let Some(data_url) = try_icon_path(&mut device, icon_path, mime) {
                    return Ok(data_url);
                }
            }

            // Fallback: discover candidate resources dynamically for apps with non-standard icon names.
            let list_cmd = format!("unzip -l '{}' 'res/*' 2>/dev/null", escaped);
            let listing = shell_output(&mut device, &list_cmd);
            let mut discovered: Vec<String> = listing
                .lines()
                .filter_map(|line| line.split_whitespace().last().map(str::to_string))
                .filter(|path| path.starts_with("res/"))
                .filter(|path| path.ends_with(".png") || path.ends_with(".webp"))
                .filter(|path| path.contains("mipmap") || path.contains("drawable"))
                .filter(|path| {
                    let lower = path.to_lowercase();
                    lower.contains("launcher") || lower.contains("icon")
                })
                .collect();

            discovered.sort_by_key(|path| {
                let lower = path.to_lowercase();
                let mut score = 0_i32;

                if lower.contains("launcher") {
                    score += 200;
                }
                if lower.contains("icon") {
                    score += 120;
                }
                if lower.contains("round") {
                    score += 30;
                }
                if lower.contains("foreground") {
                    score -= 40;
                }
                if lower.contains("background") {
                    score -= 60;
                }
                if lower.contains("xxxhdpi") {
                    score += 90;
                } else if lower.contains("xxhdpi") {
                    score += 80;
                } else if lower.contains("xhdpi") {
                    score += 70;
                } else if lower.contains("hdpi") {
                    score += 60;
                } else if lower.contains("mdpi") {
                    score += 50;
                } else if lower.contains("nodpi") {
                    score += 40;
                }

                -score
            });
            discovered.dedup();

            for icon_path in discovered.into_iter().take(24) {
                let mime = if icon_path.ends_with(".webp") {
                    "image/webp"
                } else {
                    "image/png"
                };
                if let Some(data_url) = try_icon_path(&mut device, &icon_path, mime) {
                    return Ok(data_url);
                }
            }
        }

        Err("no icon".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebViewSocket {
    pub socket_name: String,
    pub pid: Option<u32>,
    pub package_name: Option<String>,
}

#[tauri::command]
pub fn adb_list_webview_sockets(serial: String) -> Result<Vec<WebViewSocket>, String> {
    log::info!("[adb_list_webview_sockets] serial={}", serial);

    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    log::info!("[adb_list_webview_sockets] Running shell command");
    let unix_output = shell_output(&mut device, "cat /proc/net/unix");
    log::info!(
        "[adb_list_webview_sockets] Unix output lines: {}",
        unix_output.lines().count()
    );

    let mut sockets: Vec<WebViewSocket> = unix_output
        .lines()
        .filter(|l| l.contains("devtools_remote"))
        .filter_map(|l| {
            let path = l.split_whitespace().last()?;
            if !path.starts_with('@') {
                return None;
            }
            let socket_name = path.trim_start_matches('@').to_string();
            // socket names are like webview_devtools_remote_1234 — PID is the last segment
            let pid = socket_name
                .rsplit('_')
                .next()
                .and_then(|s| s.parse::<u32>().ok());
            log::info!(
                "[adb_list_webview_sockets] Found socket: {} pid: {:?}",
                socket_name,
                pid
            );
            Some(WebViewSocket {
                socket_name,
                pid,
                package_name: None,
            })
        })
        .collect();

    log::info!("[adb_list_webview_sockets] Found {} sockets", sockets.len());

    // Remove duplicates by socket_name only (same socket can appear multiple times in /proc/net/unix)
    let mut seen = std::collections::HashSet::new();
    sockets.retain(|s| seen.insert(s.socket_name.clone()));

    // Enrich with package names from /proc/{pid}/cmdline
    for s in &mut sockets {
        if let Some(pid) = s.pid {
            let cmdline = shell_output(&mut device, &format!("cat /proc/{pid}/cmdline"));
            // cmdline is null-byte delimited; first segment is the process name / package
            let pkg = cmdline
                .split(|c: char| c == '\0' || c == ' ')
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !pkg.is_empty() {
                s.package_name = Some(pkg);
            }
        }
    }

    Ok(sockets)
}
