use std::fmt;
use std::io::{Read, Write};
use std::net::{SocketAddr, SocketAddrV4, TcpStream};
use std::time::Duration;

use crate::adb_runtime::ADB_HOST;

use super::mdns_services::{parse_mdns_services, MdnsService};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const QUERY_TIMEOUT: Duration = Duration::from_secs(4);
const PAIR_TIMEOUT: Duration = Duration::from_secs(20);
const DEVICE_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_REPLY_BYTES: usize = 1 << 20;

/// Why a request to the local adb server did not produce a reply.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum HostError {
    /// The adb server is not listening.
    Unreachable(String),
    /// The server answered `FAIL` with this message.
    Failed(String),
    /// The reply did not follow the protocol, or timed out.
    Protocol(String),
}

impl fmt::Display for HostError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unreachable(detail) => write!(f, "The ADB server is not running ({detail})"),
            Self::Failed(detail) | Self::Protocol(detail) => f.write_str(detail),
        }
    }
}

/// Sends one host service request (`host:…`) on its own connection, so slow requests such as
/// pairing never hold the shared adb client lock.
pub(crate) fn request(service: &str, timeout: Duration) -> Result<String, HostError> {
    let mut stream = TcpStream::connect_timeout(&SocketAddr::V4(ADB_HOST), CONNECT_TIMEOUT)
        .map_err(|e| HostError::Unreachable(e.to_string()))?;
    stream
        .set_read_timeout(Some(timeout))
        .and_then(|()| stream.set_write_timeout(Some(CONNECT_TIMEOUT)))
        .map_err(|e| HostError::Protocol(e.to_string()))?;
    stream
        .write_all(&frame_request(service))
        .map_err(|e| HostError::Protocol(format!("Could not send the request to ADB: {e}")))?;
    read_reply(&mut stream)
}

pub(crate) fn frame_request(service: &str) -> Vec<u8> {
    format!("{:04x}{service}", service.len()).into_bytes()
}

/// Reads `OKAY`/`FAIL` followed by a hex-length-prefixed message.
pub(crate) fn read_reply(reader: &mut impl Read) -> Result<String, HostError> {
    let mut status = [0u8; 4];
    reader
        .read_exact(&mut status)
        .map_err(|e| HostError::Protocol(format!("ADB did not answer: {e}")))?;
    let message = read_length_prefixed(reader)?;
    match &status {
        b"OKAY" => Ok(message),
        b"FAIL" => Err(HostError::Failed(message)),
        other => Err(HostError::Protocol(format!(
            "Unexpected ADB reply {}",
            String::from_utf8_lossy(other)
        ))),
    }
}

pub(crate) fn read_length_prefixed(reader: &mut impl Read) -> Result<String, HostError> {
    let mut length = [0u8; 4];
    reader
        .read_exact(&mut length)
        .map_err(|e| HostError::Protocol(format!("ADB reply was cut short: {e}")))?;
    let length = std::str::from_utf8(&length)
        .ok()
        .and_then(|hex| usize::from_str_radix(hex, 16).ok())
        .filter(|length| *length <= MAX_REPLY_BYTES)
        .ok_or_else(|| HostError::Protocol("ADB reply had an invalid length".to_string()))?;
    let mut body = vec![0u8; length];
    reader
        .read_exact(&mut body)
        .map_err(|e| HostError::Protocol(format!("ADB reply was cut short: {e}")))?;
    Ok(String::from_utf8_lossy(&body).into_owned())
}

/// Whether the adb server's own mDNS discovery runs, and what it reported.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MdnsCheck {
    pub available: bool,
    pub detail: String,
}

pub(crate) fn classify_mdns_check(
    reply: Result<String, HostError>,
) -> Result<MdnsCheck, HostError> {
    match reply {
        Ok(text) => Ok(MdnsCheck {
            available: text.trim_start().starts_with("mdns daemon version"),
            detail: text.trim().to_string(),
        }),
        Err(HostError::Failed(text)) => Ok(MdnsCheck {
            available: false,
            detail: text.trim().to_string(),
        }),
        Err(error) => Err(error),
    }
}

pub(crate) fn mdns_check() -> Result<MdnsCheck, HostError> {
    classify_mdns_check(request("host:mdns:check", QUERY_TIMEOUT))
}

pub(crate) fn mdns_services() -> Result<Vec<MdnsService>, HostError> {
    request("host:mdns:services", QUERY_TIMEOUT).map(|text| parse_mdns_services(&text))
}

/// How a pairing attempt failed, in terms the panel can explain.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PairError {
    /// The phone answered but refused the password or code.
    Rejected(String),
    /// The phone could not be reached at its pairing address.
    Unreachable(String),
    /// The adb server itself is down.
    AdbUnavailable(String),
}

/// Reads the reply to `host:pair`. adb answers `OKAY` even when pairing failed, so success is
/// decided by the text: `Successfully paired to <addr> [guid=<guid>]`.
pub(crate) fn classify_pair_reply(
    reply: Result<String, HostError>,
) -> Result<Option<String>, PairError> {
    let text = match reply {
        Ok(text) | Err(HostError::Failed(text)) => text,
        Err(HostError::Unreachable(detail)) => return Err(PairError::AdbUnavailable(detail)),
        Err(HostError::Protocol(detail)) => return Err(PairError::Unreachable(detail)),
    };
    let trimmed = text.trim();
    if trimmed.contains("Successfully paired") {
        return Ok(parse_guid(trimmed));
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("wrong password") || lower.contains("protocol fault") {
        return Err(PairError::Rejected(trimmed.to_string()));
    }
    if lower.contains("unable to start pairing client")
        || lower.contains("failed to connect")
        || lower.contains("connection refused")
        || lower.contains("timed out")
        || lower.contains("unreachable")
    {
        return Err(PairError::Unreachable(trimmed.to_string()));
    }
    Err(PairError::Rejected(if trimmed.is_empty() {
        "The phone did not confirm the pairing".to_string()
    } else {
        trimmed.to_string()
    }))
}

fn parse_guid(text: &str) -> Option<String> {
    let start = text.find("[guid=")? + "[guid=".len();
    let end = text[start..].find(']')? + start;
    let guid = text[start..end].trim();
    (!guid.is_empty()).then(|| guid.to_string())
}

/// Pairs with a phone. The secret goes only into the request; it never appears in an error.
pub(crate) fn pair(address: SocketAddrV4, secret: &str) -> Result<Option<String>, PairError> {
    classify_pair_reply(request(
        &format!("host:pair:{secret}:{address}"),
        PAIR_TIMEOUT,
    ))
}

/// Reads the reply to `host:connect`, which is also `OKAY` when the connection failed.
pub(crate) fn classify_connect_reply(reply: Result<String, HostError>) -> Result<(), String> {
    let text = reply.map_err(|error| error.to_string())?;
    let trimmed = text.trim();
    if trimmed.starts_with("connected to") || trimmed.starts_with("already connected to") {
        Ok(())
    } else if trimmed.is_empty() {
        Err("ADB did not confirm the connection".to_string())
    } else {
        Err(trimmed.to_string())
    }
}

pub(crate) fn connect(address: SocketAddrV4) -> Result<(), String> {
    classify_connect_reply(request(
        &format!("host:connect:{address}"),
        DEVICE_CONNECT_TIMEOUT,
    ))
}

/// Reads the reply to `host:disconnect:<serial>`: `disconnected <serial>` on success; an unknown
/// serial is a `FAIL` (`no such device`), which also leaves it disconnected.
pub(crate) fn classify_disconnect_reply(reply: Result<String, HostError>) -> Result<(), String> {
    match reply {
        Ok(text) if text.trim().starts_with("disconnected") => Ok(()),
        Ok(text) => Err(if text.trim().is_empty() {
            "ADB did not confirm the disconnection".to_string()
        } else {
            text.trim().to_string()
        }),
        Err(HostError::Failed(text)) if text.contains("no such device") => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

/// Disconnects a Wi-Fi device by its adb serial: `ip:port` or an mDNS serial.
pub(crate) fn disconnect(serial: &str) -> Result<(), String> {
    classify_disconnect_reply(request(&format!("host:disconnect:{serial}"), QUERY_TIMEOUT))
}

/// Serials adb lists as usable (`device` state), from `host:devices`. A serial may hold spaces.
pub(crate) fn parse_online_serials(text: &str) -> Vec<String> {
    crate::commands::adb_devices::parse_device_list(text)
        .into_iter()
        .filter(|device| device.state == "device")
        .map(|device| device.serial)
        .collect()
}

pub(crate) fn online_serials() -> Result<Vec<String>, HostError> {
    request("host:devices", QUERY_TIMEOUT).map(|text| parse_online_serials(&text))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn reply(status: &str, body: &str) -> Cursor<Vec<u8>> {
        Cursor::new(format!("{status}{:04x}{body}", body.len()).into_bytes())
    }

    #[test]
    fn frames_requests_with_a_hex_length() {
        assert_eq!(
            frame_request("host:mdns:check"),
            b"000fhost:mdns:check".to_vec()
        );
    }

    #[test]
    fn reads_okay_and_fail_replies() {
        assert_eq!(
            read_reply(&mut reply("OKAY", "hello")),
            Ok("hello".to_string())
        );
        assert_eq!(
            read_reply(&mut reply("FAIL", "no")),
            Err(HostError::Failed("no".to_string()))
        );
        assert!(matches!(
            read_reply(&mut Cursor::new(b"OKAYzzzz".to_vec())),
            Err(HostError::Protocol(_))
        ));
        assert!(matches!(
            read_reply(&mut Cursor::new(b"OKAY0010short".to_vec())),
            Err(HostError::Protocol(_))
        ));
    }

    #[test]
    fn mdns_check_reads_the_daemon_version() {
        let available =
            classify_mdns_check(Ok("mdns daemon version [adb discovery 0.0.0]\n".to_string()));
        assert_eq!(available.map(|c| c.available), Ok(true));
        let disabled = classify_mdns_check(Err(HostError::Failed(
            "mdns daemon unavailable".to_string(),
        )));
        assert_eq!(disabled.map(|c| c.available), Ok(false));
        assert!(classify_mdns_check(Err(HostError::Unreachable("refused".to_string()))).is_err());
    }

    #[test]
    fn pair_success_carries_the_guid() {
        let result = classify_pair_reply(Ok(
            "Successfully paired to 192.168.1.20:37099 [guid=adb-R5CR10ABCDE-Xy12Ab]".to_string(),
        ));
        assert_eq!(result, Ok(Some("adb-R5CR10ABCDE-Xy12Ab".to_string())));
        assert_eq!(
            classify_pair_reply(Ok("Successfully paired to 10.0.0.2:1".to_string())),
            Ok(None)
        );
    }

    #[test]
    fn pair_failures_are_classified_even_on_okay() {
        assert!(matches!(
            classify_pair_reply(Ok(
                "Failed: Wrong password or connection was dropped.".into()
            )),
            Err(PairError::Rejected(_))
        ));
        assert!(matches!(
            classify_pair_reply(Ok("Failed: Unable to start pairing client.".into())),
            Err(PairError::Unreachable(_))
        ));
        assert!(matches!(
            classify_pair_reply(Err(HostError::Unreachable("refused".into()))),
            Err(PairError::AdbUnavailable(_))
        ));
        assert!(matches!(
            classify_pair_reply(Ok(String::new())),
            Err(PairError::Rejected(_))
        ));
    }

    #[test]
    fn connect_success_and_failure_both_arrive_as_okay() {
        assert_eq!(
            classify_connect_reply(Ok("connected to 10.0.0.2:5555".into())),
            Ok(())
        );
        assert_eq!(
            classify_connect_reply(Ok("already connected to 10.0.0.2:5555".into())),
            Ok(())
        );
        assert!(classify_connect_reply(Ok("failed to connect to '10.0.0.2:5555'".into())).is_err());
        assert!(
            classify_connect_reply(Ok("failed to authenticate to 10.0.0.2:5555".into())).is_err()
        );
        assert!(classify_connect_reply(Ok(String::new())).is_err());
    }

    #[test]
    fn disconnect_accepts_success_and_an_already_gone_device() {
        assert_eq!(
            classify_disconnect_reply(Ok("disconnected adb-R5CR-Xy._adb-tls-connect._tcp".into())),
            Ok(())
        );
        assert_eq!(
            classify_disconnect_reply(Err(HostError::Failed("no such device 'x'".into()))),
            Ok(())
        );
        assert!(classify_disconnect_reply(Ok("error: something".into())).is_err());
        assert!(classify_disconnect_reply(Err(HostError::Unreachable("refused".into()))).is_err());
    }

    #[test]
    fn online_serials_skip_offline_and_unauthorized() {
        let text = "r4geda5p7d65u8uo\tdevice\n\
            adb-R5CR-Xy._adb-tls-connect._tcp\tdevice\n\
            10.0.0.2:5555\toffline\n\
            emulator-5554\tunauthorized\n\
            adb-R5CR-Xy (2)._adb-tls-connect._tcp\tdevice\n";
        assert_eq!(
            parse_online_serials(text),
            vec![
                "r4geda5p7d65u8uo".to_string(),
                "adb-R5CR-Xy._adb-tls-connect._tcp".to_string(),
                "adb-R5CR-Xy (2)._adb-tls-connect._tcp".to_string()
            ]
        );
    }

    #[test]
    #[ignore = "needs a running adb server; read-only"]
    fn live_adb_server_answers_mdns_queries() {
        let check = mdns_check().unwrap_or_else(|e| panic!("{e}"));
        println!(
            "mdns check: available={} detail={}",
            check.available, check.detail
        );
        let services = mdns_services().unwrap_or_else(|e| panic!("{e}"));
        println!("mdns services: {}", services.len());
        let serials = online_serials().unwrap_or_else(|e| panic!("{e}"));
        println!("online devices: {}", serials.len());
    }
}
