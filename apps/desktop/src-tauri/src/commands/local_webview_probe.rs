use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

const PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const MARKER_GLOBAL: &str = "__capubridgePreviewLabel";

/// Script that stamps a preview page with its webview label, so DevTools can tell it apart from
/// another page that shows the same URL (Capubridge's own window, when it previews its dev server).
pub(crate) fn preview_marker_script(label: &str) -> Result<String, String> {
    let serialized = serde_json::to_string(label).map_err(|e| e.to_string())?;
    Ok(format!("window.{MARKER_GLOBAL} = {serialized};"))
}

async fn read_marker(web_socket_url: &str) -> Option<String> {
    let (mut socket, _) = tokio::time::timeout(PROBE_TIMEOUT, connect_async(web_socket_url))
        .await
        .ok()?
        .ok()?;
    let request = serde_json::json!({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {
            "expression": format!("String(window.{MARKER_GLOBAL} || '')"),
            "returnByValue": true
        }
    });
    socket
        .send(Message::Text(request.to_string().into()))
        .await
        .ok()?;
    let reply = tokio::time::timeout(PROBE_TIMEOUT, async {
        while let Some(Ok(message)) = socket.next().await {
            let Message::Text(text) = message else {
                continue;
            };
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
                continue;
            };
            if value["id"] == 1 {
                return value["result"]["result"]["value"]
                    .as_str()
                    .map(str::to_string);
            }
        }
        None
    })
    .await
    .ok()
    .flatten();
    let _ = socket.close(None).await;
    reply
}

/// Among pages that all show the preview's URL, the one stamped with this preview's label.
pub(crate) async fn pick_marked_page(
    candidates: Vec<serde_json::Value>,
    label: &str,
) -> Option<serde_json::Value> {
    for candidate in candidates {
        let Some(web_socket_url) = candidate["webSocketDebuggerUrl"].as_str() else {
            continue;
        };
        if read_marker(web_socket_url).await.as_deref() == Some(label) {
            return Some(candidate);
        }
    }
    None
}
