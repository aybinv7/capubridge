use adb_client::server::ADBServer;
use std::env;
use std::net::{Ipv4Addr, SocketAddrV4};
#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub(crate) const ADB_HOST: SocketAddrV4 = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 5037);
const DISABLE_AUTOSTART_SENTINEL: &str = "__capubridge_disable_adb_autostart__";
const ADB_OVERRIDE_ENV: &str = "CAPUBRIDGE_ADB_PATH";

#[derive(Clone)]
pub(crate) struct AdbBinary {
    pub path: PathBuf,
    pub source: &'static str,
}

static ADB_BINARY: OnceLock<AdbBinary> = OnceLock::new();

pub(crate) fn create_adb_server() -> ADBServer {
    ADBServer::new_from_path(ADB_HOST, Some(DISABLE_AUTOSTART_SENTINEL.to_string()))
}

pub(crate) fn ensure_adb_runtime(app: &AppHandle) -> Result<String, String> {
    if probe_adb_server() {
        if let Err(error) = configure_adb_binary(app) {
            log::warn!("[adb_runtime] binary resolution failed: {error}");
        }
        return Ok("already_running".to_string());
    }

    let binary = configure_adb_binary(app)?
        .ok_or_else(|| missing_adb_binary_message().to_string())?;
    start_adb_server_process(&binary.path)?;

    for _ in 0..25 {
        std::thread::sleep(Duration::from_millis(200));
        if probe_adb_server() {
            return Ok("started".to_string());
        }
    }

    Err("ADB server did not respond after 5 seconds".to_string())
}

pub(crate) fn restart_adb_runtime(app: &AppHandle) -> Result<String, String> {
    let binary = configure_adb_binary(app)?
        .ok_or_else(|| missing_adb_binary_message().to_string())?;
    let mut server = create_adb_server();
    let _ = server.kill();
    start_adb_server_process(&binary.path)?;

    for _ in 0..25 {
        std::thread::sleep(Duration::from_millis(200));
        if probe_adb_server() {
            return Ok("restarted".to_string());
        }
    }

    Err("ADB server did not respond after restart".to_string())
}

pub(crate) fn missing_adb_binary_message() -> &'static str {
    "ADB server is not running and no bundled or system adb binary was found. Bundle platform-tools in src-tauri/resources/adb or install adb in PATH."
}

pub(crate) fn adb_server_unavailable_message() -> &'static str {
    "ADB server is not running. Capubridge will use CAPUBRIDGE_ADB_PATH, bundled platform-tools, or PATH adb when available."
}

fn configure_adb_binary(app: &AppHandle) -> Result<Option<AdbBinary>, String> {
    if let Some(existing) = ADB_BINARY.get() {
        return Ok(Some(existing.clone()));
    }

    let Some(binary) = resolve_adb_binary(app)? else {
        return Ok(None);
    };
    prepare_adb_binary(&binary.path)?;

    match ADB_BINARY.set(binary.clone()) {
        Ok(()) => {
            log::info!(
                "[adb_runtime] using {} adb binary at {}",
                binary.source,
                binary.path.display()
            );
            Ok(Some(binary))
        }
        Err(_) => Ok(ADB_BINARY.get().cloned()),
    }
}

fn resolve_adb_binary(app: &AppHandle) -> Result<Option<AdbBinary>, String> {
    if let Ok(override_path) = env::var(ADB_OVERRIDE_ENV) {
        let trimmed = override_path.trim();
        if trimmed.is_empty() {
            return Err(format!("{ADB_OVERRIDE_ENV} is set but empty"));
        }

        let path = PathBuf::from(trimmed);
        if !path.is_file() {
            return Err(format!(
                "{ADB_OVERRIDE_ENV} points to missing adb binary: {}",
                path.display()
            ));
        }

        return Ok(Some(AdbBinary {
            path,
            source: "override",
        }));
    }

    if let Some(path) = find_bundled_adb_binary(app) {
        return Ok(Some(AdbBinary {
            path,
            source: "bundled",
        }));
    }

    if let Ok(path) = which::which("adb") {
        return Ok(Some(AdbBinary {
            path,
            source: "system",
        }));
    }

    Ok(None)
}

fn find_bundled_adb_binary(app: &AppHandle) -> Option<PathBuf> {
    bundled_roots(app)
        .into_iter()
        .flat_map(candidate_binary_paths)
        .find(|path| path.is_file())
}

fn bundled_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir.clone());
        roots.push(resource_dir.join("resources"));
    }

    let manifest_resources = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
    roots.push(manifest_resources);

    let mut unique = Vec::new();
    for root in roots {
        if !unique.iter().any(|existing: &PathBuf| existing == &root) {
            unique.push(root);
        }
    }
    unique
}

fn candidate_binary_paths(root: PathBuf) -> Vec<PathBuf> {
    let file_name = adb_binary_name();
    let mut paths = vec![
        root.join("adb").join(file_name),
        root.join("platform-tools").join(file_name),
        root.join("adb").join("platform-tools").join(file_name),
    ];

    for platform in platform_dir_names() {
        paths.push(root.join("adb").join(&platform).join(file_name));
        paths.push(
            root.join("adb")
                .join(&platform)
                .join("platform-tools")
                .join(file_name),
        );
        paths.push(root.join("platform-tools").join(&platform).join(file_name));
        paths.push(
            root.join("platform-tools")
                .join(&platform)
                .join("platform-tools")
                .join(file_name),
        );
    }

    paths
}

fn platform_dir_names() -> Vec<String> {
    let os = match env::consts::OS {
        "windows" => vec!["windows", "win32", "win"],
        "macos" => vec!["darwin", "macos", "mac"],
        "linux" => vec!["linux"],
        other => vec![other],
    };
    let arch = match env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "x86" => "x86",
        other => other,
    };

    let mut names = Vec::new();
    for base in os {
        names.push(base.to_string());
        names.push(format!("{base}-{arch}"));
        names.push(format!("{base}_{arch}"));
    }
    names
}

fn adb_binary_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "adb.exe"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "adb"
    }
}

fn prepare_adb_binary(_path: &Path) -> Result<(), String> {
    #[cfg(target_family = "unix")]
    {
        let metadata =
            std::fs::metadata(_path).map_err(|e| format!("Failed to stat adb binary: {e}"))?;
        let mut permissions = metadata.permissions();
        let mode = permissions.mode();
        if (mode & 0o111) == 0 {
            permissions.set_mode(mode | 0o755);
            std::fs::set_permissions(_path, permissions)
                .map_err(|e| format!("Failed to mark adb binary executable: {e}"))?;
        }
    }

    Ok(())
}

fn start_adb_server_process(path: &Path) -> Result<(), String> {
    let mut command = Command::new(path);
    command.arg("start-server");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let output = command
        .output()
        .map_err(|e| format!("Failed to launch adb: {e}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let detail = if stderr.trim().is_empty() {
        stdout.trim()
    } else {
        stderr.trim()
    };

    Err(format!("adb start-server failed: {detail}"))
}

fn probe_adb_server() -> bool {
    let mut server = create_adb_server();
    server.devices_long().is_ok()
}
