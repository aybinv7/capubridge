use crate::commands::{
    adb::{get_server, map_adb_server_err},
    chrome::CDPJsonTarget,
};

/// Forward a local TCP port to a CDP abstract socket on the device.
/// Uses adb server protocol via adb_client (no direct adb.exe spawn).
/// If the port is already in use, clears existing forwards for the device and retries.
#[tauri::command]
pub async fn adb_forward_cdp(
    _app: tauri::AppHandle,
    serial: String,
    local_port: u16,
    socket_name: Option<String>,
) -> Result<(), String> {
    let socket = socket_name.unwrap_or_else(|| "chrome_devtools_remote".to_string());
    log::info!(
        "[adb_forward_cdp] serial={}, local_port={}, socket={}",
        serial,
        local_port,
        socket
    );

    let mut server = get_server().lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;
    let local = format!("tcp:{local_port}");
    let remote = format!("localabstract:{socket}");

    if let Err(err) = device.forward(remote.clone(), local.clone()) {
        let err_text = err.to_string();
        // Existing forward rules can conflict with the requested local port.
        // adb_client exposes `forward_remove_all` but not single-port removal.
        if err_text.contains("cannot bind") || err_text.contains("already") {
            log::info!(
                "[adb_forward_cdp] Port {} in use, clearing existing forwards for serial {}",
                local_port,
                serial
            );
            device
                .forward_remove_all()
                .map_err(|e| format!("adb forward cleanup error: {e}"))?;
            device
                .forward(remote, local)
                .map_err(|e| format!("adb forward error: {e}"))?;
        } else {
            return Err(format!("adb forward error: {}", err_text.trim()));
        }
    }

    log::info!("[adb_forward_cdp] Success");
    Ok(())
}

/// Remove a previously established port forward.
#[tauri::command]
pub async fn adb_remove_forward(
    _app: tauri::AppHandle,
    serial: String,
    local_port: u16,
) -> Result<(), String> {
    log::info!(
        "[adb_remove_forward] serial={}, local_port={} (clear all forwards for this serial)",
        serial, local_port
    );

    let mut server = get_server().lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;
    device
        .forward_remove_all()
        .map_err(|e| format!("adb forward --remove error: {e}"))?;

    Ok(())
}

/// Fetch CDP targets from a forwarded port via Rust (avoids CORS in browser).
#[tauri::command]
pub async fn adb_fetch_json_targets(port: u16) -> Result<Vec<CDPJsonTarget>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let res = client
        .get(&format!("http://localhost:{}/json", port))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch /json from port {}: {}", port, e))?;

    if !res.status().is_success() {
        return Err(format!("Port {} responded with {}", port, res.status()));
    }

    let targets: Vec<CDPJsonTarget> = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse /json from port {}: {}", port, e))?;

    log::info!("[adb_fetch_json_targets] port={} targets={}", port, targets.len());
    Ok(targets)
}
