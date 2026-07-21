//! Persistent CDP capture sessions backing `read_console` / `read_network`.
//!
//! Unlike `cdp::call` (one-shot request/response), console and network data
//! arrives as unsolicited CDP *events* pushed over a long-lived connection.
//! A [`CaptureSession`] owns one such connection per target, enables the
//! `Log`/`Runtime`/`Network` domains, and buffers events into bounded ring
//! buffers that the MCP tools read from without touching the network.
//!
//! A session starts lazily on the first `read_console`/`read_network` call
//! for a target (so nothing connects until asked) and is recreated on the
//! next call after the target's connection drops — mirroring the "don't
//! auto-reconnect, let the next explicit action retry" rule already used for
//! CDP disconnects elsewhere in the app.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use parking_lot::RwLock;
use serde::Serialize;
use serde_json::Value;
use tokio_tungstenite::tungstenite::Message;

use super::cdp;

const MAX_CONSOLE_ENTRIES: usize = 200;
const MAX_NETWORK_ENTRIES: usize = 200;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleEntry {
    pub level: String,
    pub text: String,
    pub timestamp: f64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEntry {
    pub request_id: String,
    pub url: Option<String>,
    pub method: Option<String>,
    pub status: Option<i64>,
    pub failed: Option<String>,
    pub finished: bool,
}

#[derive(Debug, Default)]
struct CaptureState {
    console: VecDeque<ConsoleEntry>,
    network: VecDeque<NetworkEntry>,
    alive: bool,
}

/// A live (or recently-live) capture session for one target.
pub struct CaptureSession {
    state: RwLock<CaptureState>,
}

impl CaptureSession {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            state: RwLock::new(CaptureState {
                alive: true,
                ..Default::default()
            }),
        })
    }

    fn is_alive(&self) -> bool {
        self.state.read().alive
    }

    fn mark_dead(&self) {
        self.state.write().alive = false;
    }

    pub fn console_snapshot(&self) -> Vec<ConsoleEntry> {
        self.state.read().console.iter().cloned().collect()
    }

    pub fn network_snapshot(&self) -> Vec<NetworkEntry> {
        self.state.read().network.iter().cloned().collect()
    }

    fn push_console(&self, entry: ConsoleEntry) {
        let mut state = self.state.write();
        if state.console.len() >= MAX_CONSOLE_ENTRIES {
            state.console.pop_front();
        }
        state.console.push_back(entry);
    }

    fn upsert_network(&self, request_id: &str, mutate: impl FnOnce(&mut NetworkEntry)) {
        let mut state = self.state.write();
        if let Some(existing) = state.network.iter_mut().find(|e| e.request_id == request_id) {
            mutate(existing);
            return;
        }
        let mut entry = NetworkEntry {
            request_id: request_id.to_string(),
            ..Default::default()
        };
        mutate(&mut entry);
        if state.network.len() >= MAX_NETWORK_ENTRIES {
            state.network.pop_front();
        }
        state.network.push_back(entry);
    }
}

/// Owns one [`CaptureSession`] per target, keyed by target id.
#[derive(Default)]
pub struct CaptureRegistry {
    sessions: RwLock<HashMap<String, Arc<CaptureSession>>>,
}

impl CaptureRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Get the session for `target_id`, starting a fresh capture loop against
    /// `ws_url` if none exists yet or the previous one died.
    ///
    /// Returns `(session, is_new)` — `is_new` is `true` when this call just
    /// created the session, so the caller can decide whether to give the
    /// background loop a brief moment to connect and receive its first
    /// events before reading an otherwise-guaranteed-empty snapshot.
    pub fn ensure(&self, target_id: &str, ws_url: &str) -> (Arc<CaptureSession>, bool) {
        if let Some(session) = self.sessions.read().get(target_id) {
            if session.is_alive() {
                return (session.clone(), false);
            }
        }
        let session = CaptureSession::new();
        self.sessions
            .write()
            .insert(target_id.to_string(), session.clone());
        tokio::spawn(run_capture_loop(session.clone(), ws_url.to_string()));
        (session, true)
    }
}

async fn run_capture_loop(session: Arc<CaptureSession>, ws_url: String) {
    let mut socket = match cdp::connect(&ws_url).await {
        Ok(socket) => socket,
        Err(error) => {
            log::warn!("[mcp] capture connect failed for {ws_url}: {error}");
            session.mark_dead();
            return;
        }
    };

    for (id, method) in [(1u32, "Log.enable"), (2, "Runtime.enable"), (3, "Network.enable")] {
        let payload = serde_json::json!({ "id": id, "method": method, "params": {} });
        if socket
            .send(Message::Text(payload.to_string().into()))
            .await
            .is_err()
        {
            session.mark_dead();
            return;
        }
    }

    while let Some(message) = socket.next().await {
        let Ok(message) = message else { break };
        let text = match message {
            Message::Text(text) => text.to_string(),
            Message::Binary(bytes) => match String::from_utf8(bytes.to_vec()) {
                Ok(text) => text,
                Err(_) => continue,
            },
            _ => continue,
        };
        let Ok(envelope) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        // Frames with an "id" are acks for the enable commands above, not events.
        if envelope.get("id").is_some() {
            continue;
        }
        let Some(method) = envelope.get("method").and_then(Value::as_str) else {
            continue;
        };
        let params = envelope.get("params").cloned().unwrap_or(Value::Null);
        handle_cdp_event(&session, method, &params);
    }

    session.mark_dead();
}

/// Apply one CDP notification to `session`'s buffers. Pure aside from the
/// mutation, so it's testable without a network connection.
fn handle_cdp_event(session: &CaptureSession, method: &str, params: &Value) {
    match method {
        "Log.entryAdded" => {
            if let Some(entry) = params.get("entry") {
                session.push_console(ConsoleEntry {
                    level: entry
                        .get("level")
                        .and_then(Value::as_str)
                        .unwrap_or("log")
                        .to_string(),
                    text: entry
                        .get("text")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    timestamp: entry.get("timestamp").and_then(Value::as_f64).unwrap_or(0.0),
                });
            }
        }
        "Runtime.consoleAPICalled" => {
            let level = params
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("log")
                .to_string();
            let timestamp = params.get("timestamp").and_then(Value::as_f64).unwrap_or(0.0);
            let text = params
                .get("args")
                .and_then(Value::as_array)
                .map(|args| {
                    args.iter()
                        .map(describe_remote_object)
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .unwrap_or_default();
            session.push_console(ConsoleEntry { level, text, timestamp });
        }
        "Network.requestWillBeSent" => {
            if let Some(request_id) = params.get("requestId").and_then(Value::as_str) {
                let url = params
                    .pointer("/request/url")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let http_method = params
                    .pointer("/request/method")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                session.upsert_network(request_id, |entry| {
                    entry.url = url;
                    entry.method = http_method;
                });
            }
        }
        "Network.responseReceived" => {
            if let Some(request_id) = params.get("requestId").and_then(Value::as_str) {
                let status = params.pointer("/response/status").and_then(Value::as_i64);
                session.upsert_network(request_id, |entry| entry.status = status);
            }
        }
        "Network.loadingFinished" => {
            if let Some(request_id) = params.get("requestId").and_then(Value::as_str) {
                session.upsert_network(request_id, |entry| entry.finished = true);
            }
        }
        "Network.loadingFailed" => {
            if let Some(request_id) = params.get("requestId").and_then(Value::as_str) {
                let error_text = params
                    .get("errorText")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                session.upsert_network(request_id, |entry| {
                    entry.failed = error_text;
                    entry.finished = true;
                });
            }
        }
        _ => {}
    }
}

/// Render a `Runtime.consoleAPICalled` argument (a RemoteObject) as text.
fn describe_remote_object(value: &Value) -> String {
    match value.get("value") {
        Some(Value::String(text)) => text.clone(),
        Some(other) => other.to_string(),
        None => value
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or("undefined")
            .to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;

    #[test]
    fn log_entry_added_pushes_a_console_entry() {
        let session = CaptureSession::new();
        handle_cdp_event(
            &session,
            "Log.entryAdded",
            &serde_json::json!({ "entry": { "level": "error", "text": "boom", "timestamp": 1.5 } }),
        );
        let entries = session.console_snapshot();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].level, "error");
        assert_eq!(entries[0].text, "boom");
    }

    #[test]
    fn console_api_called_joins_string_args() {
        let session = CaptureSession::new();
        handle_cdp_event(
            &session,
            "Runtime.consoleAPICalled",
            &serde_json::json!({
                "type": "warn",
                "timestamp": 2.0,
                "args": [
                    { "type": "string", "value": "hello" },
                    { "type": "number", "value": 42 }
                ]
            }),
        );
        let entries = session.console_snapshot();
        assert_eq!(entries[0].level, "warn");
        assert_eq!(entries[0].text, "hello 42");
    }

    #[test]
    fn console_buffer_is_bounded_and_drops_oldest() {
        let session = CaptureSession::new();
        for i in 0..(MAX_CONSOLE_ENTRIES + 10) {
            handle_cdp_event(
                &session,
                "Log.entryAdded",
                &serde_json::json!({ "entry": { "level": "log", "text": i.to_string(), "timestamp": i as f64 } }),
            );
        }
        let entries = session.console_snapshot();
        assert_eq!(entries.len(), MAX_CONSOLE_ENTRIES);
        // Oldest 10 were evicted; the buffer starts at "10".
        assert_eq!(entries[0].text, "10");
    }

    #[test]
    fn network_lifecycle_updates_the_same_entry() {
        let session = CaptureSession::new();
        handle_cdp_event(
            &session,
            "Network.requestWillBeSent",
            &serde_json::json!({ "requestId": "1", "request": { "url": "https://x.test", "method": "GET" } }),
        );
        handle_cdp_event(
            &session,
            "Network.responseReceived",
            &serde_json::json!({ "requestId": "1", "response": { "status": 200 } }),
        );
        handle_cdp_event(
            &session,
            "Network.loadingFinished",
            &serde_json::json!({ "requestId": "1" }),
        );

        let entries = session.network_snapshot();
        assert_eq!(entries.len(), 1, "one request, not three separate rows");
        assert_eq!(entries[0].url.as_deref(), Some("https://x.test"));
        assert_eq!(entries[0].method.as_deref(), Some("GET"));
        assert_eq!(entries[0].status, Some(200));
        assert!(entries[0].finished);
    }

    #[test]
    fn network_failure_marks_failed_and_finished() {
        let session = CaptureSession::new();
        handle_cdp_event(
            &session,
            "Network.requestWillBeSent",
            &serde_json::json!({ "requestId": "1", "request": { "url": "https://x.test", "method": "GET" } }),
        );
        handle_cdp_event(
            &session,
            "Network.loadingFailed",
            &serde_json::json!({ "requestId": "1", "errorText": "net::ERR_FAILED" }),
        );
        let entries = session.network_snapshot();
        assert_eq!(entries[0].failed.as_deref(), Some("net::ERR_FAILED"));
        assert!(entries[0].finished);
    }

    #[test]
    fn unknown_method_is_a_no_op() {
        let session = CaptureSession::new();
        handle_cdp_event(&session, "Some.unhandledEvent", &serde_json::json!({}));
        assert!(session.console_snapshot().is_empty());
        assert!(session.network_snapshot().is_empty());
    }

    /// Bind an ephemeral localhost WebSocket server that accepts one
    /// connection and pushes `events` as unsolicited notification frames.
    async fn spawn_mock_event_server(events: Vec<Value>) -> String {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.expect("bind");
        let port = listener.local_addr().expect("local_addr").port();
        tokio::spawn(async move {
            let Ok((stream, _)) = listener.accept().await else { return };
            let Ok(mut socket) = accept_async(stream).await else { return };
            for event in events {
                if socket
                    .send(Message::Text(event.to_string().into()))
                    .await
                    .is_err()
                {
                    return;
                }
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        });
        format!("ws://127.0.0.1:{port}/")
    }

    #[tokio::test]
    async fn ensure_spawns_a_background_loop_that_populates_the_session() {
        let url = spawn_mock_event_server(vec![serde_json::json!({
            "method": "Log.entryAdded",
            "params": { "entry": { "level": "error", "text": "from the wire", "timestamp": 1.0 } }
        })])
        .await;

        let registry = CaptureRegistry::new();
        let (session, is_new) = registry.ensure("target-1", &url);
        assert!(is_new, "first ensure() for a target must report is_new");

        let mut entries = Vec::new();
        for _ in 0..50 {
            entries = session.console_snapshot();
            if !entries.is_empty() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }

        assert_eq!(entries.len(), 1, "event pushed over the wire should reach the session");
        assert_eq!(entries[0].text, "from the wire");
    }

    #[tokio::test]
    async fn ensure_reuses_the_alive_session_for_the_same_target() {
        let registry = CaptureRegistry::new();
        // A dead socket URL still lets us prove the identity behavior without
        // waiting on a network connection: two ensure() calls in the same
        // tick return the same Arc before the background loop can run.
        let (first, first_is_new) = registry.ensure("target-1", "ws://127.0.0.1:1/");
        let (second, second_is_new) = registry.ensure("target-1", "ws://127.0.0.1:1/");
        assert!(Arc::ptr_eq(&first, &second));
        assert!(first_is_new);
        assert!(!second_is_new, "reusing an alive session must report is_new: false");
    }
}
