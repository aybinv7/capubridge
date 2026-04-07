use adb_client::{
    server::{ADBServer, DeviceLong, DeviceState},
    server_device::ADBServerDevice,
    ADBDeviceExt, RebootType,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::net::{Ipv4Addr, SocketAddrV4};
use std::sync::LazyLock;

static ADB_SERVER: LazyLock<Mutex<ADBServer>> = LazyLock::new(|| Mutex::new(ADBServer::default()));

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
    let devices = server.devices_long().map_err(|e| e.to_string())?;

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
        .map_err(|e| format!("Device not found: {e}"))?;

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
        .map_err(|e| format!("Device not found: {e}"))?;

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
    server.connect_device(addr).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn adb_disconnect_device(host: String, port: u16) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let addr = SocketAddrV4::new(host.parse::<Ipv4Addr>().map_err(|e| e.to_string())?, port);
    server.disconnect_device(addr).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn adb_pair_device(host: String, port: u16, code: String) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let addr = SocketAddrV4::new(host.parse::<Ipv4Addr>().map_err(|e| e.to_string())?, port);
    server.pair(addr, code).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn adb_tcpip(serial: String, port: u16) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {e}"))?;
    device.tcpip(port).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn adb_reboot(serial: String, mode: Option<String>) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {e}"))?;
    let reboot_type = match mode.as_deref() {
        Some("recovery") => RebootType::Recovery,
        Some("bootloader") => RebootType::Bootloader,
        _ => RebootType::System,
    };
    device.reboot(reboot_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn adb_root(serial: String) -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {e}"))?;
    device.root().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn adb_restart_server() -> Result<(), String> {
    let mut server = ADB_SERVER.lock();
    server.kill().map_err(|e| e.to_string())?;
    Ok(())
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
        .map_err(|e| format!("Device not found: {e}"))?;

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
