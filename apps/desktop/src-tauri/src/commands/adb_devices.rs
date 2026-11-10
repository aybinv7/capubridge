//! Lists and tracks the devices the local adb server knows, without trusting a serial to be one
//! word. A Wi-Fi phone found over mDNS is listed under its service name, which may hold spaces:
//! Windows renames a clashing name to `adb-<serial>-<id> (2)._adb-tls-connect._tcp`. One such
//! line used to fail the whole list, which read as "the ADB server is down" while it was running.

use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use crate::adb_runtime::ADB_HOST;
use crate::commands::wireless::adb_host::{
    frame_request, read_length_prefixed, read_reply, request, HostError,
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const QUERY_TIMEOUT: Duration = Duration::from_secs(4);

/// Every state adb prints after a serial. `no permissions` is two words and carries a reason.
const STATES: &[&str] = &[
    "device",
    "offline",
    "unauthorized",
    "authorizing",
    "connecting",
    "bootloader",
    "recovery",
    "rescue",
    "sideload",
    "host",
    "detached",
    "unknown",
    "no",
];

/// One line of `host:devices-l`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub(crate) struct ListedDevice {
    pub serial: String,
    pub state: String,
    pub product: Option<String>,
    pub model: Option<String>,
    pub transport_id: Option<String>,
}

fn is_state(word: &str) -> bool {
    STATES.contains(&word)
}

fn field<'a>(details: &[&'a str], key: &str) -> Option<&'a str> {
    details
        .iter()
        .find_map(|word| word.strip_prefix(key)?.strip_prefix(':'))
        .filter(|value| !value.is_empty())
}

/// Parses one `host:devices-l` line: the serial (spaces allowed), its state, then `key:value`
/// details. The state is the first word after the serial that is a known state and is followed
/// only by details, so a state word inside a service name is not mistaken for it.
pub(crate) fn parse_device_line(line: &str) -> Option<ListedDevice> {
    let line = line.trim_end_matches(['\r', '\n']);
    if line.trim().is_empty() {
        return None;
    }
    if let Some((serial, rest)) = line.rsplit_once('\t') {
        let mut words = rest.split_whitespace();
        let state = words.next()?.to_string();
        let details: Vec<&str> = words.collect();
        return Some(device(serial.trim(), state, &details));
    }

    let words: Vec<(usize, &str)> = line
        .split_whitespace()
        .map(|word| (word.as_ptr() as usize - line.as_ptr() as usize, word))
        .collect();
    let state_at = (1..words.len()).find(|&index| {
        let (_, word) = words[index];
        is_state(word)
            && (word == "no"
                || words[index + 1..]
                    .iter()
                    .all(|(_, detail)| detail.contains(':')))
    })?;
    let serial = line[..words[state_at].0].trim();
    let state = if words[state_at].1 == "no" {
        "no permissions".to_string()
    } else {
        words[state_at].1.to_string()
    };
    let details: Vec<&str> = words[state_at + 1..].iter().map(|(_, w)| *w).collect();
    Some(device(serial, state, &details))
}

fn device(serial: &str, state: String, details: &[&str]) -> ListedDevice {
    ListedDevice {
        serial: serial.to_string(),
        state,
        product: field(details, "product").map(str::to_string),
        model: field(details, "model").map(str::to_string),
        transport_id: field(details, "transport_id").map(str::to_string),
    }
}

/// Parses a whole `host:devices-l` (or `host:devices`) reply. A line it cannot read is skipped
/// and logged, never fatal: one odd device must not hide the others.
pub(crate) fn parse_device_list(text: &str) -> Vec<ListedDevice> {
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let parsed = parse_device_line(line);
            if parsed.is_none() {
                log::warn!("[adb_devices] skipped an unreadable device line: {line:?}");
            }
            parsed
        })
        .collect()
}

pub(crate) fn list_devices() -> Result<Vec<ListedDevice>, HostError> {
    request("host:devices-l", QUERY_TIMEOUT).map(|text| parse_device_list(&text))
}

/// Whether the adb server answers at all. Asks its version, so a device it lists oddly can never
/// make a running server look stopped.
pub(crate) fn server_answers() -> bool {
    request("host:version", QUERY_TIMEOUT).is_ok()
}

/// Calls `on_change` with the device list every time adb reports a change, until the server
/// goes away. The first call carries the list as it is now.
pub(crate) fn track_devices(mut on_change: impl FnMut(Vec<ListedDevice>)) -> Result<(), HostError> {
    let mut stream = TcpStream::connect_timeout(&SocketAddr::V4(ADB_HOST), CONNECT_TIMEOUT)
        .map_err(|e| HostError::Unreachable(e.to_string()))?;
    stream
        .set_write_timeout(Some(CONNECT_TIMEOUT))
        .map_err(|e| HostError::Protocol(e.to_string()))?;
    stream
        .write_all(&frame_request("host:track-devices"))
        .map_err(|e| HostError::Protocol(format!("Could not send the request to ADB: {e}")))?;
    on_change(parse_device_list(&read_reply(&mut stream)?));
    loop {
        on_change(parse_device_list(&read_length_prefixed(&mut stream)?));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SPACED: &str = "adb-jbxcinmf75rgbmbq-1cq35M (2)._adb-tls-connect._tcp";

    #[test]
    fn a_serial_with_spaces_and_parentheses_is_read_whole() {
        let line = format!(
            "{SPACED} device product:garnet_global model:23117RA68G device:garnet transport_id:7"
        );
        let parsed = parse_device_line(&line).expect("parsed");
        assert_eq!(parsed.serial, SPACED);
        assert_eq!(parsed.state, "device");
        assert_eq!(parsed.model.as_deref(), Some("23117RA68G"));
        assert_eq!(parsed.transport_id.as_deref(), Some("7"));
    }

    #[test]
    fn padded_usb_and_network_lines_are_read() {
        let usb = parse_device_line(
            "jbxcinmf75rgbmbq       device usb:1-1 product:garnet model:Redmi device:garnet transport_id:3",
        )
        .expect("usb");
        assert_eq!(usb.serial, "jbxcinmf75rgbmbq");
        assert_eq!(usb.product.as_deref(), Some("garnet"));
        let network =
            parse_device_line("192.168.1.20:5555      offline transport_id:9").expect("network");
        assert_eq!(network.serial, "192.168.1.20:5555");
        assert_eq!(network.state, "offline");
    }

    #[test]
    fn short_tab_separated_lines_are_read() {
        let parsed = parse_device_line(&format!("{SPACED}\tunauthorized")).expect("short");
        assert_eq!(parsed.serial, SPACED);
        assert_eq!(parsed.state, "unauthorized");
    }

    #[test]
    fn no_permissions_keeps_its_two_words() {
        let parsed = parse_device_line(
            "0123456789ABCDEF       no permissions (missing udev rules?); see [http://x]; usb:1-2 transport_id:4",
        )
        .expect("parsed");
        assert_eq!(parsed.serial, "0123456789ABCDEF");
        assert_eq!(parsed.state, "no permissions");
        assert_eq!(parsed.transport_id.as_deref(), Some("4"));
    }

    #[test]
    fn a_state_word_inside_a_name_is_not_the_state() {
        let parsed =
            parse_device_line("adb-a-b (device 2)._adb-tls-connect._tcp device transport_id:5")
                .expect("parsed");
        assert_eq!(parsed.serial, "adb-a-b (device 2)._adb-tls-connect._tcp");
        assert_eq!(parsed.state, "device");
    }

    #[test]
    fn an_unreadable_line_is_skipped_and_the_others_kept() {
        let text = format!(
            "jbxcinmf75rgbmbq       device transport_id:3\n\
             garbage\n\
             {SPACED} device transport_id:7\n"
        );
        let serials: Vec<String> = parse_device_list(&text)
            .into_iter()
            .map(|device| device.serial)
            .collect();
        assert_eq!(
            serials,
            vec!["jbxcinmf75rgbmbq".to_string(), SPACED.to_string()]
        );
    }

    #[test]
    #[ignore = "needs a running adb server; read-only"]
    fn live_adb_server_lists_devices() {
        assert!(server_answers());
        let devices = list_devices().unwrap_or_else(|e| panic!("{e}"));
        println!("{devices:#?}");
    }
}
