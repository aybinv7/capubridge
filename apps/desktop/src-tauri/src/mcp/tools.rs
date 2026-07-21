//! The MCP tool surface.
//!
//! Every tool holds an `Arc<SessionRegistry>` and calls the exact same registry
//! / session methods the `#[tauri::command]` wrappers call — there is no
//! duplicated device logic here. Phase 1 exposes read-only session/device tools
//! plus non-destructive device selection.

use std::sync::Arc;

use base64::{engine::general_purpose, Engine as _};
use rmcp::handler::server::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock, Implementation, ServerCapabilities, ServerInfo};
use rmcp::{tool, tool_handler, tool_router, ErrorData, ServerHandler};
use serde::Serialize;

use super::capture::CaptureRegistry;
use super::cdp;
use super::device_control;
use super::types::{
    EvaluateJsParams, GetScreenSizeParams, InputTextParams, LaunchAppParams, ListPackagesParams,
    PackageScope, PressKeyParams, ReadStorageParams, ScreenshotParams, SelectDeviceParams,
    SerialParams, ShellCommandParams, StorageKind, SwipeParams, TapParams, TargetParams,
};
use crate::commands::adb::PackageListScope;
use crate::commands::mirror::{adb_mirror_get_screen_size, adb_mirror_screenshot};
use crate::session::guards::require_online_session;
use crate::session::registry::SessionRegistry;
use crate::session::types::SessionTargetSnapshot;

/// Build a successful tool result carrying both a pretty-printed text block
/// (rendered by every client) and structured JSON content (for clients that
/// consume structured output).
///
/// Per the MCP spec, `structuredContent` must be a JSON object — a bare JSON
/// array (e.g. from a `Vec<T>` payload) fails schema validation on strict
/// clients, so it's only attached when the serialized payload is an object.
fn ok_json<T: Serialize>(payload: &T) -> Result<CallToolResult, ErrorData> {
    let value = serde_json::to_value(payload)
        .map_err(|error| ErrorData::internal_error(format!("serialize failed: {error}"), None))?;
    let text = serde_json::to_string_pretty(&value)
        .map_err(|error| ErrorData::internal_error(format!("serialize failed: {error}"), None))?;
    let mut result = CallToolResult::success(vec![ContentBlock::text(text)]);
    if value.is_object() {
        result.structured_content = Some(value);
    }
    Ok(result)
}

/// Decode a base64 PNG and write it to a fresh file under the OS temp dir, so
/// large screenshots don't have to travel through the tool result as base64
/// text (easily hundreds of KB, which blows past a client's per-call token
/// budget). Returns the absolute path and the decoded byte count.
fn write_png_to_temp_file(png_base64: &str) -> Result<(std::path::PathBuf, usize), String> {
    let bytes = general_purpose::STANDARD
        .decode(png_base64)
        .map_err(|error| format!("Failed to decode screenshot PNG: {error}"))?;
    let dir = std::env::temp_dir().join("capubridge-mcp-screenshots");
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create screenshot temp dir: {error}"))?;
    let path = dir.join(format!("{}.png", uuid::Uuid::new_v4()));
    std::fs::write(&path, &bytes)
        .map_err(|error| format!("Failed to write screenshot to {}: {error}", path.display()))?;
    Ok((path, bytes.len()))
}

/// MCP tool handler bound to the live session registry and the (in-memory,
/// per-server-lifetime) CDP capture registry backing `read_console`/`read_network`.
#[derive(Clone)]
pub struct CapuBridgeTools {
    registry: Arc<SessionRegistry>,
    captures: Arc<CaptureRegistry>,
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl CapuBridgeTools {
    pub fn new(registry: Arc<SessionRegistry>, captures: Arc<CaptureRegistry>) -> Self {
        Self {
            registry,
            captures,
            tool_router: Self::tool_router(),
        }
    }

    /// Resolve `target_id` on `serial` against the live session, or an error
    /// naming the target so the caller knows to re-check `list_targets`.
    fn find_target(&self, serial: &str, target_id: &str) -> Result<SessionTargetSnapshot, ErrorData> {
        self.registry
            .session_for_serial(serial)
            .map(|session| session.list_targets())
            .unwrap_or_default()
            .into_iter()
            .find(|target| target.id == target_id)
            .ok_or_else(|| {
                ErrorData::invalid_params(format!("Unknown target_id: {target_id}"), None)
            })
    }

    /// Gate a mutating/physical-effect tool behind an explicit `confirm: true`.
    fn require_confirm(confirm: bool, action: &str) -> Result<(), ErrorData> {
        if confirm {
            return Ok(());
        }
        Err(ErrorData::invalid_params(
            format!(
                "{action} requires confirm: true. Re-call with confirm: true once you intend \
                 to perform this action on the real device."
            ),
            None,
        ))
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

        let target = self.find_target(&serial, &target_id)?;

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
        let target = self.find_target(&serial, &target_id)?;

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

    #[tool(
        name = "read_console",
        description = "Read captured console messages for a connected WebView target. Capture starts on the first call for a target, so an early call may return few or no entries — call again after a moment to see more. Bounded to the most recent 200 entries. Get target_id from list_targets. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_console(
        &self,
        Parameters(TargetParams { serial, target_id }): Parameters<TargetParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let target = self.find_target(&serial, &target_id)?;
        let session = self
            .captures
            .ensure(&target_id, &target.web_socket_debugger_url);
        ok_json(&session.console_snapshot())
    }

    #[tool(
        name = "read_network",
        description = "Read captured network requests for a connected WebView target. Capture starts on the first call for a target, so an early call may return few or no entries — call again after a moment to see more. Bounded to the most recent 200 requests. Get target_id from list_targets. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_network(
        &self,
        Parameters(TargetParams { serial, target_id }): Parameters<TargetParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let target = self.find_target(&serial, &target_id)?;
        let session = self
            .captures
            .ensure(&target_id, &target.web_socket_debugger_url);
        ok_json(&session.network_snapshot())
    }

    #[tool(
        name = "list_packages",
        description = "List installed packages on a device. scope is third-party (default, user-installed apps) or all (includes system packages). Get serial from list_devices.",
        annotations(read_only_hint = true)
    )]
    async fn list_packages(
        &self,
        Parameters(ListPackagesParams { serial, scope }): Parameters<ListPackagesParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let scope = match scope {
            PackageScope::ThirdParty => PackageListScope::ThirdParty,
            PackageScope::All => PackageListScope::All,
        };
        let packages = session
            .list_packages(Some(scope))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&packages)
    }

    #[tool(
        name = "launch_app",
        description = "Launch an app by package name on a device. Get package_name from list_packages. Requires confirm: true.",
        annotations(read_only_hint = false)
    )]
    async fn launch_app(
        &self,
        Parameters(LaunchAppParams {
            serial,
            package_name,
            confirm,
        }): Parameters<LaunchAppParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "launch_app")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let activity = session
            .open_package(package_name)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "launchedActivity": activity }))
    }

    #[tool(
        name = "take_screenshot",
        description = "Capture a screenshot of the device screen. By default writes a PNG to a temp file and returns its path (read the file directly). Pass inline: true to instead get a base64-encoded PNG in the result — only do this if you can't read a local file path, since it's much larger. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn take_screenshot(
        &self,
        Parameters(ScreenshotParams { serial, inline }): Parameters<ScreenshotParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let png_base64 = adb_mirror_screenshot(serial)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        if inline {
            return ok_json(&serde_json::json!({ "pngBase64": png_base64 }));
        }
        let (path, size_bytes) = write_png_to_temp_file(&png_base64)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({
            "path": path.display().to_string(),
            "sizeBytes": size_bytes,
        }))
    }

    #[tool(
        name = "get_screen_size",
        description = "Get the device's physical screen size in pixels, for computing tap/swipe coordinates. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn get_screen_size(
        &self,
        Parameters(GetScreenSizeParams { serial }): Parameters<GetScreenSizeParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let size = adb_mirror_get_screen_size(serial)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&size)
    }

    #[tool(
        name = "tap",
        description = "Tap the device screen at (x, y) in screen pixels. Get screen bounds from get_screen_size. Rejected with an error if (x, y) is outside the current screen bounds. Note: a tap that lands in-bounds but on empty space still reports success — the device has no way to report whether anything was actually hit, so verify the effect with take_screenshot afterward. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn tap(
        &self,
        Parameters(TapParams { serial, x, y, confirm }): Parameters<TapParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "tap")?;
        let size = adb_mirror_get_screen_size(serial.clone())
            .map_err(|error| ErrorData::internal_error(error, None))?;
        device_control::validate_point(x, y, size.width, size.height)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::tap_command(x, y))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "swipe",
        description = "Swipe the device screen from (x1, y1) to (x2, y2) over duration_ms (default 300). Both endpoints are rejected with an error if outside the current screen bounds (get bounds from get_screen_size). Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn swipe(
        &self,
        Parameters(SwipeParams {
            serial,
            x1,
            y1,
            x2,
            y2,
            duration_ms,
            confirm,
        }): Parameters<SwipeParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "swipe")?;
        let size = adb_mirror_get_screen_size(serial.clone())
            .map_err(|error| ErrorData::internal_error(error, None))?;
        device_control::validate_point(x1, y1, size.width, size.height)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        device_control::validate_point(x2, y2, size.width, size.height)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::swipe_command(
                x1,
                y1,
                x2,
                y2,
                duration_ms.unwrap_or(300),
            ))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "input_text",
        description = "Type text into the currently focused field on the device. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn input_text(
        &self,
        Parameters(InputTextParams { serial, text, confirm }): Parameters<InputTextParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "input_text")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::input_text_command(&text))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "press_key",
        description = "Send an Android KeyEvent code to the device (3=HOME, 4=BACK, 66=ENTER, 67=DEL, 82=MENU, 187=APP_SWITCH, 26=POWER, 24/25=VOLUME_UP/DOWN). Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn press_key(
        &self,
        Parameters(PressKeyParams {
            serial,
            keycode,
            confirm,
        }): Parameters<PressKeyParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "press_key")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::keyevent_command(keycode))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "shell_command",
        description = "Run an arbitrary command on the device via `adb shell`. High risk: this executes verbatim on the connected device with no restrictions — review the command carefully. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true, open_world_hint = true)
    )]
    async fn shell_command(
        &self,
        Parameters(ShellCommandParams {
            serial,
            command,
            confirm,
        }): Parameters<ShellCommandParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "shell_command")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let output = session
            .shell_command(command)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "output": output }))
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
                "CapuBridge exposes a live Android WebView debugging session and device control. \
                 Call get_active_session first to see the active device and tracker status, \
                 then list_devices / list_targets to explore, and select_device to change the \
                 active device. Read-only tools (read_storage, read_console, read_network, \
                 list_packages, take_screenshot, get_screen_size) are safe to call freely; \
                 read_console/read_network start capturing on first call for a target, so call \
                 again after a moment to see accumulated data. evaluate_js, launch_app, tap, \
                 swipe, input_text, press_key, and shell_command all act on a real device and \
                 require confirm: true. shell_command runs an arbitrary command verbatim — \
                 prefer the specific tools (tap/swipe/input_text/press_key/launch_app) when they \
                 cover what's needed, and review the command carefully before confirming.",
            )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tools() -> CapuBridgeTools {
        CapuBridgeTools::new(Arc::new(SessionRegistry::new()), CaptureRegistry::new())
    }

    #[test]
    fn write_png_to_temp_file_decodes_and_writes_the_real_bytes() {
        let png_bytes: &[u8] = b"\x89PNG\r\n\x1a\nnot a real png but bytes are bytes";
        let encoded = general_purpose::STANDARD.encode(png_bytes);
        let (path, size_bytes) = write_png_to_temp_file(&encoded).expect("write should succeed");
        assert_eq!(size_bytes, png_bytes.len());
        let on_disk = std::fs::read(&path).expect("file should exist");
        assert_eq!(on_disk, png_bytes);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn write_png_to_temp_file_rejects_invalid_base64() {
        assert!(write_png_to_temp_file("not-base64!!!").is_err());
    }

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
    async fn list_packages_unknown_device_errors() {
        let result = tools()
            .list_packages(Parameters(ListPackagesParams {
                serial: "does-not-exist".into(),
                scope: PackageScope::ThirdParty,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn launch_app_without_confirm_is_rejected_before_touching_the_device() {
        let result = tools()
            .launch_app(Parameters(LaunchAppParams {
                serial: "does-not-exist".into(),
                package_name: "com.example.app".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn launch_app_with_confirm_but_unknown_device_errors() {
        let result = tools()
            .launch_app(Parameters(LaunchAppParams {
                serial: "does-not-exist".into(),
                package_name: "com.example.app".into(),
                confirm: true,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn tap_without_confirm_is_rejected() {
        let result = tools()
            .tap(Parameters(TapParams {
                serial: "does-not-exist".into(),
                x: 0,
                y: 0,
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn tap_with_confirm_but_unknown_device_errors() {
        // Proves the new get_screen_size-based bounds check doesn't change
        // the outcome for an unreachable device — it still errors cleanly
        // rather than panicking or hanging.
        let result = tools()
            .tap(Parameters(TapParams {
                serial: "does-not-exist".into(),
                x: 0,
                y: 0,
                confirm: true,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn swipe_without_confirm_is_rejected() {
        let result = tools()
            .swipe(Parameters(SwipeParams {
                serial: "does-not-exist".into(),
                x1: 0,
                y1: 0,
                x2: 1,
                y2: 1,
                duration_ms: None,
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn swipe_with_confirm_but_unknown_device_errors() {
        let result = tools()
            .swipe(Parameters(SwipeParams {
                serial: "does-not-exist".into(),
                x1: 0,
                y1: 0,
                x2: 1,
                y2: 1,
                duration_ms: None,
                confirm: true,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn input_text_without_confirm_is_rejected() {
        let result = tools()
            .input_text(Parameters(InputTextParams {
                serial: "does-not-exist".into(),
                text: "hello".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn press_key_without_confirm_is_rejected() {
        let result = tools()
            .press_key(Parameters(PressKeyParams {
                serial: "does-not-exist".into(),
                keycode: 4,
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn shell_command_without_confirm_is_rejected() {
        let result = tools()
            .shell_command(Parameters(ShellCommandParams {
                serial: "does-not-exist".into(),
                command: "echo hi".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn take_screenshot_unknown_device_errors() {
        let result = tools()
            .take_screenshot(Parameters(ScreenshotParams {
                serial: "does-not-exist".into(),
                inline: false,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn get_screen_size_unknown_device_errors() {
        let result = tools()
            .get_screen_size(Parameters(GetScreenSizeParams {
                serial: "does-not-exist".into(),
            }))
            .await;
        assert!(result.is_err());
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
    async fn read_console_unknown_target_errors() {
        let result = tools()
            .read_console(Parameters(TargetParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
            }))
            .await;
        let error = result.expect_err("unknown target must error");
        assert!(error.message.contains("no-such-target"));
    }

    #[tokio::test]
    async fn read_network_unknown_target_errors() {
        let result = tools()
            .read_network(Parameters(TargetParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
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
