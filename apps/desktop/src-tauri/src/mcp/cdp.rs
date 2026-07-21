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
