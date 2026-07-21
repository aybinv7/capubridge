//! Tauri commands backing the MCP Settings panel.
//!
//! State is persisted in [`super::config`] so `enabled` / `port` / `token`
//! survive restarts (the app auto-starts on launch when left enabled). Every
//! command returns the full [`McpStatus`] so the UI can render from one source.

use serde::Serialize;
use tauri::{AppHandle, State};

use super::{config, discovery, server, McpServerState};
use crate::session::registry::SessionRegistryState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    /// Persisted preference: whether MCP access is turned on.
    pub enabled: bool,
    /// Whether the server is actually bound right now.
    pub running: bool,
    /// Configured localhost port.
    pub port: u16,
    /// Full endpoint URL, present only while running.
    pub url: Option<String>,
    /// Bearer token (empty until access is first enabled).
    pub token: String,
    /// Whether a token has been generated.
    pub has_token: bool,
}

fn build_status(cfg: &config::McpConfig, state: &McpServerState) -> McpStatus {
    let running = state.is_running();
    let bound_port = state.port().unwrap_or(cfg.port);
    McpStatus {
        enabled: cfg.enabled,
        running,
        port: cfg.port,
        url: running.then(|| format!("http://127.0.0.1:{bound_port}/mcp")),
        token: cfg.token.clone(),
        has_token: cfg.has_token(),
    }
}

async fn start_from_config(
    app: &AppHandle,
    state: &McpServerState,
    registry: &SessionRegistryState,
    cfg: &config::McpConfig,
) -> Result<(), String> {
    let running = server::start(registry.registry(), cfg.port, cfg.token.clone()).await?;
    let port = running.port;
    discovery::write_manifest(app, port, &running.token)?;
    state.set_running(running);
    Ok(())
}

async fn stop_server(app: &AppHandle, state: &McpServerState) -> Result<(), String> {
    if let Some(running) = state.take_running() {
        running.shutdown().await;
    }
    discovery::remove_manifest(app)?;
    Ok(())
}

#[tauri::command]
pub fn mcp_get_status(
    app: AppHandle,
    state: State<'_, McpServerState>,
) -> Result<McpStatus, String> {
    let cfg = config::load(&app)?;
    Ok(build_status(&cfg, &state))
}

#[tauri::command]
pub async fn mcp_set_enabled(
    app: AppHandle,
    state: State<'_, McpServerState>,
    registry: State<'_, SessionRegistryState>,
    enabled: bool,
) -> Result<McpStatus, String> {
    let mut cfg = config::load(&app)?;
    if enabled {
        cfg.ensure_token();
        cfg.enabled = true;
        config::save(&app, &cfg)?;
        if !state.is_running() {
            start_from_config(&app, &state, &registry, &cfg).await?;
        }
    } else {
        cfg.enabled = false;
        config::save(&app, &cfg)?;
        stop_server(&app, &state).await?;
    }
    Ok(build_status(&cfg, &state))
}

#[tauri::command]
pub async fn mcp_set_port(
    app: AppHandle,
    state: State<'_, McpServerState>,
    registry: State<'_, SessionRegistryState>,
    port: u16,
) -> Result<McpStatus, String> {
    if port == 0 {
        return Err("Port must be between 1 and 65535".to_string());
    }
    let mut cfg = config::load(&app)?;
    cfg.port = port;
    config::save(&app, &cfg)?;
    // Rebind on the new port if currently running.
    if state.is_running() {
        stop_server(&app, &state).await?;
        start_from_config(&app, &state, &registry, &cfg).await?;
    }
    Ok(build_status(&cfg, &state))
}

#[tauri::command]
pub async fn mcp_regenerate_token(
    app: AppHandle,
    state: State<'_, McpServerState>,
    registry: State<'_, SessionRegistryState>,
) -> Result<McpStatus, String> {
    let mut cfg = config::load(&app)?;
    cfg.token = String::new();
    cfg.ensure_token();
    config::save(&app, &cfg)?;
    // Restart so the new token takes effect and the manifest is rewritten.
    if state.is_running() {
        stop_server(&app, &state).await?;
        start_from_config(&app, &state, &registry, &cfg).await?;
    }
    Ok(build_status(&cfg, &state))
}
