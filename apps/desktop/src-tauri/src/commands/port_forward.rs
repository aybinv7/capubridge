use crate::commands::{
    adb::{get_server, map_adb_server_err},
    chrome::CDPJsonTarget,
};

fn allocate_local_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to allocate local port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to inspect local port: {e}"))?
        .port();
    drop(listener);
    Ok(port)
}

/// Forward a dynamically allocated local TCP port to a CDP abstract socket on the device.
/// Returns the allocated port so the frontend can use it for fetching /json.
#[tauri::command]
pub async fn adb_forward_cdp(
    _app: tauri::AppHandle,
    serial: String,
    socket_name: Option<String>,
) -> Result<u16, String> {
    let socket = socket_name.unwrap_or_else(|| "chrome_devtools_remote".to_string());
    let remote = format!("localabstract:{socket}");

    let mut server = get_server().lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    for attempt in 0..8 {
        let local_port = allocate_local_port()?;
        let local = format!("tcp:{local_port}");
        log::info!(
            "[adb_forward_cdp] attempt={}, serial={}, port={}, socket={}",
            attempt, serial, local_port, socket
        );
        match device.forward(remote.clone(), local) {
            Ok(()) => {
                log::info!("[adb_forward_cdp] SUCCESS serial={} socket={} → port {}", serial, socket, local_port);
                return Ok(local_port);
            }
            Err(e) => {
                log::warn!("[adb_forward_cdp] FAILED serial={} port={}: {}", serial, local_port, e);
            }
        }
    }

    Err(format!("Failed to allocate a local port for ADB forward after 8 attempts (serial={}, socket={})", serial, socket))
}

/// Remove all previously established port forwards for a device.
/// Silently succeeds if the device is no longer reachable (already disconnected).
#[tauri::command]
pub async fn adb_remove_forward(
    _app: tauri::AppHandle,
    serial: String,
) -> Result<(), String> {
    log::info!("[adb_remove_forward] serial={}", serial);

    let mut server = get_server().lock();
    let device = server.get_device_by_name(&serial);
    match device {
        Ok(mut d) => {
            if let Err(e) = d.forward_remove_all() {
                log::warn!("[adb_remove_forward] forward_remove_all failed for {}: {e}", serial);
            }
        }
        Err(e) => {
            log::info!(
                "[adb_remove_forward] Device {} not found (likely offline), skipping: {}",
                serial,
                map_adb_server_err(e)
            );
        }
    }

    Ok(())
}

/// Fetch CDP targets from a forwarded port via Rust (avoids CORS in browser).
#[tauri::command]
pub async fn adb_fetch_json_targets(port: u16) -> Result<Vec<CDPJsonTarget>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("http://127.0.0.1:{}/json", port);

    // Sometimes ADB takes a fraction of a second to fully instantiate the TCP tunnel.
    // Try up to 3 times to fetch the JSON.
    let mut last_error = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }

        let res = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                last_error = e.to_string();
                continue;
            }
        };

        if !res.status().is_success() {
            last_error = format!("Responded with {}", res.status());
            continue;
        }

        let targets: Vec<CDPJsonTarget> = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse /json from port {}: {}", port, e))?;

        log::info!("[adb_fetch_json_targets] port={} targets={}", port, targets.len());
        return Ok(targets);
    }

    Err(format!("Failed to fetch /json from port {} after 3 attempts. Last error: {}", port, last_error))
}
