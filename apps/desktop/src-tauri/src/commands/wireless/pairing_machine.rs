use serde::Serialize;
use std::net::{Ipv4Addr, SocketAddrV4};
use std::time::Duration;

use super::adb_host::PairError;
use super::mdns_services::{MdnsService, MdnsServiceKind};

/// How long the QR code waits for the phone to scan it.
pub(crate) const WAIT_TIMEOUT: Duration = Duration::from_secs(180);
/// How long a paired phone has to advertise its connect service and accept the connection.
pub(crate) const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
/// adb connects paired phones it discovers on its own; give it this long before connecting.
pub(crate) const AUTOCONNECT_GRACE: Duration = Duration::from_secs(2);
pub(crate) const CONNECT_RETRY_GAP: Duration = Duration::from_secs(3);
pub(crate) const MAX_CONNECT_ATTEMPTS: u32 = 3;

/// Why a pairing session ended without a connection, in terms the panel can explain.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PairingFailure {
    /// The QR code was never scanned, but other adb phones were visible: discovery works.
    PhoneNotSeen,
    /// Nothing at all was discovered: mDNS is likely blocked (firewall, isolated network).
    NothingDiscovered,
    /// The phone advertised itself but could not be reached (different network, isolation).
    PhoneUnreachable,
    /// The phone refused the password or code.
    PairingRejected,
    /// Paired, but the connection did not come up.
    ConnectFailed,
    /// Neither adb's mDNS nor the native browser could run.
    DiscoveryUnavailable,
    /// The adb server is not running.
    AdbUnavailable,
}

/// The session state streamed to the panel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "phase", rename_all = "camelCase")]
pub enum PairingPhase {
    Waiting,
    Pairing,
    Connecting,
    Connected {
        serial: String,
        guid: Option<String>,
    },
    Failed {
        reason: PairingFailure,
        detail: Option<String>,
    },
}

/// What the driver should do after an observation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PairingAction {
    None,
    Pair(SocketAddrV4),
    Connect(SocketAddrV4),
}

/// The pure pairing flow: wait for the phone's pairing service, pair, then find and connect its
/// connect service. Time is passed in as elapsed durations so it can be tested without clocks.
#[derive(Debug)]
pub(crate) struct PairingMachine {
    service_name: Option<String>,
    phase: PairingPhase,
    pending_pair: Option<SocketAddrV4>,
    saw_any_service: bool,
    pairing_host: Option<Ipv4Addr>,
    guid: Option<String>,
    paired_at: Duration,
    connect_attempts: u32,
    last_connect_at: Option<Duration>,
    last_connect_error: Option<String>,
}

impl PairingMachine {
    fn new(service_name: Option<String>, phase: PairingPhase) -> Self {
        Self {
            service_name,
            phase,
            pending_pair: None,
            saw_any_service: false,
            pairing_host: None,
            guid: None,
            paired_at: Duration::ZERO,
            connect_attempts: 0,
            last_connect_at: None,
            last_connect_error: None,
        }
    }

    /// A QR session: waits for `service_name` to appear as a pairing service.
    pub(crate) fn for_qr(service_name: String) -> Self {
        Self::new(Some(service_name), PairingPhase::Waiting)
    }

    /// A pairing-code session: the address is already known, so it pairs on the first step.
    pub(crate) fn for_code(address: SocketAddrV4) -> Self {
        let mut machine = Self::new(None, PairingPhase::Pairing);
        machine.pending_pair = Some(address);
        machine.pairing_host = Some(*address.ip());
        machine
    }

    pub(crate) fn phase(&self) -> &PairingPhase {
        &self.phase
    }

    pub(crate) fn is_finished(&self) -> bool {
        matches!(
            self.phase,
            PairingPhase::Connected { .. } | PairingPhase::Failed { .. }
        )
    }

    /// Whether the next observation needs the adb device list.
    pub(crate) fn needs_devices(&self) -> bool {
        self.phase == PairingPhase::Connecting
    }

    fn fail(&mut self, reason: PairingFailure, detail: Option<String>) {
        self.phase = PairingPhase::Failed { reason, detail };
    }

    /// One discovery poll: the services visible now and, while connecting, adb's online serials.
    pub(crate) fn observe(
        &mut self,
        elapsed: Duration,
        services: &[MdnsService],
        online_serials: &[String],
    ) -> PairingAction {
        self.saw_any_service |= !services.is_empty();
        match self.phase {
            PairingPhase::Waiting => self.observe_waiting(elapsed, services),
            PairingPhase::Pairing => self
                .pending_pair
                .take()
                .map_or(PairingAction::None, PairingAction::Pair),
            PairingPhase::Connecting => self.observe_connecting(elapsed, services, online_serials),
            _ => PairingAction::None,
        }
    }

    fn observe_waiting(&mut self, elapsed: Duration, services: &[MdnsService]) -> PairingAction {
        let found = services.iter().find(|service| {
            service.kind == MdnsServiceKind::Pairing
                && Some(service.name.as_str()) == self.service_name.as_deref()
        });
        if let Some(service) = found {
            self.phase = PairingPhase::Pairing;
            self.pairing_host = Some(service.host);
            return PairingAction::Pair(service.address());
        }
        if elapsed >= WAIT_TIMEOUT {
            let reason = if self.saw_any_service {
                PairingFailure::PhoneNotSeen
            } else {
                PairingFailure::NothingDiscovered
            };
            self.fail(reason, None);
        }
        PairingAction::None
    }

    fn connect_service<'a>(&self, services: &'a [MdnsService]) -> Option<&'a MdnsService> {
        let connect = services
            .iter()
            .filter(|service| service.kind == MdnsServiceKind::Connect);
        let by_guid = self
            .guid
            .as_deref()
            .and_then(|guid| connect.clone().find(|service| service.name == guid));
        by_guid.or_else(|| {
            let host = self.pairing_host?;
            connect.clone().find(|service| service.host == host)
        })
    }

    fn connected_serial(
        &self,
        services: &[MdnsService],
        online_serials: &[String],
    ) -> Option<String> {
        let service = self.connect_service(services);
        online_serials
            .iter()
            .find(|serial| {
                let by_guid = self.guid.as_deref().is_some_and(|guid| {
                    serial.as_str() == guid || serial.starts_with(&format!("{guid}."))
                });
                let by_address =
                    service.is_some_and(|service| **serial == service.address().to_string());
                by_guid || by_address
            })
            .cloned()
    }

    fn observe_connecting(
        &mut self,
        elapsed: Duration,
        services: &[MdnsService],
        online_serials: &[String],
    ) -> PairingAction {
        if let Some(serial) = self.connected_serial(services, online_serials) {
            self.phase = PairingPhase::Connected {
                serial,
                guid: self.guid.clone(),
            };
            return PairingAction::None;
        }
        let since_paired = elapsed.saturating_sub(self.paired_at);
        if since_paired >= CONNECT_TIMEOUT || self.connect_attempts >= MAX_CONNECT_ATTEMPTS {
            self.fail(
                PairingFailure::ConnectFailed,
                self.last_connect_error.clone(),
            );
            return PairingAction::None;
        }
        if since_paired < AUTOCONNECT_GRACE {
            return PairingAction::None;
        }
        let retry_due = self
            .last_connect_at
            .is_none_or(|at| elapsed.saturating_sub(at) >= CONNECT_RETRY_GAP);
        match self.connect_service(services) {
            Some(service) if retry_due => {
                self.connect_attempts += 1;
                self.last_connect_at = Some(elapsed);
                PairingAction::Connect(service.address())
            }
            _ => PairingAction::None,
        }
    }

    pub(crate) fn pair_finished(
        &mut self,
        elapsed: Duration,
        result: Result<Option<String>, PairError>,
    ) {
        if self.phase != PairingPhase::Pairing {
            return;
        }
        match result {
            Ok(guid) => {
                self.guid = guid;
                self.paired_at = elapsed;
                self.phase = PairingPhase::Connecting;
            }
            Err(PairError::Rejected(detail)) => {
                self.fail(PairingFailure::PairingRejected, Some(detail));
            }
            Err(PairError::Unreachable(detail)) => {
                self.fail(PairingFailure::PhoneUnreachable, Some(detail));
            }
            Err(PairError::AdbUnavailable(detail)) => {
                self.fail(PairingFailure::AdbUnavailable, Some(detail));
            }
        }
    }

    /// A connect reply. Success is confirmed by the next observation seeing the device online,
    /// since adb may list it under its mDNS serial instead of the address.
    pub(crate) fn connect_finished(&mut self, address: SocketAddrV4, result: Result<(), String>) {
        if self.phase != PairingPhase::Connecting {
            return;
        }
        match result {
            Ok(()) => {
                self.phase = PairingPhase::Connected {
                    serial: address.to_string(),
                    guid: self.guid.clone(),
                };
            }
            Err(detail) => self.last_connect_error = Some(detail),
        }
    }

    /// Discovery itself broke (adb server stopped, mDNS could not start).
    pub(crate) fn discovery_failed(&mut self, adb_down: bool, detail: String) {
        if self.is_finished() {
            return;
        }
        let reason = if adb_down {
            PairingFailure::AdbUnavailable
        } else {
            PairingFailure::DiscoveryUnavailable
        };
        self.fail(reason, Some(detail));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NAME: &str = "studio-AbC123xyZ0";
    const GUID: &str = "adb-R5CR10ABCDE-Xy12Ab";
    const PHONE: Ipv4Addr = Ipv4Addr::new(192, 168, 1, 20);

    fn secs(value: u64) -> Duration {
        Duration::from_secs(value)
    }

    fn service(name: &str, kind: MdnsServiceKind, host: Ipv4Addr, port: u16) -> MdnsService {
        MdnsService {
            name: name.to_string(),
            kind,
            host,
            port,
        }
    }

    fn pairing() -> MdnsService {
        service(NAME, MdnsServiceKind::Pairing, PHONE, 37099)
    }

    fn connect() -> MdnsService {
        service(GUID, MdnsServiceKind::Connect, PHONE, 41235)
    }

    fn paired_machine() -> PairingMachine {
        let mut machine = PairingMachine::for_qr(NAME.to_string());
        machine.observe(secs(1), &[pairing()], &[]);
        machine.pair_finished(secs(2), Ok(Some(GUID.to_string())));
        machine
    }

    #[test]
    fn waits_until_its_own_pairing_service_appears() {
        let mut machine = PairingMachine::for_qr(NAME.to_string());
        let other = service("studio-other", MdnsServiceKind::Pairing, PHONE, 1);
        assert_eq!(machine.observe(secs(1), &[other], &[]), PairingAction::None);
        assert_eq!(machine.phase(), &PairingPhase::Waiting);
        let action = machine.observe(secs(2), &[pairing()], &[]);
        assert_eq!(action, PairingAction::Pair(SocketAddrV4::new(PHONE, 37099)));
        assert_eq!(machine.phase(), &PairingPhase::Pairing);
    }

    #[test]
    fn times_out_with_a_reason_that_depends_on_what_was_seen() {
        let mut silent = PairingMachine::for_qr(NAME.to_string());
        silent.observe(WAIT_TIMEOUT, &[], &[]);
        assert!(matches!(
            silent.phase(),
            PairingPhase::Failed {
                reason: PairingFailure::NothingDiscovered,
                ..
            }
        ));

        let mut busy = PairingMachine::for_qr(NAME.to_string());
        busy.observe(secs(1), &[connect()], &[]);
        busy.observe(WAIT_TIMEOUT, &[], &[]);
        assert!(matches!(
            busy.phase(),
            PairingPhase::Failed {
                reason: PairingFailure::PhoneNotSeen,
                ..
            }
        ));
    }

    #[test]
    fn pairing_failures_end_the_session() {
        let mut machine = PairingMachine::for_qr(NAME.to_string());
        machine.observe(secs(1), &[pairing()], &[]);
        machine.pair_finished(secs(2), Err(PairError::Rejected("Wrong password".into())));
        assert!(machine.is_finished());
        assert!(matches!(
            machine.phase(),
            PairingPhase::Failed {
                reason: PairingFailure::PairingRejected,
                ..
            }
        ));

        let mut unreachable = PairingMachine::for_qr(NAME.to_string());
        unreachable.observe(secs(1), &[pairing()], &[]);
        unreachable.pair_finished(secs(2), Err(PairError::Unreachable("refused".into())));
        assert!(matches!(
            unreachable.phase(),
            PairingPhase::Failed {
                reason: PairingFailure::PhoneUnreachable,
                ..
            }
        ));
    }

    #[test]
    fn adb_autoconnect_wins_without_an_explicit_connect() {
        let mut machine = paired_machine();
        assert!(machine.needs_devices());
        let serial = format!("{GUID}._adb-tls-connect._tcp");
        let action = machine.observe(secs(3), &[connect()], &[serial.clone()]);
        assert_eq!(action, PairingAction::None);
        assert_eq!(
            machine.phase(),
            &PairingPhase::Connected {
                serial,
                guid: Some(GUID.to_string())
            }
        );
    }

    #[test]
    fn connects_after_the_grace_period_and_retries() {
        let mut machine = paired_machine();
        assert_eq!(
            machine.observe(secs(3), &[connect()], &[]),
            PairingAction::None
        );
        let address = SocketAddrV4::new(PHONE, 41235);
        assert_eq!(
            machine.observe(secs(4), &[connect()], &[]),
            PairingAction::Connect(address)
        );
        machine.connect_finished(address, Err("failed to connect".into()));
        assert_eq!(
            machine.observe(secs(5), &[connect()], &[]),
            PairingAction::None
        );
        assert_eq!(
            machine.observe(secs(7), &[connect()], &[]),
            PairingAction::Connect(address)
        );
        machine.connect_finished(address, Ok(()));
        assert_eq!(
            machine.phase(),
            &PairingPhase::Connected {
                serial: address.to_string(),
                guid: Some(GUID.to_string())
            }
        );
    }

    #[test]
    fn falls_back_to_the_pairing_host_without_a_guid() {
        let mut machine = PairingMachine::for_qr(NAME.to_string());
        machine.observe(secs(1), &[pairing()], &[]);
        machine.pair_finished(secs(2), Ok(None));
        let other_phone = service(
            "adb-other",
            MdnsServiceKind::Connect,
            Ipv4Addr::new(10, 0, 0, 9),
            1,
        );
        assert_eq!(
            machine.observe(secs(5), &[other_phone, connect()], &[]),
            PairingAction::Connect(SocketAddrV4::new(PHONE, 41235))
        );
    }

    #[test]
    fn gives_up_when_the_connect_service_never_appears() {
        let mut machine = paired_machine();
        machine.observe(secs(10), &[], &[]);
        assert!(!machine.is_finished());
        machine.observe(secs(2) + CONNECT_TIMEOUT, &[], &[]);
        assert!(matches!(
            machine.phase(),
            PairingPhase::Failed {
                reason: PairingFailure::ConnectFailed,
                ..
            }
        ));
    }

    #[test]
    fn gives_up_after_the_last_failed_attempt() {
        let mut machine = paired_machine();
        let address = SocketAddrV4::new(PHONE, 41235);
        let mut at = 4;
        for _ in 0..MAX_CONNECT_ATTEMPTS {
            assert_eq!(
                machine.observe(secs(at), &[connect()], &[]),
                PairingAction::Connect(address)
            );
            machine.connect_finished(address, Err("failed to connect".into()));
            at += 3;
        }
        machine.observe(secs(at), &[connect()], &[]);
        assert_eq!(
            machine.phase(),
            &PairingPhase::Failed {
                reason: PairingFailure::ConnectFailed,
                detail: Some("failed to connect".into())
            }
        );
    }

    #[test]
    fn a_code_session_pairs_on_its_first_step() {
        let address = SocketAddrV4::new(PHONE, 37099);
        let mut machine = PairingMachine::for_code(address);
        assert_eq!(machine.phase(), &PairingPhase::Pairing);
        assert_eq!(
            machine.observe(secs(0), &[], &[]),
            PairingAction::Pair(address)
        );
        assert_eq!(machine.observe(secs(1), &[], &[]), PairingAction::None);
        machine.pair_finished(secs(1), Ok(None));
        assert_eq!(
            machine.observe(secs(4), &[connect()], &[]),
            PairingAction::Connect(SocketAddrV4::new(PHONE, 41235))
        );
    }

    #[test]
    fn discovery_failure_reports_adb_or_mdns() {
        let mut machine = PairingMachine::for_qr(NAME.to_string());
        machine.discovery_failed(true, "refused".into());
        assert!(matches!(
            machine.phase(),
            PairingPhase::Failed {
                reason: PairingFailure::AdbUnavailable,
                ..
            }
        ));
        let mut other = PairingMachine::for_qr(NAME.to_string());
        other.discovery_failed(false, "no multicast".into());
        assert!(matches!(
            other.phase(),
            PairingPhase::Failed {
                reason: PairingFailure::DiscoveryUnavailable,
                ..
            }
        ));
    }

    #[test]
    fn phases_serialize_with_a_phase_tag() {
        let json = serde_json::to_value(PairingPhase::Failed {
            reason: PairingFailure::NothingDiscovered,
            detail: None,
        })
        .unwrap_or_default();
        assert_eq!(json["phase"], "failed");
        assert_eq!(json["reason"], "nothingDiscovered");
        let connected = serde_json::to_value(PairingPhase::Connected {
            serial: "10.0.0.2:5555".into(),
            guid: None,
        })
        .unwrap_or_default();
        assert_eq!(connected["phase"], "connected");
        assert_eq!(connected["serial"], "10.0.0.2:5555");
    }
}
