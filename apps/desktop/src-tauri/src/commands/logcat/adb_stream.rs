use std::io::{ErrorKind, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use crate::adb_runtime::ADB_HOST;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(5);

/// A long-running shell command on a device, read straight from the adb
/// server's socket. Dropping it closes the socket, which ends the command on
/// the device.
pub(crate) struct AdbShellStream {
    stream: TcpStream,
}

/// What one read produced.
pub(crate) enum StreamRead {
    Data(usize),
    /// Nothing arrived within the poll interval.
    Idle,
    /// The command ended or the connection closed.
    Closed,
}

fn send_request(stream: &mut TcpStream, payload: &str) -> Result<(), String> {
    let request = format!("{:04x}{payload}", payload.len());
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("adb request failed: {error}"))
}

fn read_status(stream: &mut TcpStream) -> Result<(), String> {
    let mut status = [0u8; 4];
    stream
        .read_exact(&mut status)
        .map_err(|error| format!("adb did not answer: {error}"))?;
    if &status == b"OKAY" {
        return Ok(());
    }
    if &status != b"FAIL" {
        return Err(format!(
            "adb answered {:?}",
            String::from_utf8_lossy(&status)
        ));
    }
    let mut length = [0u8; 4];
    stream
        .read_exact(&mut length)
        .map_err(|error| format!("adb failed without a reason: {error}"))?;
    let length = usize::from_str_radix(&String::from_utf8_lossy(&length), 16).unwrap_or(0);
    let mut message = vec![0u8; length.min(4096)];
    stream
        .read_exact(&mut message)
        .map_err(|error| format!("adb failed without a reason: {error}"))?;
    Err(String::from_utf8_lossy(&message).into_owned())
}

impl AdbShellStream {
    /// Starts `command` on `serial` and returns its output stream. Reads time
    /// out after `poll_interval`, so the reader can flush and check for stop.
    pub fn open(serial: &str, command: &str, poll_interval: Duration) -> Result<Self, String> {
        let address = SocketAddr::V4(ADB_HOST);
        let mut stream = TcpStream::connect_timeout(&address, CONNECT_TIMEOUT)
            .map_err(|error| format!("Could not reach the adb server: {error}"))?;
        stream
            .set_read_timeout(Some(HANDSHAKE_TIMEOUT))
            .map_err(|error| error.to_string())?;
        stream
            .set_write_timeout(Some(HANDSHAKE_TIMEOUT))
            .map_err(|error| error.to_string())?;
        let _ = stream.set_nodelay(true);

        send_request(&mut stream, &format!("host:transport:{serial}"))?;
        read_status(&mut stream)?;
        send_request(&mut stream, &format!("shell:{command}"))?;
        read_status(&mut stream)?;

        stream
            .set_read_timeout(Some(poll_interval))
            .map_err(|error| error.to_string())?;
        Ok(Self { stream })
    }

    /// Reads what is available into `buffer`.
    pub fn read(&mut self, buffer: &mut [u8]) -> Result<StreamRead, String> {
        match self.stream.read(buffer) {
            Ok(0) => Ok(StreamRead::Closed),
            Ok(count) => Ok(StreamRead::Data(count)),
            Err(error) if matches!(error.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {
                Ok(StreamRead::Idle)
            }
            Err(error) if error.kind() == ErrorKind::Interrupted => Ok(StreamRead::Idle),
            Err(error) => Err(format!("The logcat stream broke: {error}")),
        }
    }
}

/// Splits a byte stream into lines, keeping a partial last line for the next chunk.
#[derive(Debug, Default)]
pub(crate) struct LineSplitter {
    partial: Vec<u8>,
}

impl LineSplitter {
    /// Appends `chunk` and calls `on_line` for every complete line in it.
    pub fn feed(&mut self, chunk: &[u8], mut on_line: impl FnMut(&str)) {
        let mut start = 0;
        for (index, byte) in chunk.iter().enumerate() {
            if *byte != b'\n' {
                continue;
            }
            if self.partial.is_empty() {
                on_line(&String::from_utf8_lossy(&chunk[start..index]));
            } else {
                self.partial.extend_from_slice(&chunk[start..index]);
                let line = std::mem::take(&mut self.partial);
                on_line(&String::from_utf8_lossy(&line));
            }
            start = index + 1;
        }
        self.partial.extend_from_slice(&chunk[start..]);
    }

    /// Drops a partial line left by a closed stream.
    pub fn reset(&mut self) {
        self.partial.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_lines_across_chunks_and_keeps_utf8_intact() {
        let mut splitter = LineSplitter::default();
        let mut lines = Vec::new();
        let text = "first\r\nsecond caf\u{e9}\nthird".as_bytes();
        splitter.feed(&text[..8], |line| lines.push(line.to_string()));
        splitter.feed(&text[8..18], |line| lines.push(line.to_string()));
        splitter.feed(&text[18..], |line| lines.push(line.to_string()));
        assert_eq!(lines, vec!["first\r", "second caf\u{e9}"]);
        splitter.feed(b"\n", |line| lines.push(line.to_string()));
        assert_eq!(lines.last().map(String::as_str), Some("third"));
    }
}
