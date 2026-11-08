use serde::Serialize;
use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddrV4};

pub(crate) const PAIRING_SERVICE_TYPE: &str = "_adb-tls-pairing._tcp";
pub(crate) const CONNECT_SERVICE_TYPE: &str = "_adb-tls-connect._tcp";
pub(crate) const LEGACY_SERVICE_TYPE: &str = "_adb._tcp";

/// The three service types adbd advertises over mDNS.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MdnsServiceKind {
    Pairing,
    Connect,
    Legacy,
}

impl MdnsServiceKind {
    /// Maps a registration type (`_adb-tls-pairing._tcp`, with or without a trailing
    /// `.local.` or dot) to its kind; other services are not adb's.
    pub(crate) fn from_reg_type(value: &str) -> Option<Self> {
        let trimmed = value.trim().trim_end_matches('.');
        let trimmed = trimmed.strip_suffix(".local").unwrap_or(trimmed);
        match trimmed {
            PAIRING_SERVICE_TYPE => Some(Self::Pairing),
            CONNECT_SERVICE_TYPE => Some(Self::Connect),
            LEGACY_SERVICE_TYPE => Some(Self::Legacy),
            _ => None,
        }
    }
}

/// One adb service seen on the network: its instance name, kind and IPv4 address.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsService {
    pub name: String,
    pub kind: MdnsServiceKind,
    pub host: Ipv4Addr,
    pub port: u16,
}

impl MdnsService {
    pub(crate) fn address(&self) -> SocketAddrV4 {
        SocketAddrV4::new(self.host, self.port)
    }
}

const SERVICES_HEADER: &str = "List of discovered mdns services";

/// Parses `adb mdns services` (or the raw `host:mdns:services` payload, which has no header).
/// Each line is `name<TAB>type<TAB>ip:port`; unknown types, IPv6 addresses and malformed
/// lines are skipped rather than failing the whole list, and a service seen twice keeps its
/// latest address.
pub(crate) fn parse_mdns_services(output: &str) -> Vec<MdnsService> {
    let mut order: Vec<(MdnsServiceKind, String)> = Vec::new();
    let mut services: HashMap<(MdnsServiceKind, String), MdnsService> = HashMap::new();
    for line in output.lines() {
        let Some(service) = parse_service_line(line) else {
            continue;
        };
        let key = (service.kind, service.name.clone());
        if !services.contains_key(&key) {
            order.push(key.clone());
        }
        services.insert(key, service);
    }
    order
        .into_iter()
        .filter_map(|key| services.remove(&key))
        .collect()
}

fn parse_service_line(line: &str) -> Option<MdnsService> {
    let line = line.trim();
    if line.is_empty() || line.starts_with(SERVICES_HEADER) {
        return None;
    }
    let fields: Vec<&str> = if line.contains('\t') {
        line.split('\t')
            .map(str::trim)
            .filter(|f| !f.is_empty())
            .collect()
    } else {
        line.split_whitespace().collect()
    };
    let name = fields.first()?.trim_end_matches('.');
    if name.is_empty() {
        return None;
    }
    let kind = fields
        .iter()
        .skip(1)
        .find_map(|f| MdnsServiceKind::from_reg_type(f))?;
    let address = fields
        .iter()
        .skip(1)
        .find_map(|f| f.parse::<SocketAddrV4>().ok())?;
    Some(MdnsService {
        name: name.to_string(),
        kind,
        host: *address.ip(),
        port: address.port(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cli_output_with_header() {
        let output = "List of discovered mdns services\n\
            adb-R5CR10ABCDE-Xy12Ab\t_adb-tls-connect._tcp\t192.168.1.20:41235\n\
            studio-AbCdEf1234\t_adb-tls-pairing._tcp\t192.168.1.20:37099\n\n";
        let services = parse_mdns_services(output);
        assert_eq!(services.len(), 2);
        assert_eq!(services[0].name, "adb-R5CR10ABCDE-Xy12Ab");
        assert_eq!(services[0].kind, MdnsServiceKind::Connect);
        assert_eq!(services[0].host, Ipv4Addr::new(192, 168, 1, 20));
        assert_eq!(services[0].port, 41235);
        assert_eq!(services[1].kind, MdnsServiceKind::Pairing);
        assert_eq!(services[1].address().to_string(), "192.168.1.20:37099");
    }

    #[test]
    fn empty_list_has_only_the_header() {
        assert!(parse_mdns_services("List of discovered mdns services\n\n").is_empty());
        assert!(parse_mdns_services("").is_empty());
    }

    #[test]
    fn accepts_trailing_dots_and_local_domain() {
        let services =
            parse_mdns_services("adb-1-a.\t_adb-tls-pairing._tcp.local.\t10.0.0.5:5555\n");
        assert_eq!(services[0].name, "adb-1-a");
        assert_eq!(services[0].kind, MdnsServiceKind::Pairing);
    }

    #[test]
    fn accepts_space_separated_columns_and_crlf() {
        let services = parse_mdns_services("adb-2-b  _adb._tcp  10.0.0.6:5555\r\n");
        assert_eq!(services[0].kind, MdnsServiceKind::Legacy);
        assert_eq!(services[0].port, 5555);
    }

    #[test]
    fn skips_unknown_types_ipv6_and_garbage() {
        let output = "printer\t_ipp._tcp\t10.0.0.9:631\n\
            adb-3-c\t_adb-tls-connect._tcp\t[fe80::1]:5555\n\
            nonsense\n\
            adb-4-d\t_adb-tls-connect._tcp\t10.0.0.7:not-a-port\n";
        assert!(parse_mdns_services(output).is_empty());
    }

    #[test]
    fn a_service_seen_twice_keeps_its_latest_address() {
        let output = "adb-5-e\t_adb-tls-connect._tcp\t10.0.0.8:4000\n\
            adb-5-e\t_adb-tls-connect._tcp\t10.0.0.8:4001\n\
            adb-5-e\t_adb-tls-pairing._tcp\t10.0.0.8:4002\n";
        let services = parse_mdns_services(output);
        assert_eq!(services.len(), 2);
        assert_eq!(services[0].port, 4001);
        assert_eq!(services[1].kind, MdnsServiceKind::Pairing);
    }

    #[test]
    fn serializes_for_the_frontend() {
        let service = parse_mdns_services("adb-6-f\t_adb-tls-connect._tcp\t10.0.0.9:4100\n");
        let json = serde_json::to_value(&service[0]).unwrap_or_default();
        assert_eq!(json["kind"], "connect");
        assert_eq!(json["host"], "10.0.0.9");
        assert_eq!(json["port"], 4100);
    }
}
