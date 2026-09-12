//! Pulls an OPFS-backed SQLite database off a device straight to disk.
//!
//! The frontend used to do this itself: base64 out of the WebView, assemble in
//! JS, re-encode, hand the whole string to Rust over IPC. That cost several
//! copies of the database in memory and two full base64 round trips. Here the
//! chunk loop, the decode and the write all happen in Rust, so the bytes never
//! enter the JS heap at all.

use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;

use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Emitter;
use tokio_tungstenite::tungstenite::Message;

use crate::commands::cdp_proxy::validate_upstream_url;
use crate::mcp::cdp::{connect, CdpSocket};

/// Matches `OPFS_READ_CHUNK_BYTES` in the protocol package: base64 inflates a
/// chunk by 4/3, so 8 MiB stays under a stock 16 MiB WebSocket frame ceiling.
const CHUNK_BYTES: u64 = 8 * 1024 * 1024;
const SAH_POOL_HEADER_DATA_OFFSET: u64 = 4096;
const SQLITE_MAGIC: &[u8] = b"SQLite format 3\0";
const CHUNK_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpfsFileStat {
    pub size: u64,
    pub last_modified: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpfsPullResult {
    pub path: String,
    pub size: u64,
    pub last_modified: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpfsPullProgress {
    opfs_path: String,
    loaded: u64,
    total: u64,
}

#[derive(Deserialize)]
struct StatPayload {
    size: u64,
    #[serde(default)]
    last_modified: f64,
}

fn escape_js_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

/// One CDP connection with its own request-id counter, so a whole chunk loop
/// runs over a single socket instead of reconnecting per read.
struct CdpSession {
    socket: CdpSocket,
    next_id: u32,
}

impl CdpSession {
    async fn open(ws_url: &str) -> Result<Self, String> {
        Ok(Self {
            socket: connect(ws_url).await?,
            next_id: 1,
        })
    }

    async fn evaluate(&mut self, expression: &str) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let payload = serde_json::json!({
            "id": id,
            "method": "Runtime.evaluate",
            "params": {
                "expression": expression,
                "awaitPromise": true,
                "returnByValue": true,
            }
        });
        self.socket
            .send(Message::Text(payload.to_string().into()))
            .await
            .map_err(|error| format!("Failed to send CDP command: {error}"))?;

        tokio::time::timeout(CHUNK_TIMEOUT, self.await_response(id))
            .await
            .map_err(|_| "Timed out waiting for a CDP response".to_string())?
    }

    async fn await_response(&mut self, id: u32) -> Result<Value, String> {
        while let Some(message) = self.socket.next().await {
            let message = message.map_err(|error| format!("CDP transport error: {error}"))?;
            let text = match message {
                Message::Text(text) => text.to_string(),
                Message::Binary(bytes) => String::from_utf8(bytes.to_vec())
                    .map_err(|error| format!("Invalid utf8 CDP frame: {error}"))?,
                _ => continue,
            };
            let Ok(value) = serde_json::from_str::<Value>(&text) else {
                continue;
            };
            if value.get("id").and_then(Value::as_u64) != Some(u64::from(id)) {
                continue;
            }
            if let Some(error) = value.get("error") {
                let message = error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown CDP error");
                return Err(format!("CDP error: {message}"));
            }
            return Ok(value.get("result").cloned().unwrap_or(Value::Null));
        }
        Err("CDP connection closed before a response arrived".to_string())
    }

    /// Runs `expression` and returns the string it resolved to, surfacing the
    /// `__opfsError` sentinel the injected scripts use for in-page failures.
    async fn evaluate_string(&mut self, expression: &str) -> Result<String, String> {
        let envelope = self.evaluate(expression).await?;
        if let Some(exception) = envelope.get("exceptionDetails") {
            return Err(format!("Evaluation failed in page: {exception}"));
        }
        let value = envelope
            .get("result")
            .and_then(|result| result.get("value"))
            .and_then(Value::as_str)
            .ok_or_else(|| "CDP returned no value for the OPFS read".to_string())?;
        if value.starts_with("{\"__opfsError\"") {
            let parsed: Value = serde_json::from_str(value).unwrap_or(Value::Null);
            let message = parsed
                .get("__opfsError")
                .and_then(Value::as_str)
                .unwrap_or("unknown OPFS error");
            return Err(message.to_string());
        }
        Ok(value.to_string())
    }

    async fn stat(&mut self, path: &str) -> Result<OpfsFileStat, String> {
        let escaped = escape_js_string(path);
        let expression = format!(
            r#"
            (async () => {{
              try {{
                const root = await navigator.storage.getDirectory();
                const parts = '{escaped}'.split('/').filter(Boolean);
                const name = parts.pop();
                if (!name) throw new Error('Empty path');
                let dir = root;
                for (const p of parts) dir = await dir.getDirectoryHandle(p);
                const file = await (await dir.getFileHandle(name)).getFile();
                return JSON.stringify({{ size: file.size, last_modified: file.lastModified }});
              }} catch (e) {{
                return JSON.stringify({{ __opfsError: e && e.message ? e.message : String(e) }});
              }}
            }})()
            "#
        );
        let raw = self.evaluate_string(&expression).await?;
        let payload: StatPayload = serde_json::from_str(&raw)
            .map_err(|error| format!("Malformed OPFS stat payload: {error}"))?;
        Ok(OpfsFileStat {
            size: payload.size,
            last_modified: payload.last_modified,
        })
    }

    async fn read_chunk(&mut self, path: &str, offset: u64, length: u64) -> Result<Vec<u8>, String> {
        let escaped = escape_js_string(path);
        let expression = format!(
            r#"
            (async () => {{
              try {{
                const root = await navigator.storage.getDirectory();
                const parts = '{escaped}'.split('/').filter(Boolean);
                const name = parts.pop();
                if (!name) throw new Error('Empty path');
                let dir = root;
                for (const p of parts) dir = await dir.getDirectoryHandle(p);
                const file = await (await dir.getFileHandle(name)).getFile();
                const off = {offset};
                const end = Math.min(file.size, off + {length});
                const buf = new Uint8Array(await file.slice(off, end).arrayBuffer());
                let s = '';
                const STEP = 32768;
                for (let i = 0; i < buf.length; i += STEP) {{
                  s += String.fromCharCode.apply(null, buf.subarray(i, Math.min(i + STEP, buf.length)));
                }}
                return btoa(s);
              }} catch (e) {{
                return JSON.stringify({{ __opfsError: e && e.message ? e.message : String(e) }});
              }}
            }})()
            "#
        );
        let encoded = self.evaluate_string(&expression).await?;
        base64::engine::general_purpose::STANDARD
            .decode(encoded.as_bytes())
            .map_err(|error| format!("base64 decode failed: {error}"))
    }
}

fn temp_target(label: &str) -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);

    let safe: String = label
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let id = COUNTER.fetch_add(1, Ordering::SeqCst);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("opfs-{now}-{id}-{safe}.db"))
}

/// Read an OPFS file's size and modification time without transferring it.
/// Cheap enough to poll, which is what makes skipping an unchanged pull viable.
#[tauri::command]
pub async fn opfs_stat_file(ws_url: String, path: String) -> Result<OpfsFileStat, String> {
    validate_upstream_url(&ws_url)?;
    let mut session = CdpSession::open(&ws_url).await?;
    let stat = session.stat(&path).await;
    let _ = session.socket.close(None).await;
    stat
}

/// Stream an OPFS SQLite database to a local temp file and return its path.
#[tauri::command]
pub async fn opfs_pull_sqlite(
    window: tauri::WebviewWindow,
    ws_url: String,
    path: String,
    label: String,
    strip_sah_pool_header: bool,
) -> Result<OpfsPullResult, String> {
    validate_upstream_url(&ws_url)?;
    let mut session = CdpSession::open(&ws_url).await?;
    let result = pull_into_file(
        &mut session,
        &window,
        &path,
        &label,
        strip_sah_pool_header,
    )
    .await;
    let _ = session.socket.close(None).await;
    result
}

async fn pull_into_file(
    session: &mut CdpSession,
    window: &tauri::WebviewWindow,
    path: &str,
    label: &str,
    strip_sah_pool_header: bool,
) -> Result<OpfsPullResult, String> {
    let stat = session.stat(path).await?;
    let offset = if strip_sah_pool_header {
        SAH_POOL_HEADER_DATA_OFFSET
    } else {
        0
    };
    if stat.size <= offset {
        return Err(format!("\"{path}\" is too small to hold a SQLite database"));
    }
    let total = stat.size - offset;

    let target = temp_target(label);
    let mut file = std::fs::File::create(&target)
        .map_err(|error| format!("Failed to create local snapshot: {error}"))?;

    let mut written: u64 = 0;
    while written < total {
        let length = CHUNK_BYTES.min(total - written);
        let chunk = session.read_chunk(path, offset + written, length).await?;
        if chunk.is_empty() {
            break;
        }
        if written == 0 && !chunk.starts_with(SQLITE_MAGIC) {
            drop(file);
            let _ = std::fs::remove_file(&target);
            return Err(format!(
                "Bytes at offset {offset} of \"{path}\" are not a SQLite database (magic header mismatch)."
            ));
        }
        file.write_all(&chunk)
            .map_err(|error| format!("Failed to write local snapshot: {error}"))?;
        written += chunk.len() as u64;
        let _ = window.emit(
            "capubridge:opfs-pull-progress",
            OpfsPullProgress {
                opfs_path: path.to_string(),
                loaded: written,
                total,
            },
        );
    }

    file.flush()
        .map_err(|error| format!("Failed to flush local snapshot: {error}"))?;

    Ok(OpfsPullResult {
        path: target.to_string_lossy().to_string(),
        size: written,
        last_modified: stat.last_modified,
    })
}
