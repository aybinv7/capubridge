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
use parking_lot::{Mutex, RwLock};
use serde::Serialize;
use serde_json::Value;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;
use tokio_util::sync::CancellationToken;

use super::cdp;

const MAX_CONSOLE_ENTRIES: usize = 200;
const MAX_NETWORK_ENTRIES: usize = 200;
const MAX_CONSOLE_BYTES: usize = 256 * 1024;
const MAX_NETWORK_BYTES: usize = 512 * 1024;
const MAX_FIELD_BYTES: usize = 64 * 1024;

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSnapshot<T> {
    pub entries: Vec<T>,
    pub truncated: bool,
    pub retained_bytes: usize,
}

#[derive(Debug, Default)]
struct CaptureState {
    console: VecDeque<ConsoleEntry>,
    network: VecDeque<NetworkEntry>,
    console_bytes: usize,
    network_bytes: usize,
    console_truncated: bool,
    network_truncated: bool,
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

    pub fn console_capture(&self) -> CaptureSnapshot<ConsoleEntry> {
        let state = self.state.read();
        CaptureSnapshot {
            entries: state.console.iter().cloned().collect(),
            truncated: state.console_truncated,
            retained_bytes: state.console_bytes,
        }
    }

    pub fn network_capture(&self) -> CaptureSnapshot<NetworkEntry> {
        let state = self.state.read();
        CaptureSnapshot {
            entries: state.network.iter().cloned().collect(),
            truncated: state.network_truncated,
            retained_bytes: state.network_bytes,
        }
    }

    fn push_console(&self, mut entry: ConsoleEntry) {
        let (text, field_truncated) = truncate_utf8(&entry.text, MAX_FIELD_BYTES);
        entry.text = text;
        let mut state = self.state.write();
        state.console_truncated |= field_truncated;
        state.console_bytes += serialized_size(&entry);
        state.console.push_back(entry);
        while state.console.len() > MAX_CONSOLE_ENTRIES || state.console_bytes > MAX_CONSOLE_BYTES {
            if let Some(removed) = state.console.pop_front() {
                state.console_bytes = state.console_bytes.saturating_sub(serialized_size(&removed));
                state.console_truncated = true;
            }
        }
    }

    fn upsert_network(&self, request_id: &str, mutate: impl FnOnce(&mut NetworkEntry)) {
        let mut state = self.state.write();
        if let Some(existing) = state.network.iter_mut().find(|e| e.request_id == request_id) {
            mutate(existing);
            let mut truncated = false;
            bound_network_entry(existing, &mut truncated);
            state.network_truncated |= truncated;
        } else {
            let (request_id, truncated) = truncate_utf8(request_id, MAX_FIELD_BYTES);
            let mut entry = NetworkEntry {
                request_id,
                ..Default::default()
            };
            mutate(&mut entry);
            state.network_truncated |= truncated;
            let mut field_truncated = false;
            bound_network_entry(&mut entry, &mut field_truncated);
            state.network_truncated |= field_truncated;
            state.network.push_back(entry);
        }
        state.network_bytes = state.network.iter().map(serialized_size).sum();
        while state.network.len() > MAX_NETWORK_ENTRIES || state.network_bytes > MAX_NETWORK_BYTES {
            if let Some(removed) = state.network.pop_front() {
                state.network_bytes = state.network_bytes.saturating_sub(serialized_size(&removed));
                state.network_truncated = true;
            }
        }
    }
}

fn serialized_size<T: Serialize>(value: &T) -> usize {
    serde_json::to_vec(value).map_or(0, |bytes| bytes.len())
}

fn truncate_utf8(value: &str, max_bytes: usize) -> (String, bool) {
    if value.len() <= max_bytes {
        return (value.to_string(), false);
    }
    let mut end = max_bytes;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    (value[..end].to_string(), true)
}

fn bound_network_entry(entry: &mut NetworkEntry, truncated: &mut bool) {
    for field in [&mut entry.url, &mut entry.method, &mut entry.failed] {
        if let Some(value) = field {
            let (bounded, was_truncated) = truncate_utf8(value, MAX_FIELD_BYTES);
            *value = bounded;
            *truncated |= was_truncated;
        }
    }
}

/// Owns capture sessions and their cancellable background tasks.
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct CaptureKey {
    serial: String,
    target_id: String,
    generation: String,
}

struct CaptureHandle {
    session: Arc<CaptureSession>,
    cancel: CancellationToken,
    task: JoinHandle<()>,
}

pub struct CaptureRegistry {
    sessions: Mutex<HashMap<CaptureKey, CaptureHandle>>,
}

impl Default for CaptureRegistry {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
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
    pub async fn ensure(
        &self,
        serial: &str,
        target_id: &str,
        ws_url: &str,
    ) -> (Arc<CaptureSession>, bool) {
        let key = CaptureKey {
            serial: serial.to_string(),
            target_id: target_id.to_string(),
            generation: ws_url.to_string(),
        };
        let mut sessions = self.sessions.lock();
        if let Some(handle) = sessions.get(&key) {
            if handle.session.is_alive() {
                return (handle.session.clone(), false);
            }
        }
        let stale_keys = sessions
            .keys()
            .filter(|existing| existing.serial == serial && existing.target_id == target_id)
            .cloned()
            .collect::<Vec<_>>();
        let stale = stale_keys
            .into_iter()
            .filter_map(|stale_key| sessions.remove(&stale_key))
            .collect::<Vec<_>>();
        let session = CaptureSession::new();
        let cancel = CancellationToken::new();
        let task = tokio::spawn(run_capture_loop(
            session.clone(),
            ws_url.to_string(),
            cancel.clone(),
        ));
        sessions.insert(
            key,
            CaptureHandle {
                session: session.clone(),
                cancel,
                task,
            },
        );
        drop(sessions);
        for handle in stale {
            handle.cancel.cancel();
            let _ = handle.task.await;
        }
        (session, true)
    }

    pub async fn shutdown(&self) {
        let handles = self
            .sessions
            .lock()
            .drain()
            .map(|(_, handle)| handle)
            .collect::<Vec<_>>();
        for handle in &handles {
            handle.cancel.cancel();
        }
        for handle in handles {
            let _ = handle.task.await;
        }
    }
}

async fn run_capture_loop(
    session: Arc<CaptureSession>,
    ws_url: String,
    cancel: CancellationToken,
) {
    let mut socket = tokio::select! {
        _ = cancel.cancelled() => {
            session.mark_dead();
            return;
        }
        result = cdp::connect(&ws_url) => match result {
            Ok(socket) => socket,
            Err(error) => {
                log::warn!("[mcp] capture connection failed: {error}");
                session.mark_dead();
                return;
            }
        }
    };

    for (id, method) in [(1u32, "Log.enable"), (2, "Runtime.enable"), (3, "Network.enable")] {
        let payload = serde_json::json!({ "id": id, "method": method, "params": {} });
        tokio::select! {
            _ = cancel.cancelled() => {
                session.mark_dead();
                return;
            }
            result = socket.send(Message::Text(payload.to_string().into())) => {
                if result.is_err() {
                    session.mark_dead();
                    return;
                }
            }
        }
    }

    loop {
        let message = tokio::select! {
            _ = cancel.cancelled() => break,
            message = socket.next() => message,
        };
        let Some(message) = message else { break };
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
    fn console_capture_reports_byte_truncation() {
        let session = CaptureSession::new();
        session.push_console(ConsoleEntry {
            level: "log".to_string(),
            text: "x".repeat(MAX_FIELD_BYTES + 1),
            timestamp: 0.0,
        });
        let capture = session.console_capture();
        assert!(capture.truncated);
        assert!(capture.entries[0].text.len() <= MAX_FIELD_BYTES);
        assert!(capture.retained_bytes <= MAX_CONSOLE_BYTES);
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
        let (session, is_new) = registry.ensure("serial-1", "target-1", &url).await;
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
        let (first, first_is_new) = registry
            .ensure("serial-1", "target-1", "ws://127.0.0.1:1/")
            .await;
        let (second, second_is_new) = registry
            .ensure("serial-1", "target-1", "ws://127.0.0.1:1/")
            .await;
        assert!(Arc::ptr_eq(&first, &second));
        assert!(first_is_new);
        assert!(!second_is_new, "reusing an alive session must report is_new: false");
        registry.shutdown().await;
    }
}
