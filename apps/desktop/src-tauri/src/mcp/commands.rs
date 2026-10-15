//! Tauri commands backing the MCP Settings panel.
//!
//! State is persisted in [`super::config`] so `enabled` / `port` / `token`
//! survive restarts (the app auto-starts on launch when left enabled). Every
//! command returns the full [`McpStatus`] so the UI can render from one source.

use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, State};

use super::{auth, config, discovery, server, McpServerState};
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
    /// Whether a token has been generated.
    pub has_token: bool,
    pub allow_mutations: bool,
    pub principals: Vec<auth::McpPrincipalSummary>,
    pub issued_token: Option<String>,
}

fn registry_for(
    app: &AppHandle,
    state: &McpServerState,
    cfg: &config::McpConfig,
) -> Result<Arc<auth::PrincipalRegistry>, String> {
    state
        .principals()
        .map(Ok)
        .unwrap_or_else(|| auth::PrincipalRegistry::load(app, Some(&cfg.token), cfg.allow_mutations))
}

fn build_status(
    cfg: &config::McpConfig,
    state: &McpServerState,
    principals: &auth::PrincipalRegistry,
    issued_token: Option<String>,
) -> McpStatus {
    let running = state.is_running();
    let bound_port = state.port().unwrap_or(cfg.port);
    McpStatus {
        enabled: cfg.enabled,
        running,
        port: cfg.port,
        url: running.then(|| format!("http://127.0.0.1:{bound_port}/mcp")),
        has_token: cfg.has_token(),
        allow_mutations: cfg.allow_mutations,
        principals: principals.list(),
        issued_token,
    }
}

async fn start_from_config(
    app: &AppHandle,
    state: &McpServerState,
    registry: &SessionRegistryState,
    cfg: &config::McpConfig,
) -> Result<(), String> {
    let sessions_dir = crate::commands::recording::sessions_dir(app)?;
    let principals = auth::PrincipalRegistry::load(
        app,
        Some(&cfg.token),
        cfg.allow_mutations,
    )?;
    let running = server::start(
        registry.registry(),
        cfg.port,
        sessions_dir,
        Some(app.clone()),
        cfg.allow_mutations,
        principals,
    )
    .await?;
    let port = running.port;
    discovery::write_manifest(app, port)?;
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
    let principals = registry_for(&app, &state, &cfg)?;
    Ok(build_status(&cfg, &state, &principals, None))
}

#[tauri::command]
pub async fn mcp_set_enabled(
    app: AppHandle,
    state: State<'_, McpServerState>,
    registry: State<'_, SessionRegistryState>,
    enabled: bool,
) -> Result<McpStatus, String> {
    let mut cfg = config::load(&app)?;
    let issued_token = if enabled && !cfg.has_token() {
        cfg.ensure_token();
        Some(cfg.token.clone())
    } else {
        None
    };
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
    let principals = registry_for(&app, &state, &cfg)?;
    Ok(build_status(&cfg, &state, &principals, issued_token))
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
    let principals = registry_for(&app, &state, &cfg)?;
    Ok(build_status(&cfg, &state, &principals, None))
}

#[tauri::command]
pub async fn mcp_set_allow_mutations(
    app: AppHandle,
    state: State<'_, McpServerState>,
    registry: State<'_, SessionRegistryState>,
    allow_mutations: bool,
) -> Result<McpStatus, String> {
    let mut cfg = config::load(&app)?;
    cfg.allow_mutations = allow_mutations;
    config::save(&app, &cfg)?;
    let principals = registry_for(&app, &state, &cfg)?;
    principals.set_legacy_mutations(allow_mutations)?;
    if state.is_running() {
        stop_server(&app, &state).await?;
        start_from_config(&app, &state, &registry, &cfg).await?;
    }
    let principals = registry_for(&app, &state, &cfg)?;
    Ok(build_status(&cfg, &state, &principals, None))
}

#[tauri::command]
pub async fn mcp_regenerate_token(
    app: AppHandle,
    state: State<'_, McpServerState>,
    registry: State<'_, SessionRegistryState>,
) -> Result<McpStatus, String> {
    let mut cfg = config::load(&app)?;
    cfg.ensure_token();
    let principals = auth::PrincipalRegistry::load(
        &app,
        Some(&cfg.token),
        cfg.allow_mutations,
    )?;
    let rotated = principals.rotate_legacy(cfg.allow_mutations)?;
    let issued_token = rotated.token.clone();
    cfg.token = issued_token.clone();
    config::save(&app, &cfg)?;
    // Restart so the new token takes effect and the manifest is rewritten.
    if state.is_running() {
        stop_server(&app, &state).await?;
        start_from_config(&app, &state, &registry, &cfg).await?;
    }
    let principals = registry_for(&app, &state, &cfg)?;
    Ok(build_status(&cfg, &state, &principals, Some(issued_token)))
}

#[tauri::command]
pub fn mcp_list_principals(
    app: AppHandle,
    state: State<'_, McpServerState>,
) -> Result<Vec<auth::McpPrincipalSummary>, String> {
    let cfg = config::load(&app)?;
    Ok(registry_for(&app, &state, &cfg)?.list())
}

#[tauri::command]
pub fn mcp_create_principal(
    app: AppHandle,
    state: State<'_, McpServerState>,
    name: String,
    capabilities: Vec<String>,
) -> Result<auth::CreatedMcpPrincipal, String> {
    let mut cfg = config::load(&app)?;
    if cfg.token.is_empty() {
        cfg.ensure_token();
        config::save(&app, &cfg)?;
    }
    let registry = registry_for(&app, &state, &cfg)?;
    let capabilities = auth::parse_capabilities(&capabilities)?;
    registry.create(name, capabilities)
}

#[tauri::command]
pub fn mcp_revoke_principal(
    app: AppHandle,
    state: State<'_, McpServerState>,
    id: String,
) -> Result<Vec<auth::McpPrincipalSummary>, String> {
    let cfg = config::load(&app)?;
    let registry = registry_for(&app, &state, &cfg)?;
    registry.revoke(&id)?;
    Ok(registry.list())
}
