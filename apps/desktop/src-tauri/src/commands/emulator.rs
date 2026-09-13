use std::env;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime};

use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};

const EARLY_EXIT_WINDOW: Duration = Duration::from_secs(8);
const POLL_INTERVAL: Duration = Duration::from_millis(200);
const STOP_GRACE: Duration = Duration::from_secs(5);
const LOG_TAIL_LINES: usize = 25;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningEmulator {
    pub serial: Option<String>,
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidVirtualDevice {
    pub name: String,
    pub running: Option<RunningEmulator>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorLaunchResult {
    pub avd_name: String,
    pub log_path: String,
    pub already_running: bool,
    pub serial: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorStopResult {
    pub avd_name: String,
    pub serial: Option<String>,
    pub pid: u32,
}

struct EmulatorTool {
    executable: PathBuf,
    sdk_root: Option<PathBuf>,
}

fn android_sdk_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for key in ["ANDROID_SDK_ROOT", "ANDROID_HOME"] {
        if let Some(value) = env::var_os(key) {
            let path = PathBuf::from(value);
            if !path.as_os_str().is_empty() {
                candidates.push(path);
            }
        }
    }

    #[cfg(target_os = "windows")]
    if let Some(local_app_data) = env::var_os("LOCALAPPDATA").or_else(|| {
        env::var_os("USERPROFILE").map(|profile| {
            PathBuf::from(profile)
                .join("AppData")
                .join("Local")
                .into_os_string()
        })
    }) {
        candidates.push(PathBuf::from(local_app_data).join("Android").join("Sdk"));
    }

    #[cfg(target_os = "macos")]
    if let Some(home) = env::var_os("HOME") {
        candidates.push(
            PathBuf::from(home)
                .join("Library")
                .join("Android")
                .join("sdk"),
        );
    }

    #[cfg(target_os = "linux")]
    if let Some(home) = env::var_os("HOME") {
        candidates.push(PathBuf::from(home).join("Android").join("Sdk"));
    }

    candidates.dedup();
    candidates
}

fn emulator_executable() -> Result<EmulatorTool, String> {
    let binary = if cfg!(target_os = "windows") {
        "emulator.exe"
    } else {
        "emulator"
    };

    let candidates = android_sdk_candidates();
    for sdk_root in &candidates {
        let executable = sdk_root.join("emulator").join(binary);
        if executable.is_file() {
            return Ok(EmulatorTool {
                executable,
                sdk_root: Some(sdk_root.clone()),
            });
        }
    }

    if let Ok(found) = which::which("emulator") {
        return Ok(EmulatorTool {
            executable: found,
            sdk_root: None,
        });
    }

    let searched = candidates
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");
    Err(format!(
        "Android Emulator was not found. Install Android Studio's Emulator package or set ANDROID_SDK_ROOT. Searched: [{searched}] and PATH."
    ))
}

fn installed_avd_names() -> Result<(EmulatorTool, Vec<String>), String> {
    let tool = emulator_executable()?;
    let output = Command::new(&tool.executable)
        .arg("-list-avds")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Failed to list Android Virtual Devices: {error}"))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if error.is_empty() {
            "Android Emulator could not list Android Virtual Devices.".to_string()
        } else {
            format!("Android Emulator could not list Android Virtual Devices: {error}")
        });
    }

    let names = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect();
    Ok((tool, names))
}

fn avd_home() -> Option<PathBuf> {
    if let Some(home) = env::var_os("ANDROID_AVD_HOME") {
        return Some(PathBuf::from(home));
    }
    let user_home = env::var_os("ANDROID_USER_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            env::var_os("USERPROFILE")
                .or_else(|| env::var_os("HOME"))
                .map(|home| PathBuf::from(home).join(".android"))
        })?;
    Some(user_home.join("avd"))
}

fn avd_dir(avd_name: &str) -> Option<PathBuf> {
    avd_home().map(|home| home.join(format!("{avd_name}.avd")))
}

fn running_instance_dirs() -> Vec<PathBuf> {
    let primary = env::temp_dir().join("avd").join("running");

    #[cfg(target_os = "windows")]
    {
        vec![primary]
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut dirs = vec![primary];
        if let Some(user) = env::var_os("USER") {
            dirs.push(
                PathBuf::from(format!("/tmp/android-{}", user.to_string_lossy()))
                    .join("avd")
                    .join("running"),
            );
        }
        dirs
    }
}

fn process_alive(system: &mut System, pid: u32) -> bool {
    let pid = Pid::from_u32(pid);
    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
    system.process(pid).is_some()
}

fn parse_advertisement(path: &Path) -> Option<(String, RunningEmulator)> {
    let pid = path
        .file_stem()?
        .to_str()?
        .strip_prefix("pid_")?
        .parse::<u32>()
        .ok()?;

    let contents = fs::read_to_string(path).ok()?;
    let mut avd_id = None;
    let mut serial_port = None;
    for line in contents.lines() {
        if let Some(value) = line.strip_prefix("avd.id=") {
            avd_id = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("port.serial=") {
            serial_port = Some(value.trim().to_string());
        }
    }

    Some((
        avd_id?,
        RunningEmulator {
            serial: serial_port.map(|port| format!("emulator-{port}")),
            pid,
        },
    ))
}

fn advertised_emulators() -> Vec<(String, RunningEmulator)> {
    let mut system = System::new();
    let mut found = Vec::new();

    for dir in running_instance_dirs() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some((avd_id, running)) = parse_advertisement(&path) else {
                continue;
            };
            if process_alive(&mut system, running.pid) {
                found.push((avd_id, running));
            } else {
                let _ = fs::remove_file(&path);
            }
        }
    }

    found
}

fn lock_owner(avd_name: &str) -> Option<u32> {
    let pid = fs::read_to_string(
        avd_dir(avd_name)?
            .join("hardware-qemu.ini.lock")
            .join("pid"),
    )
    .ok()?
    .trim()
    .parse::<u32>()
    .ok()?;

    let mut system = System::new();
    process_alive(&mut system, pid).then_some(pid)
}

fn running_emulator(avd_name: &str) -> Option<RunningEmulator> {
    advertised_emulators()
        .into_iter()
        .find(|(avd_id, _)| avd_id == avd_name)
        .map(|(_, running)| running)
        .or_else(|| lock_owner(avd_name).map(|pid| RunningEmulator { serial: None, pid }))
}

fn clear_stale_locks(avd_name: &str) {
    let Some(avd_dir) = avd_dir(avd_name) else {
        return;
    };
    let Ok(entries) = fs::read_dir(&avd_dir) else {
        return;
    };

    let mut system = System::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("lock") {
            continue;
        }

        let owner = fs::read_to_string(path.join("pid"))
            .ok()
            .and_then(|pid| pid.trim().parse::<u32>().ok());
        if let Some(pid) = owner {
            if process_alive(&mut system, pid) {
                return;
            }
        }

        if path.is_dir() {
            let _ = fs::remove_dir_all(&path);
        } else {
            let _ = fs::remove_file(&path);
        }
    }
}

#[cfg(target_os = "windows")]
fn login_environment() -> Option<Vec<(std::ffi::OsString, std::ffi::OsString)>> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::Security::{TOKEN_DUPLICATE, TOKEN_QUERY};
    use windows_sys::Win32::System::Environment::{
        CreateEnvironmentBlock, DestroyEnvironmentBlock,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    let separator = u16::from(b'=');
    let mut entries = Vec::new();

    unsafe {
        let mut token = std::ptr::null_mut();
        if OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY | TOKEN_DUPLICATE,
            &mut token,
        ) == 0
        {
            return None;
        }

        let mut block = std::ptr::null_mut();
        let created = CreateEnvironmentBlock(&mut block, token, 0);
        CloseHandle(token);
        if created == 0 || block.is_null() {
            return None;
        }

        let mut cursor = block as *const u16;
        loop {
            let mut length = 0usize;
            while *cursor.add(length) != 0 {
                length += 1;
            }
            if length == 0 {
                break;
            }

            let entry = std::slice::from_raw_parts(cursor, length);
            cursor = cursor.add(length + 1);

            if entry[0] == separator {
                continue;
            }
            let Some(split) = entry.iter().position(|unit| *unit == separator) else {
                continue;
            };
            entries.push((
                OsString::from_wide(&entry[..split]),
                OsString::from_wide(&entry[split + 1..]),
            ));
        }

        DestroyEnvironmentBlock(block);
    }

    Some(entries)
}

fn apply_launch_environment(command: &mut Command, sdk_root: Option<&Path>) {
    #[cfg(target_os = "windows")]
    if let Some(entries) = login_environment() {
        command.env_clear();
        for (key, value) in entries {
            command.env(key, value);
        }
        for key in [
            "ANDROID_AVD_HOME",
            "ANDROID_USER_HOME",
            "ANDROID_EMULATOR_HOME",
        ] {
            if let Some(value) = env::var_os(key) {
                command.env(key, value);
            }
        }
    }

    if let Some(root) = sdk_root {
        command
            .env("ANDROID_SDK_ROOT", root)
            .env("ANDROID_HOME", root);
    }
}

fn read_log(path: &Path) -> String {
    let mut contents = String::new();
    if File::open(path)
        .and_then(|mut file| file.read_to_string(&mut contents))
        .is_err()
    {
        return String::new();
    }
    contents
}

fn fatal_reason(contents: &str) -> Option<String> {
    let index = contents.find("FATAL")?;
    contents[index..]
        .lines()
        .next()
        .map(|line| line.trim().to_string())
}

fn failure_summary(path: &Path) -> String {
    let contents = read_log(path);
    if let Some(fatal) = fatal_reason(&contents) {
        return fatal;
    }

    let lines: Vec<&str> = contents
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    if lines.is_empty() {
        return "emulator produced no output".to_string();
    }

    let start = lines.len().saturating_sub(LOG_TAIL_LINES);
    lines[start..].join("\n")
}

fn launch_log_path(avd_name: &str) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0);
    env::temp_dir().join(format!("capubridge-emulator-{avd_name}-{stamp}.log"))
}

#[tauri::command]
pub fn emulator_list_avds() -> Result<Vec<AndroidVirtualDevice>, String> {
    let (_, names) = installed_avd_names()?;

    Ok(names
        .into_iter()
        .map(|name| {
            let running = running_emulator(&name);
            AndroidVirtualDevice { name, running }
        })
        .collect())
}

#[tauri::command]
pub fn emulator_launch_avd(avd_name: String) -> Result<EmulatorLaunchResult, String> {
    let avd_name = avd_name.trim();
    if avd_name.is_empty() {
        return Err("Android Virtual Device name is required.".to_string());
    }

    let (tool, names) = installed_avd_names()?;
    if !names.iter().any(|name| name == avd_name) {
        return Err(format!("Android Virtual Device not found: {avd_name}"));
    }

    if let Some(running) = running_emulator(avd_name) {
        return Ok(EmulatorLaunchResult {
            avd_name: avd_name.to_string(),
            log_path: String::new(),
            already_running: true,
            serial: running.serial,
        });
    }

    clear_stale_locks(avd_name);

    let log_path = launch_log_path(avd_name);
    let log = File::create(&log_path).map_err(|error| {
        format!(
            "Failed to create emulator log at {}: {error}",
            log_path.display()
        )
    })?;
    let log_for_stderr = log
        .try_clone()
        .map_err(|error| format!("Failed to prepare emulator log: {error}"))?;

    let mut command = Command::new(&tool.executable);
    command
        .args(["-avd", avd_name])
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_for_stderr));

    apply_launch_environment(&mut command, tool.sdk_root.as_deref());

    if let Some(working_directory) = tool.executable.parent() {
        command.current_dir(working_directory);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to launch Android Virtual Device {avd_name}: {error}"))?;

    let deadline = Instant::now() + EARLY_EXIT_WINDOW;
    while Instant::now() < deadline {
        if let Some(fatal) = fatal_reason(&read_log(&log_path)) {
            let _ = child.kill();
            return Err(format!(
                "{avd_name} could not start. {fatal} (full log: {})",
                log_path.display()
            ));
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                return Err(format!(
                    "{avd_name} exited immediately ({status}). {} (full log: {})",
                    failure_summary(&log_path),
                    log_path.display()
                ));
            }
            Ok(None) => sleep(POLL_INTERVAL),
            Err(error) => {
                return Err(format!(
                    "Failed to monitor Android Virtual Device {avd_name}: {error}"
                ))
            }
        }
    }

    Ok(EmulatorLaunchResult {
        avd_name: avd_name.to_string(),
        log_path: log_path.display().to_string(),
        already_running: false,
        serial: None,
    })
}

#[tauri::command]
pub fn emulator_stop_avd(avd_name: String) -> Result<EmulatorStopResult, String> {
    let avd_name = avd_name.trim();
    if avd_name.is_empty() {
        return Err("Android Virtual Device name is required.".to_string());
    }

    let running = running_emulator(avd_name)
        .ok_or_else(|| format!("Android Virtual Device {avd_name} is not running."))?;

    let mut system = System::new();
    let pid = Pid::from_u32(running.pid);
    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
    let killed = system
        .process(pid)
        .map(|process| process.kill())
        .unwrap_or(false);
    if !killed {
        return Err(format!(
            "Could not terminate emulator process {} for {avd_name}.",
            running.pid
        ));
    }

    let deadline = Instant::now() + STOP_GRACE;
    while Instant::now() < deadline && process_alive(&mut system, running.pid) {
        sleep(POLL_INTERVAL);
    }
    if process_alive(&mut system, running.pid) {
        return Err(format!(
            "Emulator process {} for {avd_name} did not exit within {}s.",
            running.pid,
            STOP_GRACE.as_secs()
        ));
    }

    clear_stale_locks(avd_name);

    Ok(EmulatorStopResult {
        avd_name: avd_name.to_string(),
        serial: running.serial,
        pid: running.pid,
    })
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    const SYSTEM_VARIABLES: [&str; 8] = [
        "SYSTEMROOT",
        "PATH",
        "LOCALAPPDATA",
        "NUMBER_OF_PROCESSORS",
        "PROCESSOR_ARCHITECTURE",
        "USERNAME",
        "COMPUTERNAME",
        "TEMP",
    ];

    #[test]
    fn login_environment_contains_system_variables() {
        let entries = login_environment().expect("login environment block");
        let keys: Vec<String> = entries
            .iter()
            .map(|(key, _)| key.to_string_lossy().to_ascii_uppercase())
            .collect();

        assert!(entries.len() > 20, "only {} entries", entries.len());
        assert!(keys
            .iter()
            .all(|key| !key.is_empty() && !key.starts_with('=')));
        for expected in SYSTEM_VARIABLES {
            assert!(keys.iter().any(|key| key == expected), "missing {expected}");
        }
    }

    #[test]
    fn launch_environment_reaches_child_process() {
        let mut command = Command::new("cmd.exe");
        command.args(["/c", "set"]);
        apply_launch_environment(&mut command, Some(Path::new(r"C:\fake\sdk")));

        let output = command.output().expect("run cmd.exe");
        let listing = String::from_utf8_lossy(&output.stdout).to_ascii_uppercase();

        for expected in SYSTEM_VARIABLES {
            assert!(
                listing.contains(&format!("{expected}=")),
                "child is missing {expected}"
            );
        }
        assert!(listing.contains(r"ANDROID_SDK_ROOT=C:\FAKE\SDK"));
        assert!(listing.contains(r"ANDROID_HOME=C:\FAKE\SDK"));
    }
}
