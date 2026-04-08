use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::LazyLock;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use futures_util::{SinkExt, StreamExt};

static NEXT_PROXY_PORT: AtomicU16 = AtomicU16::new(19000);

struct ProxyInfo {
    local_port: u16,
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

    let local_port = NEXT_PROXY_PORT.fetch_add(1, Ordering::SeqCst);
    let listener = TcpListener::bind(("127.0.0.1", local_port))
        .await
        .map_err(|e| format!("Failed to bind proxy port {}: {}", local_port, e))?;

    let cdp_url = ws_url.clone();
    tokio::spawn(async move {
        log::info!("[cdp_proxy] Listening on port {}", local_port);

        loop {
            match listener.accept().await {
                Ok((client_stream, _)) => {
                    log::info!("[cdp_proxy] Client connected to port {}", local_port);

                    let cdp_url = cdp_url.clone();
                    tokio::spawn(async move {
                        // Accept the WebSocket handshake from the client
                        let client_ws = tokio_tungstenite::accept_async(client_stream)
                            .await;

                        let client_ws = match client_ws {
                            Ok(ws) => ws,
                            Err(e) => {
                                log::error!("[cdp_proxy] Failed to accept client: {}", e);
                                return;
                            }
                        };

                        // Build request to CDP — manually construct to avoid Origin header
                        let mut request = cdp_url
                            .into_client_request()
                            .unwrap_or_else(|e| {
                                log::error!("[cdp_proxy] Invalid CDP URL: {}", e);
                                panic!("Invalid CDP URL");
                            });

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

                        log::info!(
                            "[cdp_proxy] Connected to CDP, status: {}",
                            response.status()
                        );

                        // Bidirectional relay
                        let (mut client_sink, mut client_stream) = client_ws.split();
                        let (mut cdp_sink, mut cdp_stream) = cdp_ws.split();

                        let client_to_cdp = async {
                            while let Some(Ok(msg)) = client_stream.next().await {
                                if cdp_sink.send(msg).await.is_err() {
                                    break;
                                }
                            }
                        };

                        let cdp_to_client = async {
                            while let Some(Ok(msg)) = cdp_stream.next().await {
                                if client_sink.send(msg).await.is_err() {
                                    break;
                                }
                            }
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
        ProxyInfo { local_port },
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
        // The listener will be dropped, closing all connections
    }
    Ok(())
}
