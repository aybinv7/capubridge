use tokio::runtime::Builder;

use crate::commands::{
    adb::{adb_list_webview_sockets_inner, catch_adb_panic, get_adb_device},
    chrome::CDPJsonTarget,
};

#[derive(Debug, Clone)]
pub struct AdbDiscoveredTarget {
    pub id: String,
    pub target_type: String,
    pub title: String,
    pub url: String,
    pub devtools_frontend_url: Option<String>,
    pub web_socket_debugger_url: String,
    pub favicon_url: Option<String>,
    pub package_name: Option<String>,
}

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

pub(crate) fn adb_forward_cdp_inner(
    serial: &str,
    socket_name: Option<&str>,
) -> Result<u16, String> {
    let socket = socket_name.unwrap_or("chrome_devtools_remote");
    let remote = format!("localabstract:{socket}");

    let mut device = get_adb_device(serial)?;

    for attempt in 0..8 {
        let local_port = allocate_local_port()?;
        let local = format!("tcp:{local_port}");
        log::info!(
            "[adb_forward_cdp] attempt={}, serial={}, port={}, socket={}",
            attempt,
            serial,
            local_port,
            socket
        );
        match device.forward(remote.clone(), local) {
            Ok(()) => {
                log::info!(
                    "[adb_forward_cdp] SUCCESS serial={} socket={} -> port {}",
                    serial,
                    socket,
                    local_port
                );
                return Ok(local_port);
            }
            Err(e) => {
                log::warn!(
                    "[adb_forward_cdp] FAILED serial={} port={}: {}",
                    serial,
                    local_port,
                    e
                );
            }
        }
    }

    Err(format!(
        "Failed to allocate a local port for ADB forward after 8 attempts (serial={}, socket={})",
        serial, socket
    ))
}

#[tauri::command]
pub async fn adb_forward_cdp(
    _app: tauri::AppHandle,
    serial: String,
    socket_name: Option<String>,
) -> Result<u16, String> {
    catch_adb_panic("adb_forward_cdp", move || {
        adb_forward_cdp_inner(&serial, socket_name.as_deref())
    })
}

#[tauri::command]
pub async fn adb_remove_forward(_app: tauri::AppHandle, serial: String) -> Result<(), String> {
    catch_adb_panic("adb_remove_forward", move || {
        log::info!("[adb_remove_forward] serial={}", serial);

        let device = get_adb_device(&serial);
        match device {
            Ok(mut d) => {
                if let Err(e) = d.forward_remove_all() {
                    log::warn!(
                        "[adb_remove_forward] forward_remove_all failed for {}: {e}",
                        serial
                    );
                }
            }
            Err(error) => {
                log::info!(
                    "[adb_remove_forward] Device {} not found (likely offline), skipping: {}",
                    serial,
                    error
                );
            }
        }

        Ok(())
    })
}

async fn adb_fetch_json_targets_inner(port: u16) -> Result<Vec<CDPJsonTarget>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let url = format!("http://127.0.0.1:{}/json", port);
    let mut last_error = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }

        let response = match client.get(&url).send().await {
            Ok(response) => response,
            Err(error) => {
                last_error = error.to_string();
                continue;
            }
        };

        if !response.status().is_success() {
            last_error = format!("Responded with {}", response.status());
            continue;
        }

        let targets: Vec<CDPJsonTarget> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse /json from port {}: {}", port, e))?;

        log::info!(
            "[adb_fetch_json_targets] port={} targets={}",
            port,
            targets.len()
        );
        return Ok(targets);
    }

    Err(format!(
        "Failed to fetch /json from port {} after 3 attempts. Last error: {}",
        port, last_error
    ))
}

fn adb_fetch_json_targets_blocking(port: u16) -> Result<Vec<CDPJsonTarget>, String> {
    let runtime = Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| format!("Failed to create target fetch runtime: {e}"))?;
    runtime.block_on(adb_fetch_json_targets_inner(port))
}

fn map_discovered_target(
    socket_name: &str,
    package_name: Option<String>,
    target: CDPJsonTarget,
) -> AdbDiscoveredTarget {
    let CDPJsonTarget {
        id,
        target_type,
        title,
        url,
        devtools_frontend_url,
        web_socket_debugger_url,
        favicon_url,
    } = target;

    AdbDiscoveredTarget {
        id,
        target_type,
        title,
        url,
        devtools_frontend_url,
        web_socket_debugger_url,
        favicon_url,
        package_name: package_name.or_else(|| {
            if socket_name == "chrome_devtools_remote" {
                None
            } else {
                Some("unknown".to_string())
            }
        }),
    }
}

pub(crate) fn adb_discover_targets_inner(serial: &str) -> Result<Vec<AdbDiscoveredTarget>, String> {
    let sockets = adb_list_webview_sockets_inner(serial).unwrap_or_default();
    let mut socket_names = vec!["chrome_devtools_remote".to_string()];

    for socket in &sockets {
        if socket.socket_name.starts_with("stetho_") {
            continue;
        }
        if !socket_names.contains(&socket.socket_name) {
            socket_names.push(socket.socket_name.clone());
        }
    }

    let mut targets = Vec::new();

    for socket_name in socket_names {
        let package_name = sockets
            .iter()
            .find(|socket| socket.socket_name == socket_name)
            .and_then(|socket| socket.package_name.clone());

        let port = match adb_forward_cdp_inner(serial, Some(&socket_name)) {
            Ok(port) => port,
            Err(error) => {
                log::warn!(
                    "[adb_discover_targets] forward failed serial={} socket={}: {}",
                    serial,
                    socket_name,
                    error
                );
                continue;
            }
        };

        match adb_fetch_json_targets_blocking(port) {
            Ok(socket_targets) => {
                targets.extend(socket_targets.into_iter().map(|target| {
                    map_discovered_target(&socket_name, package_name.clone(), target)
                }));
            }
            Err(_) => {
                targets.push(AdbDiscoveredTarget {
                    id: format!("adb:{serial}:{socket_name}"),
                    target_type: "page".to_string(),
                    title: package_name
                        .clone()
                        .map(|pkg| format!("{socket_name} ({pkg})"))
                        .unwrap_or_else(|| socket_name.clone()),
                    url: String::new(),
                    devtools_frontend_url: None,
                    web_socket_debugger_url: format!("ws://127.0.0.1:{port}/"),
                    favicon_url: None,
                    package_name,
                });
            }
        }
    }

    Ok(targets)
}

#[tauri::command]
pub async fn adb_fetch_json_targets(port: u16) -> Result<Vec<CDPJsonTarget>, String> {
    adb_fetch_json_targets_inner(port).await
}
