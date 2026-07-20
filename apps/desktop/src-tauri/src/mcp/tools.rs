//! The MCP tool surface.
//!
//! Every tool holds an `Arc<SessionRegistry>` and calls the exact same registry
//! / session methods the `#[tauri::command]` wrappers call — there is no
//! duplicated device logic here. Phase 1 exposes read-only session/device tools
//! plus non-destructive device selection.

use std::sync::Arc;

use rmcp::handler::server::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock, Implementation, ServerCapabilities, ServerInfo};
use rmcp::{tool, tool_handler, tool_router, ErrorData, ServerHandler};
use serde::Serialize;

use super::types::{SelectDeviceParams, SerialParams};
use crate::session::registry::SessionRegistry;

/// Build a successful tool result carrying both a pretty-printed text block
/// (rendered by every client) and structured JSON content (for clients that
/// consume structured output).
fn ok_json<T: Serialize>(payload: &T) -> Result<CallToolResult, ErrorData> {
    let value = serde_json::to_value(payload)
        .map_err(|error| ErrorData::internal_error(format!("serialize failed: {error}"), None))?;
    let text = serde_json::to_string_pretty(&value)
        .map_err(|error| ErrorData::internal_error(format!("serialize failed: {error}"), None))?;
    let mut result = CallToolResult::success(vec![ContentBlock::text(text)]);
    result.structured_content = Some(value);
    Ok(result)
}

/// MCP tool handler bound to the live session registry.
#[derive(Clone)]
pub struct CapuBridgeTools {
    registry: Arc<SessionRegistry>,
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl CapuBridgeTools {
    pub fn new(registry: Arc<SessionRegistry>) -> Self {
        Self {
            registry,
            tool_router: Self::tool_router(),
        }
    }

    #[tool(
        name = "get_active_session",
        description = "Get the current CapuBridge session: the active device serial, ADB tracker status, and all known devices. Call this first to see what the user has selected.",
        annotations(read_only_hint = true)
    )]
    async fn get_active_session(&self) -> Result<CallToolResult, ErrorData> {
        ok_json(&self.registry.snapshot())
    }

    #[tool(
        name = "list_devices",
        description = "List every ADB device CapuBridge is tracking, with connection status, staleness, and which one is active.",
        annotations(read_only_hint = true)
    )]
    async fn list_devices(&self) -> Result<CallToolResult, ErrorData> {
        ok_json(&self.registry.list_devices())
    }

    #[tool(
        name = "list_targets",
        description = "List the debuggable WebView / CDP targets for one device serial. Call list_devices first to obtain valid serials.",
        annotations(read_only_hint = true)
    )]
    async fn list_targets(
        &self,
        Parameters(SerialParams { serial }): Parameters<SerialParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if self.registry.device_snapshot(&serial).is_none() {
            return Err(ErrorData::invalid_params(
                format!("Unknown device serial: {serial}"),
                None,
            ));
        }
        let targets = self
            .registry
            .session_for_serial(&serial)
            .map(|session| session.list_targets())
            .unwrap_or_default();
        ok_json(&targets)
    }

    #[tool(
        name = "select_device",
        description = "Set the active device by serial, or clear the active device by omitting serial. Returns the updated session snapshot.",
        annotations(read_only_hint = false)
    )]
    async fn select_device(
        &self,
        Parameters(SelectDeviceParams { serial }): Parameters<SelectDeviceParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let snapshot = self
            .registry
            .set_active_serial(serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        ok_json(&snapshot)
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for CapuBridgeTools {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new(
                "capubridge-mcp",
                env!("CARGO_PKG_VERSION"),
            ))
            .with_instructions(
                "CapuBridge exposes a live Android WebView debugging session. \
                 Call get_active_session first to see the active device and tracker status, \
                 then list_devices / list_targets to explore, and select_device to change the \
                 active device. Read-only tools are safe to call freely.",
            )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tools() -> CapuBridgeTools {
        CapuBridgeTools::new(Arc::new(SessionRegistry::new()))
    }

    #[tokio::test]
    async fn list_devices_on_empty_registry_is_ok_and_empty() {
        let result = tools().list_devices().await.expect("ok");
        assert_eq!(result.is_error, Some(false));
        let structured = result.structured_content.expect("structured content");
        assert!(structured.is_array());
        assert_eq!(structured.as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn get_active_session_reports_no_active_device() {
        let result = tools().get_active_session().await.expect("ok");
        let structured = result.structured_content.expect("structured content");
        assert!(structured.get("activeSerial").is_some());
        assert!(structured["activeSerial"].is_null());
    }

    #[tokio::test]
    async fn list_targets_unknown_serial_errors() {
        let result = tools()
            .list_targets(Parameters(SerialParams {
                serial: "does-not-exist".into(),
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn select_unknown_device_errors() {
        let result = tools()
            .select_device(Parameters(SelectDeviceParams {
                serial: Some("does-not-exist".into()),
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn select_none_clears_active_device() {
        let result = tools()
            .select_device(Parameters(SelectDeviceParams { serial: None }))
            .await
            .expect("clearing active device is allowed");
        assert_eq!(result.is_error, Some(false));
    }
}
