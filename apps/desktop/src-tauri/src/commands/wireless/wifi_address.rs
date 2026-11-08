use std::net::Ipv4Addr;

use crate::blocking::run_blocking;
use crate::commands::adb::{adb_shell_command_inner, catch_adb_panic};

const WLAN_ADDR_COMMAND: &str = "ip -f inet addr show wlan0";
const ROUTE_COMMAND: &str = "ip route";

/// Reads the address from `ip -f inet addr show wlan0` (`inet 192.168.1.20/24 brd …`).
pub(crate) fn parse_wlan_inet(output: &str) -> Option<Ipv4Addr> {
    output.lines().find_map(|line| {
        let mut fields = line.split_whitespace();
        if fields.next()? != "inet" {
            return None;
        }
        let ip = fields.next()?.split('/').next()?.parse::<Ipv4Addr>().ok()?;
        (!ip.is_loopback() && !ip.is_unspecified()).then_some(ip)
    })
}

/// Reads the `src` address of a Wi-Fi route from `ip route`
/// (`192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.20`). Routes over a
/// `wlan` interface win; mobile data (`rmnet`, `ccmni`) is never chosen.
pub(crate) fn parse_route_src(output: &str) -> Option<Ipv4Addr> {
    output.lines().find_map(|line| {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let device = fields
            .iter()
            .position(|field| *field == "dev")
            .and_then(|index| fields.get(index + 1))?;
        if !device.starts_with("wlan") {
            return None;
        }
        let src = fields
            .iter()
            .position(|field| *field == "src")
            .and_then(|index| fields.get(index + 1))?;
        src.parse::<Ipv4Addr>().ok()
    })
}

fn read_wifi_address(serial: &str) -> Result<Option<Ipv4Addr>, String> {
    let wlan = adb_shell_command_inner(serial, WLAN_ADDR_COMMAND)?;
    if let Some(ip) = parse_wlan_inet(&wlan) {
        return Ok(Some(ip));
    }
    let routes = adb_shell_command_inner(serial, ROUTE_COMMAND)?;
    Ok(parse_route_src(&routes))
}

/// The phone's Wi-Fi IPv4 address read over adb, or `None` when Wi-Fi is off.
#[tauri::command]
pub async fn adb_wifi_address(serial: String) -> Result<Option<String>, String> {
    run_blocking(move || {
        catch_adb_panic("adb_wifi_address", move || {
            read_wifi_address(&serial).map(|ip| ip.map(|ip| ip.to_string()))
        })
    })
    .await?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_wlan0_address() {
        let output =
            "30: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP\n    \
            inet 192.168.1.20/24 brd 192.168.1.255 scope global wlan0\n       \
            valid_lft forever preferred_lft forever\n";
        assert_eq!(
            parse_wlan_inet(output),
            Some(Ipv4Addr::new(192, 168, 1, 20))
        );
    }

    #[test]
    fn wifi_off_has_no_address() {
        assert_eq!(parse_wlan_inet("Device \"wlan0\" does not exist.\n"), None);
        assert_eq!(parse_wlan_inet(""), None);
    }

    #[test]
    fn route_src_prefers_wifi_over_mobile_data() {
        let output = "10.12.0.0/16 dev rmnet_data0 proto kernel scope link src 10.12.4.7\n\
            192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.20\n";
        assert_eq!(
            parse_route_src(output),
            Some(Ipv4Addr::new(192, 168, 1, 20))
        );
        assert_eq!(
            parse_route_src("10.12.0.0/16 dev rmnet_data0 proto kernel scope link src 10.12.4.7\n"),
            None
        );
    }
}
