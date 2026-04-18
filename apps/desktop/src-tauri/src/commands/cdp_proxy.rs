use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::LazyLock;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio::task::AbortHandle;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

struct ProxyInfo {
    local_port: u16,
    abort_handle: AbortHandle,
}

static ACTIVE_PROXIES: LazyLock<Mutex<HashMap<String, ProxyInfo>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResult {
    pub local_port: u16,
    pub ws_url: String,
}

/// Start a local WebSocket proxy that forwards to a CDP target.
/// This avoids CORS/Origin issues with direct browser -> Android CDP connections.
/// `ws_url` is the CDP WebSocket URL (e.g. ws://localhost:9224/devtools/page/...)
#[tauri::command]
pub async fn cdp_start_proxy(ws_url: String) -> Result<ProxyResult, String> {
    log::info!("[cdp_start_proxy] Creating proxy for {}", ws_url);

    // If already running for this URL, just return it
    {
        let proxies = ACTIVE_PROXIES.lock().await;
        if let Some(proxy) = proxies.get(&ws_url) {
            log::info!("[cdp_start_proxy] Proxy already exists on port {}", proxy.local_port);
            return Ok(ProxyResult {
                local_port: proxy.local_port,
                ws_url: format!("ws://127.0.0.1:{}", proxy.local_port),
            });
        }
    }

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("Failed to bind proxy port: {}", e))?;
    let local_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read proxy local address: {}", e))?
        .port();

    let cdp_url = ws_url.clone();
    let join_handle = tokio::spawn(async move {
        log::info!("[cdp_proxy] Listening on port {}", local_port);

        loop {
            match listener.accept().await {
                Ok((client_stream, _)) => {
                    log::info!("[cdp_proxy] Client connected to port {}", local_port);

                    let cdp_url = cdp_url.clone();
                    tokio::spawn(async move {
                        // Accept the WebSocket handshake from the client
                        let client_ws = tokio_tungstenite::accept_async(client_stream).await;

                        let client_ws = match client_ws {
                            Ok(ws) => ws,
                            Err(e) => {
                                log::error!("[cdp_proxy] Failed to accept client: {}", e);
                                return;
                            }
                        };

                        // Build request to CDP — manually construct to avoid Origin header
                        let mut request = match cdp_url.into_client_request() {
                            Ok(request) => request,
                            Err(e) => {
                                log::error!("[cdp_proxy] Invalid CDP URL: {}", e);
                                return;
                            }
                        };

                        // Remove Origin header — this is what causes 403 on Android CDP
                        request.headers_mut().remove("Origin");
                        request.headers_mut().remove("Sec-Fetch-Mode");
                        request.headers_mut().remove("Sec-Fetch-Dest");
                        request.headers_mut().remove("Sec-Fetch-Site");
                        request.headers_mut().remove("Pragma");
                        request.headers_mut().remove("Cache-Control");

                    let cdp_result = connect_async(request).await;

                        let (cdp_ws, response) = match cdp_result {
                            Ok((ws, resp)) => (ws, resp),
                            Err(e) => {
                                log::error!("[cdp_proxy] Failed to connect to CDP: {}", e);
                                return;
                            }
                        };

                        log::info!("[cdp_proxy] Connected to CDP, status: {}", response.status());

                        // Bidirectional relay
                        let (mut client_sink, mut client_stream) = client_ws.split();
                        let (mut cdp_sink, mut cdp_stream) = cdp_ws.split();

                        let client_to_cdp = async {
                            while let Some(Ok(msg)) = client_stream.next().await {
                                log::info!("[cdp_proxy] client -> cdp msg on port {}", local_port);
                                if cdp_sink.send(msg).await.is_err() {
                                    log::warn!("[cdp_proxy] client -> cdp send failed on port {}", local_port);
                                    break;
                                }
                            }
                            log::info!("[cdp_proxy] client stream ended on port {}", local_port);
                        };

                        let cdp_to_client = async {
                            while let Some(Ok(msg)) = cdp_stream.next().await {
                                log::info!("[cdp_proxy] cdp -> client msg on port {}", local_port);
                                if client_sink.send(msg).await.is_err() {
                                    log::warn!("[cdp_proxy] cdp -> client send failed on port {}", local_port);
                                    break;
                                }
                            }
                            log::info!("[cdp_proxy] cdp stream ended on port {}", local_port);
                        };

                        tokio::select! {
                            _ = client_to_cdp => log::info!("[cdp_proxy] Client -> CDP stream closed"),
                            _ = cdp_to_client => log::info!("[cdp_proxy] CDP -> Client stream closed"),
                        }

                        log::info!("[cdp_proxy] Proxy session ended");
                    });
                }
                Err(e) => {
                    log::error!("[cdp_proxy] Accept error: {}", e);
                    break;
                }
            }
        }
    });

    ACTIVE_PROXIES.lock().await.insert(
        ws_url.clone(),
        ProxyInfo {
            local_port,
            abort_handle: join_handle.abort_handle(),
        },
    );

    let proxy_ws_url = format!("ws://127.0.0.1:{}", local_port);
    log::info!("[cdp_start_proxy] Proxy available at {}", proxy_ws_url);

    Ok(ProxyResult {
        local_port,
        ws_url: proxy_ws_url,
    })
}

/// Stop a CDP proxy (closes the listener, existing connections will drop)
#[tauri::command]
pub async fn cdp_stop_proxy(ws_url: String) -> Result<(), String> {
    let mut proxies = ACTIVE_PROXIES.lock().await;
    if let Some(proxy) = proxies.remove(&ws_url) {
        log::info!("[cdp_stop_proxy] Stopping proxy on port {}", proxy.local_port);
        proxy.abort_handle.abort();
    }
    Ok(())
}
