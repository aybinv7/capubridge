//! WebSocket hub for the React DevTools bridge.
//!
//! Unlike the Vue bridge, React DevTools does not need messages pumped through
//! CDP. `react-devtools-core/backend` dials out over a plain WebSocket, so we
//! host a relay here and point the device at it with `adb reverse`:
//!
//! ```text
//! device: connectToDevTools({ host: "localhost", port: 8097 })
//!            |  adb reverse tcp:8097 -> tcp:<host_port>
//!            v
//! host:   127.0.0.1:<host_port>   "/"       <- device backend
//!                                 "/panel"  <- capubridge panel
//! ```
//!
//! The hub is deliberately dumb: it forwards frames verbatim between the two
//! peers and never parses the DevTools protocol.

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::LazyLock;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use tokio::task::AbortHandle;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::Message;

use super::adb::{adb_remove_reverse_inner, adb_reverse_inner};

/// Port the injected backend dials on the device. React DevTools' convention.
const DEVICE_PORT: u16 = 8097;
/// Path the capubridge panel connects on; the backend uses "/".
const PANEL_PATH: &str = "/panel";
const CHANNEL_CAPACITY: usize = 1024;

struct HubInfo {
    host_port: u16,
    abort_handle: AbortHandle,
}

static ACTIVE_HUBS: LazyLock<Mutex<HashMap<String, HubInfo>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactDevtoolsHub {
    pub host_port: u16,
    pub device_port: u16,
    pub panel_ws_url: String,
}

/// Start the relay for `serial` and reverse the device port onto it.
#[tauri::command]
pub async fn react_devtools_start(serial: String) -> Result<ReactDevtoolsHub, String> {
    if let Some(hub) = ACTIVE_HUBS.lock().await.get(&serial) {
        log::info!(
            "[react_devtools] Hub already running for {} on port {}",
            serial,
            hub.host_port
        );
        return Ok(ReactDevtoolsHub {
            host_port: hub.host_port,
            device_port: DEVICE_PORT,
            panel_ws_url: format!("ws://127.0.0.1:{}{}", hub.host_port, PANEL_PATH),
        });
    }

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("Failed to bind React DevTools hub port: {e}"))?;
    let host_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read hub local address: {e}"))?
        .port();

    // Do this before accepting, so a reverse failure surfaces as a start error
    // rather than a panel that waits forever for a backend that cannot dial in.
    adb_reverse_inner(&serial, DEVICE_PORT, host_port)
        .map_err(|e| format!("Failed to reverse tcp:{DEVICE_PORT} for {serial}: {e}"))?;

    let (to_panel, _) = broadcast::channel::<Message>(CHANNEL_CAPACITY);
    let (to_backend, _) = broadcast::channel::<Message>(CHANNEL_CAPACITY);

    let join_handle = tokio::spawn(async move {
        log::info!("[react_devtools] Hub listening on 127.0.0.1:{host_port}");

        loop {
            let (stream, _) = match listener.accept().await {
                Ok(accepted) => accepted,
                Err(e) => {
                    log::error!("[react_devtools] Accept error: {e}");
                    break;
                }
            };

            let to_panel = to_panel.clone();
            let to_backend = to_backend.clone();

            tokio::spawn(async move {
                // The peer identifies itself by path during the handshake.
                let mut is_panel = false;
                let ws = tokio_tungstenite::accept_hdr_async(
                    stream,
                    |request: &Request, response: Response| {
                        is_panel = request.uri().path() == PANEL_PATH;
                        Ok(response)
                    },
                )
                .await;

                let ws = match ws {
                    Ok(ws) => ws,
                    Err(e) => {
                        log::error!("[react_devtools] Handshake failed: {e}");
                        return;
                    }
                };

                let role = if is_panel { "panel" } else { "backend" };
                log::info!("[react_devtools] {role} connected");

                // Each side publishes to the other's channel and consumes its own.
                let (outbound, inbound) = if is_panel {
                    (to_backend, to_panel.subscribe())
                } else {
                    (to_panel, to_backend.subscribe())
                };
                let mut inbound = inbound;

                let (mut sink, mut stream) = ws.split();

                let read = async {
                    while let Some(Ok(message)) = stream.next().await {
                        if message.is_close() {
                            break;
                        }
                        if !(message.is_text() || message.is_binary()) {
                            continue;
                        }
                        // Errors here only mean the peer is not connected yet.
                        let _ = outbound.send(message);
                    }
                };

                let write = async {
                    loop {
                        match inbound.recv().await {
                            Ok(message) => {
                                if sink.send(message).await.is_err() {
                                    break;
                                }
                            }
                            Err(broadcast::error::RecvError::Lagged(skipped)) => {
                                log::warn!("[react_devtools] {role} lagged, dropped {skipped}");
                            }
                            Err(broadcast::error::RecvError::Closed) => break,
                        }
                    }
                };

                tokio::select! {
                    _ = read => log::info!("[react_devtools] {role} read side closed"),
                    _ = write => log::info!("[react_devtools] {role} write side closed"),
                }
            });
        }
    });

    ACTIVE_HUBS.lock().await.insert(
        serial.clone(),
        HubInfo {
            host_port,
            abort_handle: join_handle.abort_handle(),
        },
    );

    log::info!("[react_devtools] Reversed tcp:{DEVICE_PORT} -> tcp:{host_port} for {serial}");

    Ok(ReactDevtoolsHub {
        host_port,
        device_port: DEVICE_PORT,
        panel_ws_url: format!("ws://127.0.0.1:{host_port}{PANEL_PATH}"),
    })
}

/// Tear down the relay and drop the reverse rule.
#[tauri::command]
pub async fn react_devtools_stop(serial: String) -> Result<(), String> {
    let hub = ACTIVE_HUBS.lock().await.remove(&serial);

    let Some(hub) = hub else {
        return Ok(());
    };

    hub.abort_handle.abort();

    // Best effort: the device may already be gone, which is not a failure here.
    if let Err(e) = adb_remove_reverse_inner(&serial, DEVICE_PORT) {
        log::warn!("[react_devtools] Could not remove reverse for {serial}: {e}");
    }

    log::info!("[react_devtools] Hub stopped for {serial}");
    Ok(())
}
