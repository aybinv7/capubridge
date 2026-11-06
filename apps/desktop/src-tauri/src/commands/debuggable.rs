use std::io::Write as IoWrite;
use std::time::Duration;

use adb_client::ADBDeviceExt;

use crate::blocking::run_blocking;
use crate::commands::adb::{catch_adb_panic, get_adb_device};

const MARKER: &str = "CB_DEBUGGABLE:";
const SCAN_TIMEOUT: Duration = Duration::from_secs(20);

/// One shell pass over the third-party packages that keeps those `run-as` accepts, so a phone
/// with a hundred apps costs one round trip instead of a hundred.
fn scan_script() -> String {
    format!(
        "for p in $(pm list packages -3); do p=${{p#package:}}; run-as \"$p\" true >/dev/null 2>&1 && echo \"{MARKER}$p\"; done"
    )
}

fn is_package_name(value: &str) -> bool {
    !value.is_empty()
        && value.contains('.')
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_')
}

/// The packages the scan printed, sorted and without duplicates. Lines that are not scan output
/// (warnings, a shell banner) are ignored.
pub(crate) fn parse_debuggable_packages(output: &str) -> Vec<String> {
    let mut packages: Vec<String> = output
        .lines()
        .filter_map(|line| line.trim().strip_prefix(MARKER))
        .map(|name| name.trim().to_string())
        .filter(|name| is_package_name(name))
        .collect();
    packages.sort();
    packages.dedup();
    packages
}

fn list_debuggable_packages_inner(serial: &str) -> Result<Vec<String>, String> {
    let mut device = get_adb_device(serial)?;
    let mut output = Vec::new();
    device
        .shell_command(&scan_script(), Some(&mut output), None::<&mut dyn IoWrite>)
        .map_err(|e| format!("Could not list debuggable apps: {e}"))?;
    Ok(parse_debuggable_packages(&String::from_utf8_lossy(&output)))
}

/// Third-party apps on the device whose private files `run-as` can read: debuggable builds.
#[tauri::command]
pub async fn adb_list_debuggable_packages(serial: String) -> Result<Vec<String>, String> {
    let scan = run_blocking(move || {
        catch_adb_panic("adb_list_debuggable_packages", move || {
            list_debuggable_packages_inner(&serial)
        })
    });
    match tokio::time::timeout(SCAN_TIMEOUT, scan).await {
        Ok(result) => result?,
        Err(_) => Err(format!(
            "Listing debuggable apps took longer than {} seconds",
            SCAN_TIMEOUT.as_secs()
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_debuggable_packages, scan_script};

    #[test]
    fn keeps_only_marked_package_lines() {
        let output = "CB_DEBUGGABLE:com.example.notes\r\nrun-as: package not debuggable: com.other\nWARNING: linker\nCB_DEBUGGABLE:dz.shop.app\n";
        assert_eq!(
            parse_debuggable_packages(output),
            vec!["com.example.notes".to_string(), "dz.shop.app".to_string()]
        );
    }

    #[test]
    fn sorts_and_drops_duplicates_and_garbage() {
        let output = "CB_DEBUGGABLE:b.app\nCB_DEBUGGABLE:a.app\nCB_DEBUGGABLE:b.app\nCB_DEBUGGABLE:\nCB_DEBUGGABLE:not a package\nCB_DEBUGGABLE:nodots\n";
        assert_eq!(
            parse_debuggable_packages(output),
            vec!["a.app".to_string(), "b.app".to_string()]
        );
    }

    #[test]
    fn empty_output_means_no_debuggable_apps() {
        assert!(parse_debuggable_packages("").is_empty());
    }

    #[test]
    fn the_script_prints_the_marker_the_parser_reads() {
        let script = scan_script();
        assert!(script.contains("pm list packages -3"));
        assert!(script.contains("${p#package:}"));
        assert!(script.contains("echo \"CB_DEBUGGABLE:$p\""));
    }
}
