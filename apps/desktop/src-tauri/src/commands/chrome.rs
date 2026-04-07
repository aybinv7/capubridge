use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromeLaunchResult {
    pub pid: u32,
    pub port: u16,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromeFindResult {
    pub found: bool,
    pub path: Option<String>,
}

fn find_chrome_path() -> Option<String> {
    let candidates = [
        // User-level install (most common on Windows — no admin rights required)
        // r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
        // r"%LOCALAPPDATA%\Google\Chrome Dev\Application\chrome.exe",
        // r"%LOCALAPPDATA%\Google\Chrome Beta\Application\chrome.exe",
        // System-level installs
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Google\Chrome Dev\Application\chrome.exe",
        r"C:\Program Files\Google\Chrome Beta\Application\chrome.exe",
        r"C:\Program Files\Google\Chrome SxS\Application\chrome.exe",
        // macOS
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        // Linux
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
    ];

    for path in &candidates {
        let expanded = shellexpand::full(path);
        if let Ok(expanded) = expanded {
            if std::path::Path::new(expanded.as_ref()).exists() {
                return Some(expanded.into_owned());
            }
        }
    }

    // Fallback: try PATH
    if which::which("chrome").is_ok() || which::which("google-chrome").is_ok() {
        return Some("chrome".to_string());
    }

    None
}

fn is_port_listening(port: u16) -> bool {
    std::net::TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn is_chrome_already_running() -> bool {
    let process_name = if cfg!(windows) { "chrome.exe" } else { "chrome" };
    sysinfo::System::new_all()
        .processes()
        .values()
        .any(|p| p.name().to_string_lossy().to_lowercase().contains(process_name))
}

#[tauri::command]
pub async fn chrome_is_running() -> Result<bool, String> {
    Ok(is_chrome_already_running())
}

#[tauri::command]
pub async fn chrome_kill_all() -> Result<(), String> {
    let process_name = if cfg!(windows) { "chrome.exe" } else { "chrome" };
    let sys = sysinfo::System::new_all();
    for (pid, process) in sys.processes() {
        if process.name().to_string_lossy().to_lowercase().contains(process_name) {
            if !process.kill() {
                return Err(format!("Failed to kill Chrome process {}", pid));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn chrome_find() -> Result<ChromeFindResult, String> {
    let path = find_chrome_path();

    Ok(ChromeFindResult {
        found: path.is_some(),
        path,
    })
}

#[tauri::command]
pub async fn chrome_launch(_app: tauri::AppHandle, port: u16) -> Result<ChromeLaunchResult, String> {
    let chrome_path = find_chrome_path()
        .ok_or("Chrome not found. Please install Google Chrome or specify a custom path in settings.")?;

    if is_port_listening(port) {
        return Err(format!(
            "Port {} is already in use. Close Chrome or use manual connect mode.",
            port
        ));
    }

    let port_str = port.to_string();

    let args = vec![
        format!("--remote-debugging-port={}", port_str),
        "--remote-allow-origins=*".to_string(),
        "--no-first-run".to_string(),
        "--no-default-browser-check".to_string(),
        "about:blank".to_string(),
    ];

    let mut child = Command::new(&chrome_path)
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch Chrome: {e}"))?;

    let pid = child.id();

    // Detach the child process so it doesn't get killed when Capubridge exits
    // On Windows, this is automatic. On Unix, we'd need double-fork.
    #[cfg(windows)]
    {
        // Windows: process continues after parent exits by default
    }

    for i in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        if is_port_listening(port) {
            return Ok(ChromeLaunchResult { pid, port });
        }
        // Check if process is still alive
        if child.try_wait().map_or(false, |s| s.is_some()) {
            return Err("Chrome launched but exited immediately. Check if another Chrome instance is running.".to_string());
        }
        if i == 49 {
            return Err("Chrome launched but CDP port is not responding. The process may have exited.".to_string());
        }
    }

    Err("Timed out waiting for Chrome CDP port".to_string())
}

#[tauri::command]
pub async fn chrome_verify_port(port: u16) -> Result<bool, String> {
    if is_port_listening(port) {
        Ok(true)
    } else {
        Err(format!("Nothing is listening on port {}", port))
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CDPJsonTarget {
    pub id: String,
    #[serde(rename = "type")]
    pub target_type: String,
    pub title: String,
    pub url: String,
    #[serde(rename = "webSocketDebuggerUrl")]
    pub web_socket_debugger_url: String,
    #[serde(rename = "faviconUrl")]
    pub favicon_url: Option<String>,
}

#[tauri::command]
pub async fn chrome_fetch_targets(port: u16) -> Result<Vec<CDPJsonTarget>, String> {
    if !is_port_listening(port) {
        return Err(format!("Nothing is listening on port {}", port));
    }

    let client = reqwest::Client::new();
    let res = client
        .get(&format!("http://localhost:{}/json", port))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch targets: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Chrome responded with {}", res.status()));
    }

    let targets: Vec<CDPJsonTarget> = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse targets: {e}"))?;

    Ok(targets)
}
