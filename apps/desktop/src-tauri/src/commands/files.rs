use crate::commands::adb::{get_server, map_adb_server_err};
use adb_client::ADBDeviceExt;
use base64::{engine::general_purpose, Engine};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub size: u64,
    pub modified: String,    // "YYYY-MM-DD HH:MM" or "Mon DD HH:MM"
    pub entry_type: String,  // "file" | "dir" | "symlink" | "other"
    pub permissions: String, // 9-char string like "rwxr-xr-x"
}

/// Strip ANSI escape sequences (color codes) from ls output on Android.
fn strip_ansi(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' && chars.peek() == Some(&'[') {
            chars.next(); // consume '['
            for nc in chars.by_ref() {
                if nc.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Parse one line from `ls -la` output into a FileEntry.
/// Handles both toybox (YYYY-MM-DD HH:MM) and busybox (Mon DD HH:MM) date formats.
fn parse_ls_line(line: &str) -> Option<FileEntry> {
    let clean = strip_ansi(line);
    let clean = clean.trim();

    let first_char = clean.chars().next()?;
    if !matches!(first_char, 'd' | '-' | 'l' | 'c' | 'b' | 's' | 'p') {
        return None;
    }

    let parts: Vec<&str> = clean.split_whitespace().collect();
    // Minimum: perm links owner group size date time name => 8 (toybox)
    //          perm links owner group size month day time name => 9 (busybox)
    if parts.len() < 8 {
        return None;
    }

    let perm_str = parts[0];
    if perm_str.len() < 10 {
        return None;
    }

    let entry_type_str = match first_char {
        'd' => "dir",
        'l' => "symlink",
        '-' => "file",
        _ => "other",
    };

    let size: u64 = parts[4].parse().unwrap_or(0);

    // Toybox date: YYYY-MM-DD (length 10, hyphen at index 4)
    let (modified, name_start) =
        if parts[5].len() == 10 && parts[5].as_bytes().get(4) == Some(&b'-') {
            if parts.len() < 8 {
                return None;
            }
            (format!("{} {}", parts[5], parts[6]), 7usize)
        } else {
            // Busybox: Mon DD HH:MM name
            if parts.len() < 9 {
                return None;
            }
            (format!("{} {} {}", parts[5], parts[6], parts[7]), 8usize)
        };

    if name_start >= parts.len() {
        return None;
    }

    let name_raw = parts[name_start..].join(" ");
    // For symlinks, strip the " -> target" suffix
    let name = if entry_type_str == "symlink" {
        name_raw
            .split(" -> ")
            .next()
            .unwrap_or(&name_raw)
            .to_string()
    } else {
        name_raw
    };

    if name == "." || name == ".." {
        return None;
    }

    // permissions: chars 1..10 of perm_str (skip the type char)
    let permissions: String = perm_str.chars().skip(1).take(9).collect();

    Some(FileEntry {
        name,
        size,
        modified,
        entry_type: entry_type_str.to_string(),
        permissions,
    })
}

pub fn shell_escape(value: &str) -> String {
    value.replace('\'', "'\\''")
}

fn normalize_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return "/".to_string();
    }

    let mut normalized = if trimmed.starts_with('/') {
        trimmed.to_string()
    } else {
        format!("/{trimmed}")
    };
    if normalized.len() > 1 {
        normalized = normalized.trim_end_matches('/').to_string();
    }
    if normalized.is_empty() {
        "/".to_string()
    } else {
        normalized
    }
}

fn run_shell(
    device: &mut adb_client::server_device::ADBServerDevice,
    command: &str,
) -> Result<(String, String), String> {
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    device
        .shell_command(&command, Some(&mut stdout), Some(&mut stderr))
        .map_err(|e| format!("Shell command failed: {e}"))?;

    Ok((
        String::from_utf8_lossy(&stdout).to_string(),
        String::from_utf8_lossy(&stderr).to_string(),
    ))
}

fn shell_output(device: &mut adb_client::server_device::ADBServerDevice, command: &str) -> String {
    let mut stdout = Vec::new();
    let _ = device.shell_command(&command, Some(&mut stdout), None::<&mut dyn Write>);
    String::from_utf8_lossy(&stdout).to_string()
}

fn get_current_user(device: &mut adb_client::server_device::ADBServerDevice) -> u32 {
    shell_output(device, "am get-current-user")
        .trim()
        .parse::<u32>()
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

fn virtual_entry(name: String, entry_type: &str) -> FileEntry {
    let permissions = if entry_type == "dir" {
        "rwxr-xr-x"
    } else {
        "rw-r--r--"
    };
    FileEntry {
        name,
        size: 0,
        modified: "—".to_string(),
        entry_type: entry_type.to_string(),
        permissions: permissions.to_string(),
    }
}

fn parse_ls_entries(stdout: &str) -> Vec<FileEntry> {
    stdout.lines().filter_map(parse_ls_line).collect()
}

fn read_file_bytes(
    device: &mut adb_client::server_device::ADBServerDevice,
    path: &str,
) -> Result<Vec<u8>, String> {
    let escaped = shell_escape(path);
    let marker = "__CAPUBRIDGE_FILE_BASE64__";
    let command = format!(
        "if [ -f '{}' ]; then printf '{}\\n'; cat '{}' 2>/dev/null | base64; fi",
        escaped, marker, escaped
    );
    let mut out = Vec::new();
    let _ = device.shell_command(&command, Some(&mut out), None::<&mut dyn Write>);

    let raw = String::from_utf8_lossy(&out);
    let Some((_, encoded)) = raw.split_once(marker) else {
        return Err("File not found or is a directory".to_string());
    };

    let b64: String = encoded
        .as_bytes()
        .iter()
        .filter(|&&b| !matches!(b, b'\n' | b'\r' | b' '))
        .map(|&b| b as char)
        .collect();

    general_purpose::STANDARD
        .decode(&b64)
        .map_err(|e| format!("Decode failed: {e}"))
}

fn open_with_default_app(local_path: &Path) -> Result<(), String> {
    let path_str = local_path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open file: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open file: {e}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open file: {e}"))?;
        return Ok(());
    }
}

fn open_with_app_picker(local_path: &Path) -> Result<(), String> {
    let path_str = local_path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .arg("shell32.dll,OpenAs_RunDLL")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open app picker: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path_str])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {e}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open file: {e}"))?;
        return Ok(());
    }
}

fn write_device_file_to_temp(
    device: &mut adb_client::server_device::ADBServerDevice,
    path: &str,
) -> Result<std::path::PathBuf, String> {
    let bytes = read_file_bytes(device, path)?;
    let filename = std::path::Path::new(path)
        .file_name()
        .unwrap_or(std::ffi::OsStr::new("capubridge_file"))
        .to_string_lossy()
        .to_string();

    let open_dir = std::env::temp_dir().join("capubridge-open");
    std::fs::create_dir_all(&open_dir).map_err(|e| format!("Failed to create temp dir: {e}"))?;
    let target_path = open_dir.join(filename);
    std::fs::write(&target_path, bytes).map_err(|e| format!("Failed to write temp file: {e}"))?;
    Ok(target_path)
}

fn virtual_data_root_entries() -> Vec<FileEntry> {
    vec![
        virtual_entry("data".to_string(), "dir"),
        virtual_entry("app".to_string(), "dir"),
        virtual_entry("local".to_string(), "dir"),
    ]
}

fn virtual_data_local_entries() -> Vec<FileEntry> {
    vec![virtual_entry("tmp".to_string(), "dir")]
}

fn virtual_storage_self_entries() -> Vec<FileEntry> {
    vec![virtual_entry("primary".to_string(), "dir")]
}

fn virtual_storage_emulated_entries(
    device: &mut adb_client::server_device::ADBServerDevice,
) -> Vec<FileEntry> {
    let current_user = get_current_user(device).to_string();
    let mut names = vec!["0".to_string()];
    if current_user != "0" {
        names.push(current_user);
    }
    names.sort();
    names.dedup();

    names
        .into_iter()
        .map(|name| virtual_entry(name, "dir"))
        .collect()
}

fn virtual_data_data_entries(
    device: &mut adb_client::server_device::ADBServerDevice,
) -> Vec<FileEntry> {
    let user = get_current_user(device);
    let output = shell_output(device, &format!("pm list packages --user {user}"));
    let mut package_names: Vec<String> = output
        .lines()
        .filter_map(|line| parse_package_list_entry(line).map(|(_, pkg)| pkg))
        .collect();
    package_names.sort();
    package_names.dedup();

    package_names
        .into_iter()
        .map(|package_name| virtual_entry(package_name, "dir"))
        .collect()
}

fn virtual_data_app_entries(
    device: &mut adb_client::server_device::ADBServerDevice,
) -> Vec<FileEntry> {
    let user = get_current_user(device);
    let output = shell_output(device, &format!("pm list packages -f --user {user}"));
    let mut dir_names = HashSet::new();
    let mut file_names = HashSet::new();

    for line in output.lines() {
        let Some((apk_path, _package_name)) = parse_package_list_entry(line) else {
            continue;
        };
        let Some(apk_path) = apk_path else {
            continue;
        };
        let Some(remainder) = apk_path.strip_prefix("/data/app/") else {
            continue;
        };
        let first_segment = remainder.split('/').next().unwrap_or("").trim();
        if first_segment.is_empty() {
            continue;
        }

        if remainder.contains('/') {
            dir_names.insert(first_segment.to_string());
        } else if first_segment.ends_with(".apk") {
            file_names.insert(first_segment.to_string());
        }
    }

    let mut entries: Vec<FileEntry> = dir_names
        .into_iter()
        .map(|name| virtual_entry(name, "dir"))
        .collect();
    let mut files: Vec<FileEntry> = file_names
        .into_iter()
        .map(|name| virtual_entry(name, "file"))
        .collect();

    entries.sort_by(|a, b| a.name.cmp(&b.name));
    files.sort_by(|a, b| a.name.cmp(&b.name));
    entries.extend(files);
    entries
}

fn package_name_from_private_data_path(path: &str) -> Option<String> {
    if let Some(remainder) = path.strip_prefix("/data/data/") {
        let package_name = remainder.split('/').next().unwrap_or("").trim();
        if !package_name.is_empty() {
            return Some(package_name.to_string());
        }
    }

    for prefix in ["/data/user/", "/data/user_de/"] {
        let Some(remainder) = path.strip_prefix(prefix) else {
            continue;
        };
        let mut parts = remainder.split('/');
        let user_id = parts.next().unwrap_or("").trim();
        if user_id.is_empty() || !user_id.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let package_name = parts.next().unwrap_or("").trim();
        if !package_name.is_empty() {
            return Some(package_name.to_string());
        }
    }

    None
}

fn run_as_private_data_entries(
    device: &mut adb_client::server_device::ADBServerDevice,
    path: &str,
) -> Result<Vec<FileEntry>, String> {
    let Some(package_name) = package_name_from_private_data_path(path) else {
        return Ok(Vec::new());
    };

    let command = format!(
        "run-as '{}' ls -la '{}'",
        shell_escape(&package_name),
        shell_escape(path)
    );
    let (stdout, stderr) = run_shell(device, &command)?;
    let entries = parse_ls_entries(&stdout);
    if !entries.is_empty() {
        return Ok(entries);
    }

    let combined = format!("{}\n{}", strip_ansi(&stdout), strip_ansi(&stderr)).to_lowercase();
    if combined.contains("not debuggable")
        || combined.contains("package not debuggable")
        || combined.contains("permission denied")
    {
        return Ok(Vec::new());
    }

    Ok(Vec::new())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFileContent {
    pub base64: String,
    pub size: usize,
}

fn build_delete_command(path: &str, is_dir: bool) -> String {
    let escaped = shell_escape(path);
    let remove_cmd = if is_dir {
        format!("rm -rf '{}'", escaped)
    } else {
        format!("rm -f '{}'", escaped)
    };

    if let Some(package_name) = package_name_from_private_data_path(path) {
        return format!("run-as '{}' {} 2>&1", shell_escape(&package_name), remove_cmd);
    }

    format!("{remove_cmd} 2>&1")
}

fn delete_permission_error(path: &str, output: &str) -> String {
    let normalized_path = normalize_path(path);
    let lower = output.to_lowercase();

    if normalized_path.starts_with("/data/data/")
        || normalized_path.starts_with("/data/user/")
        || normalized_path.starts_with("/data/user_de/")
    {
        if lower.contains("not debuggable") || lower.contains("run-as") {
            return "Permission denied: app private data can only be deleted with run-as for debuggable apps.".to_string();
        }
    }

    if normalized_path.starts_with("/sdcard/android/data")
        || normalized_path.starts_with("/storage/emulated/0/android/data")
    {
        return "Permission denied: Android scoped storage blocks adb shell deletion in Android/data on many devices.".to_string();
    }

    output.to_string()
}

/// List directory contents on the device via `ls -la`.
#[tauri::command]
pub fn adb_list_dir(serial: String, path: String) -> Result<Vec<FileEntry>, String> {
    let mut server = get_server().lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    let normalized_path = normalize_path(&path);
    let command = format!("ls -la '{}'", shell_escape(&normalized_path));
    let (stdout, stderr) = run_shell(&mut device, &command)?;
    let entries = parse_ls_entries(&stdout);
    if !entries.is_empty() {
        return Ok(entries);
    }

    if normalized_path == "/data" {
        return Ok(virtual_data_root_entries());
    }
    if normalized_path == "/data/local" {
        return Ok(virtual_data_local_entries());
    }
    if normalized_path == "/storage/self" {
        return Ok(virtual_storage_self_entries());
    }
    if normalized_path == "/storage/emulated" {
        return Ok(virtual_storage_emulated_entries(&mut device));
    }
    if normalized_path == "/data/data" {
        return Ok(virtual_data_data_entries(&mut device));
    }
    if normalized_path == "/data/app" {
        return Ok(virtual_data_app_entries(&mut device));
    }
    if normalized_path.starts_with("/data/data/")
        || normalized_path.starts_with("/data/user/")
        || normalized_path.starts_with("/data/user_de/")
    {
        return run_as_private_data_entries(&mut device, &normalized_path);
    }

    let combined = format!("{}\n{}", strip_ansi(&stdout), strip_ansi(&stderr));
    let lower = combined.to_lowercase();
    if lower.contains("permission denied")
        || lower.contains("operation not permitted")
        || lower.contains("no such file")
    {
        return Err(combined.trim().to_string());
    }

    Ok(Vec::new())
}

/// Pull a file from the device to the host's Downloads folder.
/// Returns the local path where the file was saved.
#[tauri::command]
pub async fn adb_pull_file(serial: String, path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

        let bytes = read_file_bytes(&mut device, &path)?;

        let filename = std::path::Path::new(&path)
            .file_name()
            .unwrap_or(std::ffi::OsStr::new("downloaded_file"))
            .to_string_lossy()
            .to_string();

        // Save to ~/Downloads/
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        let downloads = std::path::Path::new(&home).join("Downloads");
        std::fs::create_dir_all(&downloads)
            .map_err(|e| format!("Cannot create Downloads dir: {e}"))?;

        let local_path = downloads.join(&filename);
        std::fs::write(&local_path, bytes).map_err(|e| format!("Failed to write file: {e}"))?;

        Ok(local_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn adb_read_file(serial: String, path: String) -> Result<DeviceFileContent, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

        let bytes = read_file_bytes(&mut device, &path)?;
        let size = bytes.len();
        let base64 = general_purpose::STANDARD.encode(bytes);

        Ok(DeviceFileContent { base64, size })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Open a device file on the host machine using the default associated app.
#[tauri::command]
pub async fn adb_open_file(serial: String, path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

        let target_path = write_device_file_to_temp(&mut device, &path)?;
        open_with_default_app(&target_path)?;

        Ok(target_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn adb_open_file_picker(serial: String, path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut server = get_server().lock();
        let mut device = server
            .get_device_by_name(&serial)
            .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

        let target_path = write_device_file_to_temp(&mut device, &path)?;
        open_with_app_picker(&target_path)?;

        Ok(target_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Delete a file or directory on the device.
#[tauri::command]
pub fn adb_delete_file(serial: String, path: String, is_dir: bool) -> Result<(), String> {
    let mut server = get_server().lock();
    let mut device = server
        .get_device_by_name(&serial)
        .map_err(|e| format!("Device not found: {}", map_adb_server_err(e)))?;

    let normalized_path = normalize_path(&path);
    let cmd = build_delete_command(&normalized_path, is_dir);

    let mut output = Vec::new();
    device
        .shell_command(&cmd, Some(&mut output), None::<&mut dyn Write>)
        .map_err(|e| format!("Delete command failed: {e}"))?;

    let out = strip_ansi(&String::from_utf8_lossy(&output));
    let out = out.trim();
    let lower = out.to_lowercase();
    if lower.contains("permission denied")
        || lower.contains("operation not permitted")
        || lower.contains("not debuggable")
    {
        return Err(delete_permission_error(&normalized_path, out));
    }

    Ok(())
}

/// Show a file in the system file explorer
#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }

    Ok(())
}

/// Save a base64 encoded string to a file on the host machine.
#[tauri::command]
pub async fn save_base64_file(path: String, data: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let bytes = general_purpose::STANDARD
            .decode(&data)
            .map_err(|e| format!("Failed to decode base64: {e}"))?;
        std::fs::write(&path, bytes).map_err(|e| format!("Failed to write file: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}
