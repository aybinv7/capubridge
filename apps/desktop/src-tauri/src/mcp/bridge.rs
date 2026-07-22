//! Request/response bridge from the MCP server (Rust) to the running Vue
//! frontend.
//!
//! Some MCP tools must drive things only the frontend owns — selecting and
//! connecting a CDP target, starting the frontend-orchestrated recording
//! pipeline. Those can't be done from Rust directly, so the tool emits a
//! `mcp://bridge/request` Tauri event carrying a `requestId`, and the frontend
//! (see `useMcpBridge`) does the work and calls back the `mcp_bridge_respond`
//! command with that `requestId`. This module correlates the two halves via a
//! per-request oneshot channel, so the awaiting tool gets the frontend's
//! actual result (or a timeout if no window is listening).

use std::collections::HashMap;
use std::time::Duration;

use parking_lot::Mutex;
use serde::Serialize;
use serde_json::Value;
use tauri::{Emitter, Manager, State};
use tokio::sync::oneshot;

/// How long a tool waits for the frontend to answer before assuming no window
/// is available to service the request.
pub const BRIDGE_TIMEOUT: Duration = Duration::from_secs(15);

/// The frontend's answer to a bridge request.
#[derive(Debug)]
pub struct BridgeResponse {
    pub ok: bool,
    pub result: Value,
    pub error: Option<String>,
}

/// Correlates in-flight bridge requests with the frontend's responses.
#[derive(Default)]
pub struct FrontendBridge {
    pending: Mutex<HashMap<String, oneshot::Sender<BridgeResponse>>>,
}

impl FrontendBridge {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a request id and get the receiver to await the response on.
    pub fn register(&self, request_id: String) -> oneshot::Receiver<BridgeResponse> {
        let (tx, rx) = oneshot::channel();
        self.pending.lock().insert(request_id, tx);
        rx
    }

    /// Drop a registered request (e.g. after a timeout) so the map doesn't leak.
    pub fn cancel(&self, request_id: &str) {
        self.pending.lock().remove(request_id);
    }

    /// Deliver the frontend's response to whoever is awaiting `request_id`.
    fn resolve(&self, request_id: &str, response: BridgeResponse) {
        if let Some(tx) = self.pending.lock().remove(request_id) {
            let _ = tx.send(response);
        }
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct BridgeRequestEvent {
    request_id: String,
    action: String,
    payload: Value,
}

/// Bring the CapuBridge window to the foreground (show + unminimize + focus).
///
/// Bridge actions run in the frontend WebView, which the OS can suspend while
/// the window is hidden or minimized — so a bridge request to a
/// backgrounded window would just time out. Every bridge call surfaces the
/// window first so the frontend is live to service it. Best-effort: any step
/// failing is logged, not fatal (the request still goes out).
fn bring_window_to_front(app: &tauri::AppHandle) {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next());
    let Some(window) = window else {
        log::warn!("[mcp] no app window to bring to front for a bridge request");
        return;
    };
    let _ = window.unminimize();
    if let Err(error) = window.show() {
        log::warn!("[mcp] failed to show app window: {error}");
    }
    if let Err(error) = window.set_focus() {
        log::warn!("[mcp] failed to focus app window: {error}");
    }
}

/// Emit a bridge request to the frontend and await its response, with a
/// timeout that maps a silent (no-window) frontend to a clear error.
pub async fn call(
    app: &tauri::AppHandle,
    action: &str,
    payload: Value,
) -> Result<Value, String> {
    // Surface the window so its WebView is active to handle the request.
    bring_window_to_front(app);

    let bridge = app.state::<FrontendBridge>();
    let request_id = uuid::Uuid::new_v4().simple().to_string();
    let rx = bridge.register(request_id.clone());

    app.emit(
        "mcp://bridge/request",
        BridgeRequestEvent {
            request_id: request_id.clone(),
            action: action.to_string(),
            payload,
        },
    )
    .map_err(|error| format!("Failed to reach the app window: {error}"))?;

    match tokio::time::timeout(BRIDGE_TIMEOUT, rx).await {
        Ok(Ok(response)) if response.ok => Ok(response.result),
        Ok(Ok(response)) => Err(response
            .error
            .unwrap_or_else(|| "The app reported an unspecified error".to_string())),
        Ok(Err(_)) => Err("The app closed the request before responding".to_string()),
        Err(_) => {
            bridge.cancel(&request_id);
            Err("The CapuBridge app window did not respond in time — make sure the app is open \
                 and (for target/recording actions) connected to a target in the UI."
                .to_string())
        }
    }
}

/// Frontend → Rust callback that completes a pending bridge request.
#[tauri::command]
pub fn mcp_bridge_respond(
    bridge: State<'_, FrontendBridge>,
    request_id: String,
    ok: bool,
    #[allow(clippy::used_underscore_binding)] result: Option<Value>,
    error: Option<String>,
) {
    bridge.resolve(
        &request_id,
        BridgeResponse {
            ok,
            result: result.unwrap_or(Value::Null),
            error,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn register_then_resolve_delivers_the_response() {
        let bridge = FrontendBridge::new();
        let rx = bridge.register("req-1".to_string());
        bridge.resolve(
            "req-1",
            BridgeResponse {
                ok: true,
                result: serde_json::json!({ "selected": "abc" }),
                error: None,
            },
        );
        let response = rx.await.expect("sender not dropped");
        assert!(response.ok);
        assert_eq!(response.result, serde_json::json!({ "selected": "abc" }));
    }

    #[tokio::test]
    async fn cancel_removes_the_pending_request() {
        let bridge = FrontendBridge::new();
        let rx = bridge.register("req-2".to_string());
        bridge.cancel("req-2");
        // Resolving after cancel is a no-op; the receiver sees the sender dropped.
        bridge.resolve(
            "req-2",
            BridgeResponse {
                ok: true,
                result: Value::Null,
                error: None,
            },
        );
        assert!(rx.await.is_err(), "cancelled request must not resolve");
    }

    #[tokio::test]
    async fn resolve_unknown_request_is_a_no_op() {
        let bridge = FrontendBridge::new();
        bridge.resolve(
            "nope",
            BridgeResponse {
                ok: true,
                result: Value::Null,
                error: None,
            },
        );
        // No panic, nothing pending.
        assert!(bridge.pending.lock().is_empty());
    }
}
