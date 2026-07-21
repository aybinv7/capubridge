//! Session/device tools: `get_active_session`, `list_devices`, `list_targets`,
//! `select_device`.

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools};
use crate::mcp::types::{SelectDeviceParams, SerialParams};
use crate::session::guards::require_online_session;

#[tool_router(router = session_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
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
        description = "Discover the debuggable WebView / CDP targets for one device serial (queries the device live — always fresh, not a cache read). Call list_devices first to obtain valid serials. Re-call this after switching which app is in the foreground before reusing a target_id — CDP targets can go stale or be replaced by a new one across an app switch.",
        annotations(read_only_hint = true)
    )]
    async fn list_targets(
        &self,
        Parameters(SerialParams { serial }): Parameters<SerialParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let targets = session
            .refresh_targets()
            .map_err(|error| ErrorData::internal_error(error, None))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;

    #[tokio::test]
    async fn list_devices_on_empty_registry_is_ok_and_empty() {
        let result = tools().list_devices().await.expect("ok");
        assert_eq!(result.is_error, Some(false));
        // Array payloads must NOT populate structured_content (MCP requires
        // it to be an object) — the array only appears in the text block.
        assert!(result.structured_content.is_none());
        let text = result.content[0]
            .as_text()
            .expect("text content block")
            .text
            .clone();
        let value: serde_json::Value = serde_json::from_str(&text).expect("valid json");
        assert!(value.is_array());
        assert_eq!(value.as_array().unwrap().len(), 0);
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
