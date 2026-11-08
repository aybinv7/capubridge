use mdns_sd::{Receiver, ServiceDaemon, ServiceEvent};
use std::collections::HashMap;
use std::net::Ipv4Addr;

use super::mdns_services::{
    MdnsService, MdnsServiceKind, CONNECT_SERVICE_TYPE, PAIRING_SERVICE_TYPE,
};

/// Browses adb's mDNS services directly, for when the adb server's own discovery is off
/// (`ADB_MDNS=0`, or an adb too old to have it). Dropping it stops the daemon thread.
pub(crate) struct NativeBrowser {
    daemon: ServiceDaemon,
    receivers: Vec<Receiver<ServiceEvent>>,
    services: HashMap<String, MdnsService>,
}

impl NativeBrowser {
    pub(crate) fn start() -> Result<Self, String> {
        let daemon =
            ServiceDaemon::new().map_err(|e| format!("Could not start mDNS discovery: {e}"))?;
        let mut receivers = Vec::new();
        for service_type in [PAIRING_SERVICE_TYPE, CONNECT_SERVICE_TYPE] {
            let receiver = daemon
                .browse(&format!("{service_type}.local."))
                .map_err(|e| format!("Could not browse {service_type}: {e}"))?;
            receivers.push(receiver);
        }
        Ok(Self {
            daemon,
            receivers,
            services: HashMap::new(),
        })
    }

    /// Applies every event received since the last call and returns what is currently visible.
    pub(crate) fn services(&mut self) -> Vec<MdnsService> {
        for receiver in &self.receivers {
            while let Ok(event) = receiver.try_recv() {
                match event {
                    ServiceEvent::ServiceResolved(resolved) => {
                        let service = service_from_resolved(
                            &resolved.fullname,
                            &resolved.ty_domain,
                            resolved.get_addresses_v4().into_iter(),
                            resolved.port,
                        );
                        if let Some(service) = service {
                            self.services.insert(resolved.fullname.clone(), service);
                        }
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        self.services.remove(&fullname);
                    }
                    _ => {}
                }
            }
        }
        let mut services: Vec<MdnsService> = self.services.values().cloned().collect();
        services.sort_by(|a, b| a.name.cmp(&b.name));
        services
    }
}

impl Drop for NativeBrowser {
    fn drop(&mut self) {
        if let Err(error) = self.daemon.shutdown() {
            log::warn!("[wireless] mDNS daemon did not shut down cleanly: {error}");
        }
    }
}

/// Builds a service from a resolved record: the instance name is the full name without its
/// `.<type>.local.` suffix; the lowest IPv4 address wins so the choice is stable.
pub(crate) fn service_from_resolved(
    fullname: &str,
    ty_domain: &str,
    addresses: impl Iterator<Item = Ipv4Addr>,
    port: u16,
) -> Option<MdnsService> {
    let kind = MdnsServiceKind::from_reg_type(ty_domain)?;
    let name = fullname
        .strip_suffix(ty_domain)
        .unwrap_or(fullname)
        .trim_end_matches('.');
    if name.is_empty() || port == 0 {
        return None;
    }
    let host = addresses.filter(|ip| !ip.is_loopback()).min()?;
    Some(MdnsService {
        name: name.to_string(),
        kind,
        host,
        port,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolved_records_become_services() {
        let service = service_from_resolved(
            "studio-AbC123xyZ0._adb-tls-pairing._tcp.local.",
            "_adb-tls-pairing._tcp.local.",
            [
                Ipv4Addr::new(192, 168, 1, 30),
                Ipv4Addr::new(192, 168, 1, 20),
            ]
            .into_iter(),
            37099,
        );
        assert_eq!(
            service,
            Some(MdnsService {
                name: "studio-AbC123xyZ0".to_string(),
                kind: MdnsServiceKind::Pairing,
                host: Ipv4Addr::new(192, 168, 1, 20),
                port: 37099,
            })
        );
    }

    #[test]
    fn records_without_ipv4_or_of_other_types_are_ignored() {
        assert!(service_from_resolved(
            "x._adb-tls-connect._tcp.local.",
            "_adb-tls-connect._tcp.local.",
            std::iter::empty(),
            5555
        )
        .is_none());
        assert!(service_from_resolved(
            "x._http._tcp.local.",
            "_http._tcp.local.",
            [Ipv4Addr::new(10, 0, 0, 1)].into_iter(),
            80
        )
        .is_none());
    }
}
