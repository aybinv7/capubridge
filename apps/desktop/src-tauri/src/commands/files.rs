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

fn shell_escape(value: &str) -> String {
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
    let command = format!("cat '{}' 2>/dev/null | base64", escaped);
    let mut out = Vec::new();
    let _ = device.shell_command(&command, Some(&mut out), None::<&mut dyn Write>);

    let b64: String = out
        .iter()
        .filter(|&&b| !matches!(b, b'\n' | b'\r' | b' '))
        .map(|&b| b as char)
        .collect();

    if b64.is_empty() {
        return Err("File not found or is a directory".to_string());
    }

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

fn virtual_data_data_entries(device: &mut adb_client::server_device::ADBServerDevice) -> Vec<FileEntry> {
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

fn virtual_data_app_entries(device: &mut adb_client::server_device::ADBServerDevice) -> Vec<FileEntry> {
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
        std::fs::write(&local_path, bytes)
            .map_err(|e| format!("Failed to write file: {e}"))?;

        Ok(local_path.to_string_lossy().to_string())
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

        let bytes = read_file_bytes(&mut device, &path)?;
        let filename = std::path::Path::new(&path)
            .file_name()
            .unwrap_or(std::ffi::OsStr::new("capubridge_file"))
            .to_string_lossy()
            .to_string();

        let open_dir = std::env::temp_dir().join("capubridge-open");
        std::fs::create_dir_all(&open_dir).map_err(|e| format!("Failed to create temp dir: {e}"))?;
        let target_path = open_dir.join(filename);
        std::fs::write(&target_path, bytes).map_err(|e| format!("Failed to write temp file: {e}"))?;
        open_with_default_app(&target_path)?;

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

    let escaped = path.replace('\'', "'\\''");
    let cmd = if is_dir {
        format!("rm -rf '{}' 2>&1", escaped)
    } else {
        format!("rm -f '{}' 2>&1", escaped)
    };

    let mut output = Vec::new();
    device
        .shell_command(&cmd, Some(&mut output), None::<&mut dyn Write>)
        .map_err(|e| format!("Delete command failed: {e}"))?;

    let out = strip_ansi(&String::from_utf8_lossy(&output));
    let out = out.trim();
    if out.contains("Permission denied") || out.contains("Operation not permitted") {
        return Err(out.to_string());
    }

    Ok(())
}
