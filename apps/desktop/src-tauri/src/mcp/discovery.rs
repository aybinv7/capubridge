//! Discovery manifest for the embedded MCP server.
//!
//! When MCP access is enabled the app writes `bridge.json` into its config dir
//! (`%APPDATA%\<bundle>\` on Windows, the platform equivalent elsewhere) so the
//! user can copy the localhost URL + bearer token into their MCP client. The
//! file is removed when access is disabled and rewritten on each enable.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const MANIFEST_FILE: &str = "bridge.json";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeManifest {
    port: u16,
    token: String,
    pid: u32,
    version: String,
    url: String,
}

/// Resolve the app config directory that holds the manifest.
fn manifest_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve config dir: {error}"))
}

/// Write the manifest into `dir`, creating it if needed. Pure over the path so
/// it can be tested without a Tauri `AppHandle`.
pub fn write_manifest_at(dir: &Path, port: u16, token: &str) -> Result<PathBuf, String> {
    fs::create_dir_all(dir).map_err(|error| format!("Failed to create config dir: {error}"))?;
    let manifest = BridgeManifest {
        port,
        token: token.to_string(),
        pid: std::process::id(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        url: format!("http://127.0.0.1:{port}/mcp"),
    };
    let json = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("Failed to encode manifest: {error}"))?;
    let path = dir.join(MANIFEST_FILE);
    fs::write(&path, json).map_err(|error| format!("Failed to write manifest: {error}"))?;
    Ok(path)
}

/// Remove the manifest from `dir`. Missing file is treated as success.
pub fn remove_manifest_at(dir: &Path) -> Result<(), String> {
    let path = dir.join(MANIFEST_FILE);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to remove manifest: {error}")),
    }
}

/// Write the manifest into the app config dir.
pub fn write_manifest(app: &AppHandle, port: u16, token: &str) -> Result<PathBuf, String> {
    write_manifest_at(&manifest_dir(app)?, port, token)
}

/// Remove the manifest from the app config dir.
pub fn remove_manifest(app: &AppHandle) -> Result<(), String> {
    remove_manifest_at(&manifest_dir(app)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_then_remove_round_trip() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = write_manifest_at(dir.path(), 9333, "tok").expect("write");
        assert!(path.exists());

        let contents = fs::read_to_string(&path).expect("read");
        assert!(contents.contains("\"port\": 9333"));
        assert!(contents.contains("\"token\": \"tok\""));
        assert!(contents.contains("http://127.0.0.1:9333/mcp"));

        remove_manifest_at(dir.path()).expect("remove");
        assert!(!path.exists());
    }

    #[test]
    fn remove_missing_is_ok() {
        let dir = tempfile::tempdir().expect("tempdir");
        remove_manifest_at(dir.path()).expect("remove missing should succeed");
    }
}
