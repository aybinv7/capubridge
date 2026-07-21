//! Persistent MCP configuration (`mcp-config.json` in the app config dir).
//!
//! Persisting `enabled` / `port` / `token` gives the user a stable client URL +
//! token across app restarts and lets the app auto-start the server on launch
//! when it was left enabled. The token is only generated once the user first
//! enables access, so nothing is written before opt-in.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::auth;

const CONFIG_FILE: &str = "mcp-config.json";

/// Default localhost port for the MCP endpoint. Fixed (not ephemeral) so the
/// client config stays valid across restarts; user-overridable.
pub const DEFAULT_PORT: u16 = 8765;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    /// Whether MCP access is enabled (persisted so it survives restarts).
    pub enabled: bool,
    /// Localhost port to bind.
    pub port: u16,
    /// Bearer token. Empty until the user first enables access.
    pub token: String,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: DEFAULT_PORT,
            token: String::new(),
        }
    }
}

impl McpConfig {
    /// Ensure a token exists, generating one on first use.
    pub fn ensure_token(&mut self) {
        if self.token.is_empty() {
            self.token = auth::generate_token();
        }
    }

    pub fn has_token(&self) -> bool {
        !self.token.is_empty()
    }
}

/// Load config from `dir`, falling back to defaults on a missing/corrupt file.
pub fn load_at(dir: &Path) -> McpConfig {
    match fs::read_to_string(dir.join(CONFIG_FILE)) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => McpConfig::default(),
    }
}

/// Persist config into `dir`, creating it if needed.
pub fn save_at(dir: &Path, config: &McpConfig) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|error| format!("Failed to create config dir: {error}"))?;
    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Failed to encode MCP config: {error}"))?;
    fs::write(dir.join(CONFIG_FILE), json)
        .map_err(|error| format!("Failed to write MCP config: {error}"))?;
    Ok(())
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve config dir: {error}"))
}

pub fn load(app: &AppHandle) -> Result<McpConfig, String> {
    Ok(load_at(&config_dir(app)?))
}

pub fn save(app: &AppHandle, config: &McpConfig) -> Result<(), String> {
    save_at(&config_dir(app)?, config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_yields_defaults() {
        let dir = tempfile::tempdir().expect("tempdir");
        let config = load_at(dir.path());
        assert!(!config.enabled);
        assert_eq!(config.port, DEFAULT_PORT);
        assert!(!config.has_token());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().expect("tempdir");
        let mut config = McpConfig::default();
        config.enabled = true;
        config.port = 9000;
        config.ensure_token();
        let token = config.token.clone();
        save_at(dir.path(), &config).expect("save");

        let loaded = load_at(dir.path());
        assert!(loaded.enabled);
        assert_eq!(loaded.port, 9000);
        assert_eq!(loaded.token, token);
    }

    #[test]
    fn ensure_token_is_stable_once_set() {
        let mut config = McpConfig::default();
        config.ensure_token();
        let first = config.token.clone();
        config.ensure_token();
        assert_eq!(config.token, first);
    }

    #[test]
    fn corrupt_file_falls_back_to_defaults() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::write(dir.path().join(CONFIG_FILE), "not json").expect("write");
        let config = load_at(dir.path());
        assert_eq!(config.port, DEFAULT_PORT);
    }
}
