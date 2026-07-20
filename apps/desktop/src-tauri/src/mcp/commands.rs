//! Tauri commands that let the app UI control the MCP server (Settings toggle
//! + status indicator). Off by default; enabling binds the server and publishes
//! the discovery manifest, disabling stops it and removes the manifest.

use serde::Serialize;
use tauri::{AppHandle, State};

use super::{discovery, server, McpServerState};
use crate::session::registry::SessionRegistryState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub url: Option<String>,
}

fn status_of(state: &McpServerState) -> McpStatus {
    let port = state.port();
    McpStatus {
        running: port.is_some(),
        url: port.map(|value| format!("http://127.0.0.1:{value}/mcp")),
        port,
    }
}

#[tauri::command]
pub fn mcp_get_status(state: State<'_, McpServerState>) -> McpStatus {
    status_of(&state)
}

#[tauri::command]
pub async fn mcp_set_enabled(
    app: AppHandle,
    state: State<'_, McpServerState>,
    registry: State<'_, SessionRegistryState>,
    enabled: bool,
) -> Result<McpStatus, String> {
    if enabled {
        if !state.is_running() {
            let running = server::start(registry.registry()).await?;
            let port = running.port;
            let token = running.token.clone();
            state.set_running(running);
            discovery::write_manifest(&app, port, &token)?;
        }
    } else if let Some(running) = state.take_running() {
        running.shutdown().await;
        discovery::remove_manifest(&app)?;
    }

    Ok(status_of(&state))
}
