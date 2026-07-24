use std::env;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidVirtualDevice {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorLaunchResult {
    pub avd_name: String,
}

fn android_sdk_root() -> Option<PathBuf> {
    env::var_os("ANDROID_SDK_ROOT")
        .or_else(|| env::var_os("ANDROID_HOME"))
        .map(PathBuf::from)
        .or_else(|| {
            env::var_os("LOCALAPPDATA")
                .map(|path| PathBuf::from(path).join("Android").join("Sdk"))
        })
}

fn emulator_executable() -> Result<PathBuf, String> {
    if let Some(sdk_root) = android_sdk_root() {
        let executable = if cfg!(target_os = "windows") {
            sdk_root.join("emulator").join("emulator.exe")
        } else {
            sdk_root.join("emulator").join("emulator")
        };
        if executable.is_file() {
            return Ok(executable);
        }
    }

    which::which("emulator").map_err(|_| {
        "Android Emulator was not found. Install Android Studio's Emulator package or set ANDROID_SDK_ROOT."
            .to_string()
    })
}

fn installed_avds() -> Result<(PathBuf, Vec<AndroidVirtualDevice>), String> {
    let emulator = emulator_executable()?;
    let output = Command::new(&emulator)
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

    let avds = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(|name| AndroidVirtualDevice {
            name: name.to_string(),
        })
        .collect();
    Ok((emulator, avds))
}

#[tauri::command]
pub fn emulator_list_avds() -> Result<Vec<AndroidVirtualDevice>, String> {
    installed_avds().map(|(_, avds)| avds)
}

#[tauri::command]
pub fn emulator_launch_avd(avd_name: String) -> Result<EmulatorLaunchResult, String> {
    let avd_name = avd_name.trim();
    if avd_name.is_empty() {
        return Err("Android Virtual Device name is required.".to_string());
    }

    let (emulator, avds) = installed_avds()?;
    if !avds.iter().any(|avd| avd.name == avd_name) {
        return Err(format!("Android Virtual Device not found: {avd_name}"));
    }

    Command::new(emulator)
        .args(["-avd", avd_name])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to launch Android Virtual Device {avd_name}: {error}"))?;

    Ok(EmulatorLaunchResult {
        avd_name: avd_name.to_string(),
    })
}
