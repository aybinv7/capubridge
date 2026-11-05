//! Large files written piece by piece: an export streams its bytes here as it reads them, so
//! the webview never holds the whole file. Bytes go to `<dest>.part` and only replace `dest`
//! when the writer finishes, so a cancelled or failed export never leaves a truncated file.

use crate::blocking::run_blocking;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::ipc::{InvokeBody, Request, Response};

const STREAM_HEADER: &str = "x-capubridge-stream";

struct OpenStream {
    dest: PathBuf,
    part: PathBuf,
    writer: BufWriter<File>,
    written: u64,
}

/// Open streams by id; one id per file being written.
#[derive(Default)]
pub struct StreamRegistry {
    next: AtomicU64,
    open: Mutex<HashMap<u64, OpenStream>>,
}

fn part_path(dest: &Path) -> PathBuf {
    let mut name = dest.file_name().map(|n| n.to_os_string()).unwrap_or_default();
    name.push(".part");
    dest.with_file_name(name)
}

impl StreamRegistry {
    /// Creates `<dest>.part` (truncating a leftover one) and returns the stream id.
    pub fn begin(&self, dest: &Path) -> Result<u64, String> {
        if dest.file_name().is_none() {
            return Err("The file name is missing".to_string());
        }
        let part = part_path(dest);
        let file = File::create(&part).map_err(|e| format!("Could not create the file: {e}"))?;
        let id = self.next.fetch_add(1, Ordering::Relaxed) + 1;
        let stream = OpenStream {
            dest: dest.to_path_buf(),
            part,
            writer: BufWriter::with_capacity(1 << 20, file),
            written: 0,
        };
        self.lock()?.insert(id, stream);
        Ok(id)
    }

    /// Appends bytes and returns how many bytes the stream holds so far.
    pub fn append(&self, id: u64, bytes: &[u8]) -> Result<u64, String> {
        let mut open = self.lock()?;
        let stream = open
            .get_mut(&id)
            .ok_or_else(|| "This file is no longer being written".to_string())?;
        stream
            .writer
            .write_all(bytes)
            .map_err(|e| format!("Could not write the file: {e}"))?;
        stream.written += bytes.len() as u64;
        Ok(stream.written)
    }

    /// Flushes and moves `<dest>.part` over `dest`; returns the final size.
    pub fn finish(&self, id: u64) -> Result<u64, String> {
        let stream = self
            .lock()?
            .remove(&id)
            .ok_or_else(|| "This file is no longer being written".to_string())?;
        let OpenStream {
            dest,
            part,
            writer,
            written,
        } = stream;
        let file = writer
            .into_inner()
            .map_err(|e| format!("Could not write the file: {}", e.error()))?;
        file.sync_all()
            .map_err(|e| format!("Could not write the file: {e}"))?;
        drop(file);
        if dest.exists() {
            fs::remove_file(&dest).map_err(|e| format!("Could not replace the file: {e}"))?;
        }
        fs::rename(&part, &dest).map_err(|e| format!("Could not save the file: {e}"))?;
        Ok(written)
    }

    /// Drops the stream and deletes `<dest>.part`; `dest` itself is never touched.
    pub fn discard(&self, id: u64) -> Result<(), String> {
        let Some(stream) = self.lock()?.remove(&id) else {
            return Ok(());
        };
        let part = stream.part.clone();
        drop(stream);
        match fs::remove_file(&part) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("Could not remove the unfinished file: {e}")),
        }
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, HashMap<u64, OpenStream>>, String> {
        self.open
            .lock()
            .map_err(|_| "The file writer is unavailable".to_string())
    }
}

fn registry() -> &'static StreamRegistry {
    static REGISTRY: OnceLock<StreamRegistry> = OnceLock::new();
    REGISTRY.get_or_init(StreamRegistry::default)
}

fn stream_id(request: &Request<'_>) -> Result<u64, String> {
    request
        .headers()
        .get(STREAM_HEADER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(|| format!("Missing {STREAM_HEADER} header"))
}

/// Starts writing `path` piece by piece; returns the stream id for the other calls.
#[tauri::command]
pub async fn host_file_stream_begin(path: String) -> Result<u64, String> {
    run_blocking(move || registry().begin(Path::new(&path))).await?
}

/// Appends the raw request body to the stream named by the `x-capubridge-stream` header.
#[tauri::command]
pub async fn host_file_stream_append(request: Request<'_>) -> Result<u64, String> {
    let id = stream_id(&request)?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected raw bytes".to_string());
    };
    let bytes = bytes.clone();
    run_blocking(move || registry().append(id, &bytes)).await?
}

/// Finishes the stream: the written file replaces the destination.
#[tauri::command]
pub async fn host_file_stream_finish(id: u64) -> Result<u64, String> {
    run_blocking(move || registry().finish(id)).await?
}

/// Abandons the stream and deletes what was written.
#[tauri::command]
pub async fn host_file_stream_discard(id: u64) -> Result<(), String> {
    run_blocking(move || registry().discard(id)).await?
}

/// Reads a file on this computer as raw bytes (no base64 on the way).
#[tauri::command]
pub async fn read_local_file_bytes(path: String) -> Result<Response, String> {
    let bytes = run_blocking(move || {
        fs::read(&path).map_err(|e| format!("Could not read the file: {e}"))
    })
    .await??;
    Ok(Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_pieces_then_replaces_the_destination() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("shop.idb.json");
        fs::write(&dest, b"old").unwrap();
        let registry = StreamRegistry::default();
        let id = registry.begin(&dest).unwrap();
        assert_eq!(registry.append(id, b"{\"a\":").unwrap(), 5);
        assert_eq!(registry.append(id, b"1}").unwrap(), 7);
        assert_eq!(fs::read(&dest).unwrap(), b"old");
        assert_eq!(registry.finish(id).unwrap(), 7);
        assert_eq!(fs::read(&dest).unwrap(), b"{\"a\":1}");
        assert!(!part_path(&dest).exists());
    }

    #[test]
    fn discard_removes_the_partial_file_and_keeps_the_destination() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("shop.idb.json");
        fs::write(&dest, b"keep").unwrap();
        let registry = StreamRegistry::default();
        let id = registry.begin(&dest).unwrap();
        registry.append(id, b"partial").unwrap();
        registry.discard(id).unwrap();
        assert!(!part_path(&dest).exists());
        assert_eq!(fs::read(&dest).unwrap(), b"keep");
        assert!(registry.append(id, b"more").is_err());
        assert!(registry.discard(id).is_ok());
    }

    #[test]
    fn streams_are_independent() {
        let dir = tempfile::tempdir().unwrap();
        let registry = StreamRegistry::default();
        let a = registry.begin(&dir.path().join("a.json")).unwrap();
        let b = registry.begin(&dir.path().join("b.json")).unwrap();
        assert_ne!(a, b);
        registry.append(a, b"A").unwrap();
        registry.append(b, b"B").unwrap();
        registry.finish(b).unwrap();
        registry.finish(a).unwrap();
        assert_eq!(fs::read(dir.path().join("a.json")).unwrap(), b"A");
        assert_eq!(fs::read(dir.path().join("b.json")).unwrap(), b"B");
    }

    #[test]
    fn finishing_an_unknown_stream_is_an_error() {
        assert!(StreamRegistry::default().finish(42).is_err());
    }
}
