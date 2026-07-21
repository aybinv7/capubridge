//! The MCP tool surface.
//!
//! Every tool holds an `Arc<SessionRegistry>` and calls the exact same registry
//! / session methods the `#[tauri::command]` wrappers call — there is no
//! duplicated device logic here. Split into per-category submodules
//! (`session`, `web`, `device`) once the flat file crossed the repo's 800-line
//! source-size gate; each owns its own `#[tool_router]` and they combine here
//! via `ToolRouter`'s `Add` impl.

mod device;
mod session;
mod web;

use std::sync::Arc;

use base64::{engine::general_purpose, Engine as _};
use rmcp::model::{CallToolResult, ContentBlock, Implementation, ServerCapabilities, ServerInfo};
use rmcp::{tool_handler, ErrorData, ServerHandler};
use serde::Serialize;

use super::capture::CaptureRegistry;
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

/// If a capture session was *just* created (`is_new`), give its background
/// loop a brief window (up to ~500ms, polled every 50ms) to connect and
/// receive its first events, so the very first `read_console`/`read_network`
/// call for a target has a real chance of returning something instead of a
/// guaranteed-empty snapshot. No-op when the session already existed — an
/// empty result there is a legitimate "nothing new since last time".
async fn warm_up_new_capture_session(is_new: bool, mut has_data: impl FnMut() -> bool) {
    if !is_new {
        return;
    }
    for _ in 0..10 {
        if has_data() {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
}

/// MCP tool handler bound to the live session registry and the (in-memory,
/// per-server-lifetime) CDP capture registry backing `read_console`/`read_network`.
#[derive(Clone)]
pub struct CapuBridgeTools {
    registry: Arc<SessionRegistry>,
    captures: Arc<CaptureRegistry>,
    tool_router: rmcp::handler::server::tool::ToolRouter<Self>,
}

impl CapuBridgeTools {
    pub fn new(registry: Arc<SessionRegistry>, captures: Arc<CaptureRegistry>) -> Self {
        Self {
            registry,
            captures,
            tool_router: Self::session_tool_router()
                + Self::web_tool_router()
                + Self::device_tool_router(),
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
                 again after a moment to see accumulated data. evaluate_js, click_element, \
                 launch_app, tap, swipe, input_text, press_key, and shell_command all act on a \
                 real device and require confirm: true. For clicking a specific button/link/nav \
                 item inside a WebView, prefer click_element (CSS selector and/or visible text) \
                 over tap: it targets the DOM element directly and reports found: false instead \
                 of silently missing, whereas a physical tap at the wrong screen coordinate \
                 reports success even when it hit nothing. shell_command runs an arbitrary \
                 command verbatim — prefer the specific tools \
                 (tap/swipe/input_text/press_key/launch_app) when they cover what's needed, and \
                 review the command carefully before confirming.\n\n\
                 Two things that will otherwise cost you a debugging cycle: (1) evaluate_js, \
                 click_element, read_storage, read_console, and read_network all require the \
                 target's app to be in the FOREGROUND — Android can freeze a backgrounded app's \
                 entire process, which hangs/times out any CDP call to it. Use launch_app to \
                 bring a target forward before querying it, and re-call list_targets after \
                 switching apps since targets can go stale. There is no reliable automatic \
                 fix for this from here (the only override is a device-wide adb setting plus a \
                 reboot), so plan around it: switch, wait, query, switch back — don't try to \
                 query two backgrounded apps at once. (2) read_storage covers localStorage, \
                 sessionStorage, and IndexedDB, but NOT a Capacitor app's own SQLite database. \
                 For that, use evaluate_js with \
                 window.Capacitor.Plugins.CapacitorSQLite.query({ database, statement, values }) \
                 — the database must be the plugin's LOGICAL name (e.g. 'presalio'), not the \
                 on-disk filename (e.g. 'presalioSQLite.db'); the wrong name silently returns \
                 empty results instead of erroring.",
            )
    }
}

#[cfg(test)]
mod fixture {
    use std::sync::Arc;

    use super::CapuBridgeTools;
    use crate::mcp::capture::CaptureRegistry;
    use crate::session::registry::SessionRegistry;

    /// Shared test fixture used by every submodule's test suite.
    pub fn tools() -> CapuBridgeTools {
        CapuBridgeTools::new(Arc::new(SessionRegistry::new()), CaptureRegistry::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    async fn warm_up_is_a_no_op_when_the_session_was_not_just_created() {
        let mut calls = 0;
        warm_up_new_capture_session(false, || {
            calls += 1;
            false
        })
        .await;
        assert_eq!(calls, 0, "must not poll when is_new is false");
    }

    #[tokio::test]
    async fn warm_up_stops_as_soon_as_data_appears() {
        let mut calls = 0;
        warm_up_new_capture_session(true, || {
            calls += 1;
            calls >= 3
        })
        .await;
        assert_eq!(calls, 3, "must stop polling on the first call that reports data");
    }

    #[tokio::test]
    async fn warm_up_gives_up_after_ten_attempts() {
        let mut calls = 0;
        warm_up_new_capture_session(true, || {
            calls += 1;
            false
        })
        .await;
        assert_eq!(calls, 10, "must not poll forever when data never appears");
    }
}
