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

use super::cdp;
use super::types::{
    EvaluateJsParams, ReadStorageParams, SelectDeviceParams, SerialParams, StorageKind,
};
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

    #[tool(
        name = "evaluate_js",
        description = "Execute a JavaScript expression in a connected WebView target via CDP Runtime.evaluate. Get target_id from list_targets. Mutates a live page: requires confirm: true, or the call fails with an explanation instead of running anything.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn evaluate_js(
        &self,
        Parameters(EvaluateJsParams {
            serial,
            target_id,
            expression,
            confirm,
        }): Parameters<EvaluateJsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if !confirm {
            return Err(ErrorData::invalid_params(
                "evaluate_js runs JavaScript in a live page and requires confirm: true. \
                 Re-call with confirm: true once you intend to run this expression."
                    .to_string(),
                None,
            ));
        }

        let targets = self
            .registry
            .session_for_serial(&serial)
            .map(|session| session.list_targets())
            .unwrap_or_default();
        let target = targets
            .into_iter()
            .find(|target| target.id == target_id)
            .ok_or_else(|| {
                ErrorData::invalid_params(format!("Unknown target_id: {target_id}"), None)
            })?;

        let envelope = cdp::evaluate(&target.web_socket_debugger_url, &expression)
            .await
            .map_err(|error| ErrorData::internal_error(error, None))?;
        let value = cdp::evaluate_value(&envelope).map_err(|error| {
            ErrorData::internal_error(format!("Expression threw: {error}"), None)
        })?;
        ok_json(&value)
    }

    #[tool(
        name = "read_storage",
        description = "Read localStorage, sessionStorage, or IndexedDB from a connected WebView target. Get target_id from list_targets. kind is one of local_storage, session_storage, indexeddb_databases, indexeddb_store. indexeddb_store additionally requires database and store, and supports limit (default 100, max 500) and offset for pagination. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_storage(
        &self,
        Parameters(ReadStorageParams {
            serial,
            target_id,
            kind,
            database,
            store,
            limit,
            offset,
        }): Parameters<ReadStorageParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let targets = self
            .registry
            .session_for_serial(&serial)
            .map(|session| session.list_targets())
            .unwrap_or_default();
        let target = targets
            .into_iter()
            .find(|target| target.id == target_id)
            .ok_or_else(|| {
                ErrorData::invalid_params(format!("Unknown target_id: {target_id}"), None)
            })?;

        let script = match kind {
            StorageKind::LocalStorage => cdp::local_storage_script().to_string(),
            StorageKind::SessionStorage => cdp::session_storage_script().to_string(),
            StorageKind::IndexeddbDatabases => cdp::indexeddb_databases_script().to_string(),
            StorageKind::IndexeddbStore => {
                let database = database.ok_or_else(|| {
                    ErrorData::invalid_params(
                        "kind=indexeddb_store requires 'database'".to_string(),
                        None,
                    )
                })?;
                let store = store.ok_or_else(|| {
                    ErrorData::invalid_params(
                        "kind=indexeddb_store requires 'store'".to_string(),
                        None,
                    )
                })?;
                let limit = limit.unwrap_or(100).clamp(1, 500);
                let offset = offset.unwrap_or(0);
                cdp::indexeddb_store_script(&database, &store, limit, offset)
            }
        };

        let envelope = cdp::evaluate(&target.web_socket_debugger_url, &script)
            .await
            .map_err(|error| ErrorData::internal_error(error, None))?;
        let value = cdp::evaluate_value(&envelope)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&value)
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
                 active device. Read-only tools (including read_storage) are safe to call \
                 freely. evaluate_js runs JavaScript in a live page via CDP and requires \
                 confirm: true.",
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
    async fn evaluate_js_without_confirm_is_rejected() {
        let result = tools()
            .evaluate_js(Parameters(EvaluateJsParams {
                serial: "does-not-matter".into(),
                target_id: "does-not-matter".into(),
                expression: "1+1".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn evaluate_js_with_confirm_but_unknown_target_errors() {
        let result = tools()
            .evaluate_js(Parameters(EvaluateJsParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
                expression: "1+1".into(),
                confirm: true,
            }))
            .await;
        let error = result.expect_err("unknown target must error, not attempt a connection");
        assert!(error.message.contains("no-such-target"));
    }

    #[tokio::test]
    async fn read_storage_unknown_target_errors() {
        let result = tools()
            .read_storage(Parameters(ReadStorageParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
                kind: StorageKind::LocalStorage,
                database: None,
                store: None,
                limit: None,
                offset: None,
            }))
            .await;
        let error = result.expect_err("unknown target must error");
        assert!(error.message.contains("no-such-target"));
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
