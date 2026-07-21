//! Minimal one-shot CDP client for the MCP tools that need to talk to a
//! WebView target directly (e.g. `evaluate_js`).
//!
//! Opens a fresh WebSocket per call, sends one command, waits for the
//! matching response, then closes. This mirrors the connect pattern already
//! used in `commands::chrome` and strips the same headers `commands::cdp_proxy`
//! strips — Android CDP endpoints 403 on a browser `Origin`.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::Value;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

const CALL_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_ID: u32 = 1;

#[derive(Debug, Deserialize)]
struct CdpResponseEnvelope {
    id: Option<u32>,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<CdpErrorPayload>,
}

#[derive(Debug, Deserialize)]
struct CdpErrorPayload {
    message: String,
}

/// Open a one-shot CDP connection to `ws_url`, send `method`/`params`, and
/// return the `result` field of the matching response.
pub async fn call(ws_url: &str, method: &str, params: Value) -> Result<Value, String> {
    let mut request = ws_url
        .into_client_request()
        .map_err(|error| format!("Invalid CDP target URL: {error}"))?;
    for header in ["Origin", "Sec-Fetch-Mode", "Sec-Fetch-Dest", "Sec-Fetch-Site"] {
        request.headers_mut().remove(header);
    }

    let (mut socket, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|error| format!("Failed to connect to CDP target: {error}"))?;

    let payload = serde_json::json!({ "id": REQUEST_ID, "method": method, "params": params });
    socket
        .send(Message::Text(payload.to_string().into()))
        .await
        .map_err(|error| format!("Failed to send CDP command: {error}"))?;

    let outcome = tokio::time::timeout(CALL_TIMEOUT, receive_matching_response(&mut socket))
        .await
        .map_err(|_| "Timed out waiting for a CDP response".to_string())?;

    let _ = socket.close(None).await;
    outcome
}

async fn receive_matching_response<S>(socket: &mut S) -> Result<Value, String>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
        + Unpin,
{
    while let Some(message) = socket.next().await {
        let message = message.map_err(|error| format!("CDP transport error: {error}"))?;
        let text = match message {
            Message::Text(text) => text.to_string(),
            Message::Binary(bytes) => String::from_utf8(bytes.to_vec())
                .map_err(|error| format!("Invalid utf8 CDP frame: {error}"))?,
            _ => continue,
        };
        let Ok(envelope) = serde_json::from_str::<CdpResponseEnvelope>(&text) else {
            continue;
        };
        if envelope.id != Some(REQUEST_ID) {
            continue;
        }
        if let Some(error) = envelope.error {
            return Err(format!("CDP error: {}", error.message));
        }
        return Ok(envelope.result.unwrap_or(Value::Null));
    }
    Err("CDP connection closed before a response arrived".to_string())
}

/// Evaluate `expression` in the page context of the target at `ws_url`.
/// Returns the raw `Runtime.evaluate` result envelope (`{ result, exceptionDetails? }`);
/// pass it through [`evaluate_value`] to get the plain JS return value.
pub async fn evaluate(ws_url: &str, expression: &str) -> Result<Value, String> {
    call(
        ws_url,
        "Runtime.evaluate",
        serde_json::json!({
            "expression": expression,
            "returnByValue": true,
            "awaitPromise": true,
        }),
    )
    .await
}

/// Extract the plain JS value from a `Runtime.evaluate` result envelope, or an
/// error message if the expression threw.
pub fn evaluate_value(response: &Value) -> Result<Value, String> {
    if let Some(exception) = response.get("exceptionDetails") {
        let message = exception
            .get("exception")
            .and_then(|value| value.get("description").or_else(|| value.get("value")))
            .and_then(|value| value.as_str())
            .map(str::to_string)
            .or_else(|| {
                exception
                    .get("text")
                    .and_then(|value| value.as_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| "JavaScript evaluation failed".to_string());
        return Err(message);
    }
    Ok(response
        .get("result")
        .and_then(|result| result.get("value"))
        .cloned()
        .unwrap_or(Value::Null))
}

fn js_string_literal(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}

/// Expression that collects every key/value pair from `localStorage`.
pub fn local_storage_script() -> &'static str {
    "(() => { const out = {}; for (let i = 0; i < localStorage.length; i++) { \
     const k = localStorage.key(i); out[k] = localStorage.getItem(k); } return out; })()"
}

/// Expression that collects every key/value pair from `sessionStorage`.
pub fn session_storage_script() -> &'static str {
    "(() => { const out = {}; for (let i = 0; i < sessionStorage.length; i++) { \
     const k = sessionStorage.key(i); out[k] = sessionStorage.getItem(k); } return out; })()"
}

/// Expression that lists IndexedDB databases visible to the page.
pub fn indexeddb_databases_script() -> &'static str {
    "(async () => { \
        if (!indexedDB.databases) { \
            throw new Error('indexedDB.databases() is not supported in this WebView'); \
        } \
        const dbs = await indexedDB.databases(); \
        return dbs.map((db) => ({ name: db.name, version: db.version })); \
    })()"
}

/// Expression that reads up to `limit` rows (after skipping `offset`) from one
/// object store of one IndexedDB database, via a cursor so nothing is loaded
/// beyond what's asked for.
pub fn indexeddb_store_script(database: &str, store: &str, limit: u32, offset: u32) -> String {
    let database = js_string_literal(database);
    let store = js_string_literal(store);
    format!(
        "new Promise((resolve, reject) => {{ \
            const req = indexedDB.open({database}); \
            req.onerror = () => reject((req.error && req.error.message) || 'failed to open database'); \
            req.onsuccess = () => {{ \
                const db = req.result; \
                if (!db.objectStoreNames.contains({store})) {{ \
                    const available = Array.from(db.objectStoreNames).join(', '); \
                    db.close(); \
                    reject('Unknown object store: ' + {store} + '. Available stores: ' + available); \
                    return; \
                }} \
                const tx = db.transaction({store}, 'readonly'); \
                const objectStore = tx.objectStore({store}); \
                const rows = []; \
                let skipped = 0; \
                const cursorReq = objectStore.openCursor(); \
                cursorReq.onerror = () => reject((cursorReq.error && cursorReq.error.message) || 'cursor failed'); \
                cursorReq.onsuccess = (event) => {{ \
                    const cursor = event.target.result; \
                    if (!cursor || rows.length >= {limit}) {{ \
                        db.close(); \
                        resolve({{ rows, truncated: !!cursor }}); \
                        return; \
                    }} \
                    if (skipped < {offset}) {{ skipped++; cursor.continue(); return; }} \
                    rows.push(cursor.value); \
                    cursor.continue(); \
                }}; \
            }}; \
        }})"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;

    /// Bind an ephemeral localhost WebSocket server that accepts one CDP
    /// connection, echoes `response_body` back with the request's `id`
    /// spliced in, and returns its `ws://` URL.
    async fn spawn_mock_cdp_server(response_body: Value) -> String {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.expect("bind");
        let port = listener.local_addr().expect("local_addr").port();

        tokio::spawn(async move {
            let Ok((stream, _)) = listener.accept().await else {
                return;
            };
            let Ok(mut socket) = accept_async(stream).await else {
                return;
            };
            if let Some(Ok(Message::Text(text))) = socket.next().await {
                let request: Value = serde_json::from_str(&text).expect("valid json request");
                let mut response = response_body.clone();
                response["id"] = request["id"].clone();
                let _ = socket.send(Message::Text(response.to_string().into())).await;
            }
        });

        format!("ws://127.0.0.1:{port}/")
    }

    #[tokio::test]
    async fn call_returns_the_result_field_on_success() {
        let url = spawn_mock_cdp_server(serde_json::json!({ "result": { "value": 42 } })).await;
        let result = call(&url, "Runtime.evaluate", serde_json::json!({}))
            .await
            .expect("call should succeed");
        assert_eq!(result, serde_json::json!({ "value": 42 }));
    }

    #[tokio::test]
    async fn call_surfaces_a_cdp_level_error() {
        let url = spawn_mock_cdp_server(serde_json::json!({ "error": { "message": "boom" } })).await;
        let error = call(&url, "Runtime.evaluate", serde_json::json!({}))
            .await
            .expect_err("call should fail");
        assert!(error.contains("boom"));
    }

    #[tokio::test]
    async fn evaluate_returns_the_raw_envelope_for_evaluate_value_to_parse() {
        // Real Runtime.evaluate responses double-nest: the JSON-RPC "result"
        // field holds `{ result: RemoteObject, exceptionDetails? }`.
        let url = spawn_mock_cdp_server(serde_json::json!({
            "result": { "result": { "type": "number", "value": 7 } }
        }))
        .await;
        let envelope = evaluate(&url, "1+6").await.expect("evaluate should succeed");
        assert_eq!(evaluate_value(&envelope).expect("value"), serde_json::json!(7));
    }

    #[test]
    fn evaluate_value_extracts_return_by_value_result() {
        let response = serde_json::json!({ "result": { "type": "object", "value": { "a": 1 } } });
        assert_eq!(evaluate_value(&response).unwrap(), serde_json::json!({ "a": 1 }));
    }

    #[test]
    fn evaluate_value_surfaces_a_thrown_exception() {
        let response = serde_json::json!({
            "exceptionDetails": {
                "text": "Uncaught",
                "exception": { "description": "ReferenceError: x is not defined" }
            }
        });
        let error = evaluate_value(&response).unwrap_err();
        assert!(error.contains("ReferenceError"));
    }

    #[test]
    fn indexeddb_store_script_escapes_names_safely() {
        let script = indexeddb_store_script("my\"db", "store's", 50, 10);
        // The generated script must be valid embeddable JS: names go through
        // JSON string escaping, not raw interpolation.
        assert!(script.contains("\\\"db"));
        assert!(script.contains("store's"));
        assert!(script.contains("50"));
        assert!(script.contains("10"));
        let _: Value = serde_json::json!(script); // sanity: it's a valid string at least
    }
}
