use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::LazyLock;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio::task::{JoinHandle, JoinSet};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_util::sync::CancellationToken;

struct ProxyInfo {
    local_port: u16,
    token: String,
    cancel: CancellationToken,
    handle: JoinHandle<()>,
}

static ACTIVE_PROXIES: LazyLock<Mutex<HashMap<String, ProxyInfo>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResult {
    pub local_port: u16,
    pub ws_url: String,
}

fn proxy_result(local_port: u16, token: &str) -> ProxyResult {
    ProxyResult {
        local_port,
        ws_url: format!("ws://127.0.0.1:{local_port}/?token={token}"),
    }
}

fn validate_upstream_url(ws_url: &str) -> Result<(), String> {
    let uri = ws_url
        .parse::<http::Uri>()
        .map_err(|_| "Invalid CDP WebSocket URL".to_string())?;
    if uri.scheme_str() != Some("ws") {
        return Err("CDP WebSocket URL must use ws".to_string());
    }
    if !matches!(uri.host().unwrap_or_default(), "127.0.0.1" | "localhost" | "::1") {
        return Err("CDP WebSocket URL must target loopback".to_string());
    }
    if uri.port_u16().is_none() || !uri.path().starts_with("/devtools/") {
        return Err("CDP WebSocket URL must include a port and devtools path".to_string());
    }
    Ok(())
}

fn origin_allowed(request: &Request) -> bool {
    let Some(origin) = request.headers().get("origin") else {
        return true;
    };
    let Ok(origin) = origin.to_str() else {
        return false;
    };
    let Ok(uri) = origin.parse::<http::Uri>() else {
        return false;
    };
    matches!(
        (uri.scheme_str(), uri.host()),
        (Some("tauri"), Some("localhost"))
            | (
                Some("http" | "https"),
                Some("tauri.localhost" | "localhost" | "127.0.0.1" | "::1")
            )
    )
}

fn authorize_request(request: &Request, expected_token: &str) -> Result<(), http::StatusCode> {
    if !origin_allowed(request) {
        return Err(http::StatusCode::FORBIDDEN);
    }
    let token = request
        .uri()
        .query()
        .and_then(|query| query.strip_prefix("token="));
    if token.is_some_and(|token| crate::mcp::auth::token_matches(expected_token, token)) {
        Ok(())
    } else {
        Err(http::StatusCode::UNAUTHORIZED)
    }
}

fn rejection(status: http::StatusCode) -> ErrorResponse {
    http::Response::builder()
        .status(status)
        .body(Some(status.canonical_reason().unwrap_or("Rejected").to_string()))
        .expect("valid proxy rejection")
}

async fn relay_connection(
    client_stream: TcpStream,
    upstream_url: String,
    token: String,
    cancel: CancellationToken,
) {
    let client_ws = tokio::select! {
        _ = cancel.cancelled() => return,
        result = tokio_tungstenite::accept_hdr_async(client_stream, |request: &Request, response: Response| {
            authorize_request(request, &token).map(|()| response).map_err(rejection)
        }) => match result {
            Ok(socket) => socket,
            Err(error) => {
                log::warn!("[cdp_proxy] Client handshake rejected: {error}");
                return;
            }
        }
    };
    let mut upstream_request = match upstream_url.into_client_request() {
        Ok(request) => request,
        Err(error) => {
            log::warn!("[cdp_proxy] Invalid upstream request: {error}");
            return;
        }
    };
    for header in [
        "Origin",
        "Sec-Fetch-Mode",
        "Sec-Fetch-Dest",
        "Sec-Fetch-Site",
        "Pragma",
        "Cache-Control",
    ] {
        upstream_request.headers_mut().remove(header);
    }
    let upstream_ws = tokio::select! {
        _ = cancel.cancelled() => return,
        result = connect_async(upstream_request) => match result {
            Ok((socket, _)) => socket,
            Err(error) => {
                log::warn!("[cdp_proxy] Upstream connection failed: {error}");
                return;
            }
        }
    };
    let (mut client_sink, mut client_stream) = client_ws.split();
    let (mut upstream_sink, mut upstream_stream) = upstream_ws.split();
    let client_to_upstream = async {
        while let Some(Ok(message)) = client_stream.next().await {
            if upstream_sink.send(message).await.is_err() {
                break;
            }
        }
    };
    let upstream_to_client = async {
        while let Some(Ok(message)) = upstream_stream.next().await {
            if client_sink.send(message).await.is_err() {
                break;
            }
        }
    };
    tokio::select! {
        _ = cancel.cancelled() => {}
        _ = client_to_upstream => {}
        _ = upstream_to_client => {}
    }
}

async fn run_proxy(
    listener: TcpListener,
    upstream_url: String,
    token: String,
    cancel: CancellationToken,
) {
    let mut relays = JoinSet::new();
    loop {
        tokio::select! {
            _ = cancel.cancelled() => break,
            accepted = listener.accept() => match accepted {
                Ok((stream, _)) => {
                    relays.spawn(relay_connection(
                        stream,
                        upstream_url.clone(),
                        token.clone(),
                        cancel.child_token(),
                    ));
                }
                Err(error) => {
                    log::warn!("[cdp_proxy] Accept failed: {error}");
                    break;
                }
            },
            Some(_) = relays.join_next(), if !relays.is_empty() => {}
        }
    }
    cancel.cancel();
    while relays.join_next().await.is_some() {}
}

/// Start an authenticated loopback WebSocket proxy for one CDP target.
#[tauri::command]
pub async fn cdp_start_proxy(ws_url: String) -> Result<ProxyResult, String> {
    validate_upstream_url(&ws_url)?;
    let mut proxies = ACTIVE_PROXIES.lock().await;
    if let Some(proxy) = proxies.get(&ws_url) {
        return Ok(proxy_result(proxy.local_port, &proxy.token));
    }
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|error| format!("Failed to bind proxy port: {error}"))?;
    let local_port = listener
        .local_addr()
        .map_err(|error| format!("Failed to read proxy address: {error}"))?
        .port();
    let token = crate::mcp::auth::generate_token();
    let cancel = CancellationToken::new();
    let handle = tokio::spawn(run_proxy(
        listener,
        ws_url.clone(),
        token.clone(),
        cancel.clone(),
    ));
    proxies.insert(
        ws_url,
        ProxyInfo {
            local_port,
            token: token.clone(),
            cancel,
            handle,
        },
    );
    log::info!("[cdp_proxy] Started authenticated proxy on port {local_port}");
    Ok(proxy_result(local_port, &token))
}

/// Stop a CDP proxy and join every active relay before returning.
#[tauri::command]
pub async fn cdp_stop_proxy(ws_url: String) -> Result<(), String> {
    let proxy = ACTIVE_PROXIES.lock().await.remove(&ws_url);
    if let Some(proxy) = proxy {
        proxy.cancel.cancel();
        proxy
            .handle
            .await
            .map_err(|error| format!("Failed to stop CDP proxy: {error}"))?;
        log::info!("[cdp_proxy] Stopped proxy on port {}", proxy.local_port);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(uri: &str, origin: Option<&str>) -> Request {
        let mut builder = http::Request::builder().uri(uri);
        if let Some(origin) = origin {
            builder = builder.header("origin", origin);
        }
        builder.body(()).expect("request")
    }

    #[test]
    fn upstream_must_be_loopback_cdp_websocket() {
        assert!(validate_upstream_url("ws://127.0.0.1:9222/devtools/page/1").is_ok());
        assert!(validate_upstream_url("wss://127.0.0.1:9222/devtools/page/1").is_err());
        assert!(validate_upstream_url("ws://example.com:9222/devtools/page/1").is_err());
        assert!(validate_upstream_url("ws://127.0.0.1:9222/other").is_err());
    }

    #[test]
    fn proxy_requires_exact_token_and_allowed_origin() {
        let token = crate::mcp::auth::generate_token();
        let valid = request(
            &format!("/?token={token}"),
            Some("http://tauri.localhost"),
        );
        assert!(authorize_request(&valid, &token).is_ok());
        assert_eq!(
            authorize_request(&request("/?token=wrong", None), &token),
            Err(http::StatusCode::UNAUTHORIZED)
        );
        assert_eq!(
            authorize_request(
                &request(&format!("/?token={token}"), Some("https://evil.test")),
                &token
            ),
            Err(http::StatusCode::FORBIDDEN)
        );
    }
}
