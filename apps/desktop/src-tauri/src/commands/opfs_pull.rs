//! Pulls an OPFS-backed SQLite database off a device straight to disk.
//!
//! The frontend used to do this itself: base64 out of the WebView, assemble in
//! JS, re-encode, hand the whole string to Rust over IPC. That cost several
//! copies of the database in memory and two full base64 round trips. Here the
//! chunk loop, the decode and the write all happen in Rust, so the bytes never
//! enter the JS heap at all.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Emitter;
use tokio_tungstenite::tungstenite::Message;

use crate::commands::cdp_proxy::validate_upstream_url;
use crate::mcp::cdp::{connect, CdpSocket};

/// Matches `OPFS_READ_CHUNK_BYTES` in the protocol package: small enough that the
/// app's page never stalls for long on one chunk, far under a WebSocket frame.
const CHUNK_BYTES: u64 = 2 * 1024 * 1024;
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
pub struct OpfsSaveResult {
    pub size: u64,
    pub last_modified: f64,
    pub changed: bool,
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

    async fn read_chunk(
        &mut self,
        path: &str,
        offset: u64,
        length: u64,
    ) -> Result<Vec<u8>, String> {
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
                const blob = file.slice(off, end);
                return await new Promise((resolve, reject) => {{
                  const reader = new FileReader();
                  reader.onload = () => {{
                    const url = String(reader.result || '');
                    const comma = url.indexOf(',');
                    resolve(comma >= 0 ? url.slice(comma + 1) : '');
                  }};
                  reader.onerror = () => reject(reader.error || new Error('The file could not be read'));
                  reader.readAsDataURL(blob);
                }});
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

/// Where the bytes of an OPFS file come from: the page over CDP, or a fake in tests.
trait OpfsSource {
    async fn stat(&mut self, path: &str) -> Result<OpfsFileStat, String>;
    async fn read_chunk(&mut self, path: &str, offset: u64, length: u64)
        -> Result<Vec<u8>, String>;
}

impl OpfsSource for CdpSession {
    async fn stat(&mut self, path: &str) -> Result<OpfsFileStat, String> {
        CdpSession::stat(self, path).await
    }

    async fn read_chunk(
        &mut self,
        path: &str,
        offset: u64,
        length: u64,
    ) -> Result<Vec<u8>, String> {
        CdpSession::read_chunk(self, path, offset, length).await
    }
}

fn emit_progress<'a>(window: &'a tauri::Webview, path: &str) -> impl FnMut(u64, u64) + 'a {
    let path = path.to_string();
    move |loaded, total| {
        let _ = window.emit(
            "capubridge:opfs-pull-progress",
            OpfsPullProgress {
                opfs_path: path.clone(),
                loaded,
                total,
            },
        );
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
    window: tauri::Webview,
    ws_url: String,
    path: String,
    label: String,
    strip_sah_pool_header: bool,
) -> Result<OpfsPullResult, String> {
    validate_upstream_url(&ws_url)?;
    let mut session = CdpSession::open(&ws_url).await?;
    let mut progress = emit_progress(&window, &path);
    let result = pull_into_file(
        &mut session,
        &mut progress,
        &path,
        &label,
        strip_sah_pool_header,
    )
    .await;
    let _ = session.socket.close(None).await;
    result
}

/// Stream an OPFS file to `destination` (picked by the person in a save
/// dialog). The bytes land in a sibling `.capubridge-part` file first and
/// replace the destination only once complete, so a failed copy never leaves
/// a half file or destroys the one that was there. `changed` reports a file
/// the app wrote to while it was being copied.
#[tauri::command]
pub async fn opfs_save_file(
    window: tauri::Webview,
    ws_url: String,
    path: String,
    destination: String,
) -> Result<OpfsSaveResult, String> {
    validate_upstream_url(&ws_url)?;
    let mut session = CdpSession::open(&ws_url).await?;
    let mut progress = emit_progress(&window, &path);
    let result = save_into(&mut session, &mut progress, &path, Path::new(&destination)).await;
    let _ = session.socket.close(None).await;
    result
}

fn partial_path(destination: &Path) -> PathBuf {
    let mut name = destination
        .file_name()
        .map(|name| name.to_os_string())
        .unwrap_or_else(|| "opfs-file".into());
    name.push(".capubridge-part");
    destination.with_file_name(name)
}

fn same_stat(left: &OpfsFileStat, right: &OpfsFileStat) -> bool {
    left.size == right.size && left.last_modified == right.last_modified
}

/// Whether a finished copy may replace the destination, and whether the app
/// wrote to the file while it was copied. A copy shorter than the file, or a
/// file that could not be checked afterwards, never replaces anything.
fn finish_save(
    before: &OpfsFileStat,
    written: u64,
    after: Result<OpfsFileStat, String>,
) -> Result<bool, String> {
    if written != before.size {
        return Err(format!(
            "The copy stopped at {written} of {} bytes, so the file on disk was left as it was.",
            before.size
        ));
    }
    match after {
        Ok(after) => Ok(!same_stat(before, &after)),
        Err(error) => Err(format!(
            "The file could not be checked after the copy ({error}), so the file on disk was left as it was."
        )),
    }
}

async fn save_into<S: OpfsSource>(
    source: &mut S,
    progress: &mut impl FnMut(u64, u64),
    path: &str,
    destination: &Path,
) -> Result<OpfsSaveResult, String> {
    let before = source.stat(path).await?;
    let partial = partial_path(destination);
    let written = copy_range(source, progress, path, 0, before.size, &partial, false).await?;
    let after = source.stat(path).await;
    let changed = match finish_save(&before, written, after) {
        Ok(changed) => changed,
        Err(error) => {
            let _ = std::fs::remove_file(&partial);
            return Err(error);
        }
    };
    if let Err(error) = std::fs::rename(&partial, destination) {
        let _ = std::fs::remove_file(&partial);
        return Err(format!("Failed to save the file: {error}"));
    }
    Ok(OpfsSaveResult {
        size: written,
        last_modified: before.last_modified,
        changed,
    })
}

/// Copies `total` bytes of an OPFS file from `offset` into `target`, chunk by
/// chunk, reporting progress, and syncs it to disk. Removes `target` when
/// anything fails, so no partial file is left behind. Resolves the bytes
/// written, which is less than `total` when the file got shorter meanwhile.
async fn copy_range<S: OpfsSource>(
    source: &mut S,
    progress: &mut impl FnMut(u64, u64),
    path: &str,
    offset: u64,
    total: u64,
    target: &Path,
    expect_sqlite: bool,
) -> Result<u64, String> {
    let result =
        copy_range_inner(source, progress, path, offset, total, target, expect_sqlite).await;
    if result.is_err() {
        let _ = std::fs::remove_file(target);
    }
    result
}

async fn copy_range_inner<S: OpfsSource>(
    source: &mut S,
    progress: &mut impl FnMut(u64, u64),
    path: &str,
    offset: u64,
    total: u64,
    target: &Path,
    expect_sqlite: bool,
) -> Result<u64, String> {
    let mut file = std::fs::File::create(target)
        .map_err(|error| format!("Failed to create the local copy: {error}"))?;
    let mut written: u64 = 0;
    while written < total {
        let length = CHUNK_BYTES.min(total - written);
        let chunk = source.read_chunk(path, offset + written, length).await?;
        if chunk.is_empty() {
            break;
        }
        if expect_sqlite && written == 0 && !chunk.starts_with(SQLITE_MAGIC) {
            return Err(format!(
                "Bytes at offset {offset} of \"{path}\" are not a SQLite database (magic header mismatch)."
            ));
        }
        file.write_all(&chunk)
            .map_err(|error| format!("Failed to write the local copy: {error}"))?;
        written += chunk.len() as u64;
        progress(written, total);
    }
    file.flush()
        .map_err(|error| format!("Failed to flush the local copy: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to write the local copy to disk: {error}"))?;
    Ok(written)
}

async fn pull_into_file<S: OpfsSource>(
    source: &mut S,
    progress: &mut impl FnMut(u64, u64),
    path: &str,
    label: &str,
    strip_sah_pool_header: bool,
) -> Result<OpfsPullResult, String> {
    let stat = source.stat(path).await?;
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
    let written = copy_range(source, progress, path, offset, total, &target, true).await?;
    if written != total {
        let _ = std::fs::remove_file(&target);
        return Err(format!(
            "The copy of \"{path}\" stopped at {written} of {total} bytes; the app may have changed it. Try again."
        ));
    }

    Ok(OpfsPullResult {
        path: target.to_string_lossy().to_string(),
        size: written,
        last_modified: stat.last_modified,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// An OPFS file in memory; `short_after` makes reads past it come back
    /// empty (the file shrank), `fail_stat_after` makes the n-th stat fail.
    struct FakeSource {
        bytes: Vec<u8>,
        short_after: Option<usize>,
        stats: usize,
        fail_stat_after: Option<usize>,
        grow_on_read: bool,
    }

    impl FakeSource {
        fn new(bytes: &[u8]) -> Self {
            Self {
                bytes: bytes.to_vec(),
                short_after: None,
                stats: 0,
                fail_stat_after: None,
                grow_on_read: false,
            }
        }
    }

    impl OpfsSource for FakeSource {
        async fn stat(&mut self, _path: &str) -> Result<OpfsFileStat, String> {
            self.stats += 1;
            if self.fail_stat_after.is_some_and(|limit| self.stats > limit) {
                return Err("the page went away".to_string());
            }
            Ok(OpfsFileStat {
                size: self.bytes.len() as u64,
                last_modified: 1.0 + self.bytes.len() as f64,
            })
        }

        async fn read_chunk(
            &mut self,
            _path: &str,
            offset: u64,
            length: u64,
        ) -> Result<Vec<u8>, String> {
            let end = self
                .short_after
                .unwrap_or(self.bytes.len())
                .min(self.bytes.len());
            let start = (offset as usize).min(end);
            let stop = (offset + length).min(end as u64) as usize;
            let chunk = self.bytes[start..stop].to_vec();
            if self.grow_on_read {
                self.bytes.push(b'+');
            }
            Ok(chunk)
        }
    }

    fn destination_with(content: &[u8]) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("temp dir");
        let destination = dir.path().join("app.sqlite3");
        std::fs::write(&destination, content).expect("seed destination");
        (dir, destination)
    }

    #[tokio::test]
    async fn a_short_copy_never_replaces_the_destination() {
        let (_dir, destination) = destination_with(b"the copy saved last week");
        let mut source = FakeSource::new(b"0123456789");
        source.short_after = Some(4);
        let error = save_into(&mut source, &mut |_, _| {}, "app.sqlite3", &destination)
            .await
            .expect_err("a short copy is an error");
        assert!(error.contains("4 of 10"), "{error}");
        assert_eq!(
            std::fs::read(&destination).unwrap(),
            b"the copy saved last week"
        );
        assert!(!partial_path(&destination).exists());
    }

    #[tokio::test]
    async fn a_file_that_cannot_be_checked_afterwards_never_replaces_the_destination() {
        let (_dir, destination) = destination_with(b"old");
        let mut source = FakeSource::new(b"0123456789");
        source.fail_stat_after = Some(1);
        let error = save_into(&mut source, &mut |_, _| {}, "app.sqlite3", &destination)
            .await
            .expect_err("an unchecked copy is an error");
        assert!(error.contains("could not be checked"), "{error}");
        assert_eq!(std::fs::read(&destination).unwrap(), b"old");
        assert!(!partial_path(&destination).exists());
    }

    #[tokio::test]
    async fn a_complete_copy_replaces_the_destination_and_says_whether_the_app_wrote() {
        let (_dir, destination) = destination_with(b"old");
        let mut source = FakeSource::new(b"0123456789");
        let mut seen = Vec::new();
        let saved = save_into(
            &mut source,
            &mut |loaded, total| seen.push((loaded, total)),
            "app.sqlite3",
            &destination,
        )
        .await
        .expect("saved");
        assert_eq!(std::fs::read(&destination).unwrap(), b"0123456789");
        assert!(!saved.changed);
        assert_eq!(seen.last(), Some(&(10, 10)));

        let mut growing = FakeSource::new(b"0123456789");
        growing.grow_on_read = true;
        let saved = save_into(&mut growing, &mut |_, _| {}, "app.sqlite3", &destination)
            .await
            .expect("saved");
        assert!(saved.changed);
    }

    #[tokio::test]
    async fn a_short_database_pull_is_an_error() {
        let mut bytes = SQLITE_MAGIC.to_vec();
        bytes.extend_from_slice(&[0u8; 64]);
        let mut source = FakeSource::new(&bytes);
        source.short_after = Some(20);
        let error = pull_into_file(&mut source, &mut |_, _| {}, "app.sqlite3", "app", false)
            .await
            .expect_err("a short pull is an error");
        assert!(error.contains("20 of 80"), "{error}");
    }

    #[test]
    fn partial_path_sits_beside_the_destination() {
        let destination = Path::new("C:/Users/me/Downloads/app.sqlite3");
        assert_eq!(
            partial_path(destination),
            Path::new("C:/Users/me/Downloads/app.sqlite3.capubridge-part")
        );
    }

    #[test]
    fn same_stat_needs_size_and_time() {
        let base = OpfsFileStat {
            size: 10,
            last_modified: 1.0,
        };
        assert!(same_stat(&base, &base.clone()));
        assert!(!same_stat(
            &base,
            &OpfsFileStat {
                size: 11,
                last_modified: 1.0
            }
        ));
        assert!(!same_stat(
            &base,
            &OpfsFileStat {
                size: 10,
                last_modified: 2.0
            }
        ));
    }
}
