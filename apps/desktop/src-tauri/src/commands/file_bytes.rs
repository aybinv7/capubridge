use std::io::Write;

use adb_client::{server_device::ADBServerDevice, ADBDeviceExt};
use base64::{engine::general_purpose, Engine};
use tauri::ipc::Response;

use crate::blocking::run_blocking;
use crate::commands::adb::get_adb_device;
use crate::commands::files::shell_escape;

const MISSING_FILE: &str = "File not found or is a directory";
const MISSING_MARKER: &str = "__CB_MISSING__";

/// Outcome of the on-device size check that precedes a bounded read.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SizeProbe {
    Missing,
    Size(u64),
    Unknown,
}

fn size_probe_command(path: &str) -> String {
    let escaped = shell_escape(path);
    format!(
        "if [ -f '{escaped}' ]; then stat -L -c %s '{escaped}' 2>/dev/null || wc -c < '{escaped}'; else echo {MISSING_MARKER}; fi"
    )
}

fn parse_size_probe(output: &str) -> SizeProbe {
    let trimmed = output.trim();
    if trimmed.contains(MISSING_MARKER) {
        return SizeProbe::Missing;
    }
    trimmed
        .lines()
        .last()
        .and_then(|line| line.trim().parse::<u64>().ok())
        .map_or(SizeProbe::Unknown, SizeProbe::Size)
}

/// A pull through the adb sync protocol is used only for a non-empty file that
/// fits; everything else (empty-looking `/proc` files, oversized or unknown
/// sizes) is cut on the device with `head -c`.
fn use_sync_pull(probe: SizeProbe, max_bytes: u64) -> bool {
    matches!(probe, SizeProbe::Size(size) if size > 0 && size <= max_bytes)
}

/// Collects at most `limit` bytes and silently drops the rest, so a file that
/// grows during the pull cannot exceed the requested bound.
struct CappedWriter {
    bytes: Vec<u8>,
    limit: usize,
}

impl CappedWriter {
    fn new(limit: usize, expected: usize) -> Self {
        Self {
            bytes: Vec::with_capacity(expected.min(limit)),
            limit,
        }
    }
}

impl Write for CappedWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let room = self.limit.saturating_sub(self.bytes.len());
        self.bytes.extend_from_slice(&buf[..buf.len().min(room)]);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Decodes base64 as it streams in, keeping only the decoded bytes (capped at
/// `limit`) plus fewer than four pending characters.
struct Base64Sink {
    pending: Vec<u8>,
    decoded: Vec<u8>,
    limit: usize,
    failed: Option<String>,
}

impl Base64Sink {
    fn new(limit: usize) -> Self {
        Self {
            pending: Vec::with_capacity(1024),
            decoded: Vec::with_capacity(limit.min(1 << 20)),
            limit,
            failed: None,
        }
    }

    fn decode_complete_groups(&mut self) {
        let complete = self.pending.len() / 4 * 4;
        if complete == 0 || self.failed.is_some() {
            return;
        }
        match general_purpose::STANDARD.decode(&self.pending[..complete]) {
            Ok(chunk) => {
                let room = self.limit.saturating_sub(self.decoded.len());
                self.decoded
                    .extend_from_slice(&chunk[..chunk.len().min(room)]);
            }
            Err(error) => self.failed = Some(format!("Decode failed: {error}")),
        }
        self.pending.drain(..complete);
    }

    fn finish(mut self) -> Result<Vec<u8>, String> {
        self.decode_complete_groups();
        if let Some(error) = self.failed {
            return Err(error);
        }
        if !self.pending.is_empty() {
            return Err("Decode failed: truncated base64 stream".to_string());
        }
        Ok(self.decoded)
    }
}

impl Write for Base64Sink {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.pending.extend(
            buf.iter()
                .copied()
                .filter(|byte| !byte.is_ascii_whitespace()),
        );
        if self.pending.len() >= 4096 {
            self.decode_complete_groups();
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn shell_text(device: &mut ADBServerDevice, command: &str) -> Result<String, String> {
    let mut out = Vec::new();
    device
        .shell_command(&command, Some(&mut out), None::<&mut dyn Write>)
        .map_err(|e| format!("Shell command failed: {e}"))?;
    Ok(String::from_utf8_lossy(&out).to_string())
}

fn read_head_via_shell(
    device: &mut ADBServerDevice,
    path: &str,
    limit: usize,
) -> Result<Vec<u8>, String> {
    let command = format!(
        "head -c {limit} '{}' 2>/dev/null | base64",
        shell_escape(path)
    );
    let mut sink = Base64Sink::new(limit);
    device
        .shell_command(&command, Some(&mut sink), None::<&mut dyn Write>)
        .map_err(|e| format!("Shell command failed: {e}"))?;
    sink.finish()
}

fn read_file_head(serial: &str, path: &str, max_bytes: u64) -> Result<Vec<u8>, String> {
    let limit = usize::try_from(max_bytes).unwrap_or(usize::MAX);
    let mut device = get_adb_device(serial)?;
    let probe = parse_size_probe(&shell_text(&mut device, &size_probe_command(path))?);
    if probe == SizeProbe::Missing {
        return Err(MISSING_FILE.to_string());
    }
    if limit == 0 {
        return Ok(Vec::new());
    }
    if use_sync_pull(probe, max_bytes) {
        let expected = match probe {
            SizeProbe::Size(size) => usize::try_from(size).unwrap_or(limit),
            SizeProbe::Missing | SizeProbe::Unknown => 0,
        };
        let mut writer = CappedWriter::new(limit, expected);
        if device.pull(&path, &mut writer).is_ok() {
            return Ok(writer.bytes);
        }
    }
    read_head_via_shell(&mut device, path, limit)
}

/// Reads at most `max_bytes` from the start of a device file and returns them
/// as raw bytes over binary IPC (an `ArrayBuffer` in JS), never base64 JSON.
#[tauri::command]
pub async fn adb_read_file_bytes(
    serial: String,
    path: String,
    max_bytes: u64,
) -> Result<Response, String> {
    let bytes = run_blocking(move || read_file_head(&serial, &path, max_bytes)).await??;
    Ok(Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_probe_reads_size_missing_and_garbage() {
        assert_eq!(parse_size_probe("1234\n"), SizeProbe::Size(1234));
        assert_eq!(parse_size_probe("  42  \r\n"), SizeProbe::Size(42));
        assert_eq!(
            parse_size_probe(&format!("{MISSING_MARKER}\n")),
            SizeProbe::Missing
        );
        assert_eq!(parse_size_probe("stat: bad\n"), SizeProbe::Unknown);
        assert_eq!(parse_size_probe(""), SizeProbe::Unknown);
    }

    #[test]
    fn size_probe_command_quotes_the_path() {
        let command = size_probe_command("/sdcard/it's.txt");
        assert!(command.contains("[ -f '/sdcard/it'\\''s.txt' ]"));
        assert!(command.contains(MISSING_MARKER));
    }

    #[test]
    fn sync_pull_only_for_non_empty_files_that_fit() {
        assert!(use_sync_pull(SizeProbe::Size(10), 10));
        assert!(!use_sync_pull(SizeProbe::Size(11), 10));
        assert!(!use_sync_pull(SizeProbe::Size(0), 10));
        assert!(!use_sync_pull(SizeProbe::Unknown, 10));
    }

    #[test]
    fn capped_writer_never_exceeds_limit() {
        let mut writer = CappedWriter::new(5, 100);
        assert_eq!(writer.write(b"abc").unwrap(), 3);
        assert_eq!(writer.write(b"defgh").unwrap(), 5);
        assert_eq!(writer.bytes, b"abcde");
    }

    #[test]
    fn base64_sink_decodes_across_chunk_and_line_boundaries() {
        let payload: Vec<u8> = (0..=255u8).cycle().take(10_000).collect();
        let encoded = general_purpose::STANDARD.encode(&payload);
        let wrapped: String = encoded
            .as_bytes()
            .chunks(76)
            .map(|line| format!("{}\n", std::str::from_utf8(line).unwrap()))
            .collect();
        let mut sink = Base64Sink::new(payload.len());
        for chunk in wrapped.as_bytes().chunks(333) {
            sink.write_all(chunk).unwrap();
        }
        assert_eq!(sink.finish().unwrap(), payload);
    }

    #[test]
    fn base64_sink_caps_and_rejects_garbage() {
        let mut capped = Base64Sink::new(3);
        capped.write_all(b"aGVsbG8gd29ybGQ=\n").unwrap();
        assert_eq!(capped.finish().unwrap(), b"hel");

        let mut broken = Base64Sink::new(10);
        broken.write_all(b"@@@@").unwrap();
        assert!(broken.finish().is_err());

        let mut cut = Base64Sink::new(10);
        cut.write_all(b"aGVsbG8").unwrap();
        assert!(cut.finish().is_err());
    }
}
