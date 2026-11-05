use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

/// The local port each device DevTools socket was last forwarded to. Reusing it keeps a target's
/// address stable across scans, so the app does not see a "new" target, reset its link state and
/// flicker between live and not live, and adb does not collect one forward per scan.
static FORWARDED_PORTS: LazyLock<Mutex<HashMap<(String, String), u16>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub(crate) fn remembered_port(serial: &str, socket: &str) -> Option<u16> {
    FORWARDED_PORTS
        .lock()
        .ok()?
        .get(&(serial.to_string(), socket.to_string()))
        .copied()
}

pub(crate) fn remember_port(serial: &str, socket: &str, port: u16) {
    if let Ok(mut ports) = FORWARDED_PORTS.lock() {
        ports.insert((serial.to_string(), socket.to_string()), port);
    }
}

pub(crate) fn forget_port(serial: &str, socket: &str) {
    if let Ok(mut ports) = FORWARDED_PORTS.lock() {
        ports.remove(&(serial.to_string(), socket.to_string()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remembers_one_port_per_device_socket() {
        remember_port("cache-test-a", "webview_devtools_remote_1", 50001);
        remember_port("cache-test-b", "webview_devtools_remote_1", 50002);
        assert_eq!(remembered_port("cache-test-a", "webview_devtools_remote_1"), Some(50001));
        assert_eq!(remembered_port("cache-test-b", "webview_devtools_remote_1"), Some(50002));
        assert_eq!(remembered_port("cache-test-a", "chrome_devtools_remote"), None);
    }

    #[test]
    fn forgets_a_port_that_stopped_answering() {
        remember_port("cache-test-c", "chrome_devtools_remote", 50003);
        forget_port("cache-test-c", "chrome_devtools_remote");
        assert_eq!(remembered_port("cache-test-c", "chrome_devtools_remote"), None);
    }
}
