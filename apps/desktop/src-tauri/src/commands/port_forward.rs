use tauri_plugin_shell::ShellExt;
use crate::commands::chrome::CDPJsonTarget;

/// Forward a local TCP port to a CDP abstract socket on the device.
/// Uses `adb forward` via shell to avoid adb_client protocol issues.
/// If the port is already in use, removes the existing forward first.
#[tauri::command]
pub async fn adb_forward_cdp(
    app: tauri::AppHandle,
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

    // Try the forward first
    let output = app
        .shell()
        .command("adb")
        .args(&[
            "-s",
            &serial,
            "forward",
            &format!("tcp:{}", local_port),
            &format!("localabstract:{}", socket),
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn adb: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // If port already in use, remove the forward and retry
        if stderr.contains("cannot bind") || stderr.contains("already") {
            log::info!("[adb_forward_cdp] Port {} in use, removing existing forward", local_port);
            let _ = app
                .shell()
                .command("adb")
                .args(&[
                    "-s",
                    &serial,
                    "forward",
                    &format!("--remove=tcp:{}", local_port),
                ])
                .output()
                .await;

            // Retry
            let output2 = app
                .shell()
                .command("adb")
                .args(&[
                    "-s",
                    &serial,
                    "forward",
                    &format!("tcp:{}", local_port),
                    &format!("localabstract:{}", socket),
                ])
                .output()
                .await
                .map_err(|e| format!("Failed to spawn adb: {}", e))?;

            if !output2.status.success() {
                let stderr2 = String::from_utf8_lossy(&output2.stderr);
                return Err(format!("adb forward error: {}", stderr2.trim()));
            }
        } else {
            return Err(format!("adb forward error: {}", stderr.trim()));
        }
    }

    log::info!("[adb_forward_cdp] Success");
    Ok(())
}

/// Remove a previously established port forward.
#[tauri::command]
pub async fn adb_remove_forward(
    app: tauri::AppHandle,
    serial: String,
    local_port: u16,
) -> Result<(), String> {
    log::info!(
        "[adb_remove_forward] serial={}, local_port={}",
        serial,
        local_port
    );

    let output = app
        .shell()
        .command("adb")
        .args(&[
            "-s",
            &serial,
            "forward",
            &format!("--remove=tcp:{}", local_port),
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn adb: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("adb forward --remove error: {}", stderr.trim()));
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
