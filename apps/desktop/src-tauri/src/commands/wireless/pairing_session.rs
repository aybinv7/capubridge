use parking_lot::Mutex;
use serde::Serialize;
use std::net::{Ipv4Addr, SocketAddrV4};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

use crate::blocking::run_blocking;

use super::adb_host;
use super::discovery::{self, DiscoveryError};
use super::mdns_services::MdnsService;
use super::pairing_machine::{PairingAction, PairingMachine, PairingPhase};
use super::qr_payload::{encode_qr, PairingSecret, QrMatrix};

pub(crate) const PAIRING_EVENT: &str = "capubridge:wireless-pairing";
const POLL_INTERVAL: Duration = Duration::from_secs(1);

/// A started QR session: what the panel draws.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrPairingStart {
    pub session_id: u64,
    pub service_name: String,
    pub qr: QrMatrix,
}

/// A state change of one session, streamed on [`PAIRING_EVENT`].
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingStateEvent {
    pub session_id: u64,
    pub state: PairingPhase,
}

struct ActiveSession {
    id: u64,
    cancel: CancellationToken,
}

static NEXT_SESSION: AtomicU64 = AtomicU64::new(1);
static ACTIVE: LazyLock<Mutex<Option<ActiveSession>>> = LazyLock::new(|| Mutex::new(None));

/// Registers a new session, cancelling the previous one: only one phone pairs at a time.
fn begin_session() -> (u64, CancellationToken) {
    let id = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    let cancel = CancellationToken::new();
    let previous = ACTIVE.lock().replace(ActiveSession {
        id,
        cancel: cancel.clone(),
    });
    if let Some(previous) = previous {
        previous.cancel.cancel();
    }
    (id, cancel)
}

fn end_session(id: u64) {
    let mut active = ACTIVE.lock();
    if active.as_ref().is_some_and(|session| session.id == id) {
        active.take();
    }
}

fn emit_state(app: &AppHandle, session_id: u64, state: &PairingPhase) {
    let payload = PairingStateEvent {
        session_id,
        state: state.clone(),
    };
    if let Err(error) = app.emit(PAIRING_EVENT, payload) {
        log::warn!("[wireless] could not emit the pairing state: {error}");
    }
}

/// Polls discovery and, while connecting, adb's device list, on a blocking thread.
async fn observe(needs_devices: bool) -> (Result<Vec<MdnsService>, DiscoveryError>, Vec<String>) {
    let polled = run_blocking(move || {
        let services = discovery::poll_services().map(|(_, services)| services);
        let serials = if needs_devices {
            adb_host::online_serials().unwrap_or_default()
        } else {
            Vec::new()
        };
        (services, serials)
    })
    .await;
    polled.unwrap_or_else(|error| (Err(DiscoveryError::Unavailable(error)), Vec::new()))
}

/// Runs one session until it connects, fails, or is cancelled. The secret stays inside this
/// task and the blocking pair call; it is dropped when the task ends.
async fn drive(
    app: AppHandle,
    session_id: u64,
    mut machine: PairingMachine,
    secret: String,
    cancel: CancellationToken,
) {
    let started = Instant::now();
    let mut last_emitted = machine.phase().clone();
    emit_state(&app, session_id, &last_emitted);
    let mut ticker = tokio::time::interval(POLL_INTERVAL);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    while !machine.is_finished() {
        tokio::select! {
            () = cancel.cancelled() => break,
            _ = ticker.tick() => {}
        }
        let (services, serials) = observe(machine.needs_devices()).await;
        let action = match services {
            Ok(services) => machine.observe(started.elapsed(), &services, &serials),
            Err(DiscoveryError::AdbUnavailable(detail)) => {
                machine.discovery_failed(true, detail);
                PairingAction::None
            }
            Err(DiscoveryError::Unavailable(detail))
                if machine.phase() == &PairingPhase::Waiting =>
            {
                machine.discovery_failed(false, detail);
                PairingAction::None
            }
            Err(DiscoveryError::Unavailable(_)) => {
                machine.observe(started.elapsed(), &[], &serials)
            }
        };
        if machine.phase() != &last_emitted {
            last_emitted = machine.phase().clone();
            emit_state(&app, session_id, &last_emitted);
        }
        match action {
            PairingAction::None => {}
            PairingAction::Pair(address) => {
                let code = secret.clone();
                let task = run_blocking(move || adb_host::pair(address, &code));
                let result = tokio::select! {
                    () = cancel.cancelled() => break,
                    result = task => result,
                };
                let result =
                    result.unwrap_or_else(|error| Err(adb_host::PairError::Unreachable(error)));
                machine.pair_finished(started.elapsed(), result);
            }
            PairingAction::Connect(address) => {
                let task = run_blocking(move || adb_host::connect(address));
                let result = tokio::select! {
                    () = cancel.cancelled() => break,
                    result = task => result,
                };
                machine.connect_finished(address, result.and_then(|inner| inner));
            }
        }
        if machine.phase() != &last_emitted {
            last_emitted = machine.phase().clone();
            emit_state(&app, session_id, &last_emitted);
        }
    }
    end_session(session_id);
}

/// Starts a QR pairing session: generates the service name and password, draws the QR code
/// and polls discovery every second until the phone scans it. State arrives on
/// [`PAIRING_EVENT`]; the session ends on success, failure, timeout or
/// `wireless_pairing_cancel`.
#[tauri::command]
pub async fn wireless_pairing_start(app: AppHandle) -> Result<QrPairingStart, String> {
    let secret = PairingSecret::generate()?;
    let qr = encode_qr(&secret.qr_payload())?;
    let service_name = secret.service_name().to_string();
    let (session_id, cancel) = begin_session();
    let machine = PairingMachine::for_qr(service_name.clone());
    tauri::async_runtime::spawn(drive(
        app,
        session_id,
        machine,
        secret.password().to_string(),
        cancel,
    ));
    Ok(QrPairingStart {
        session_id,
        service_name,
        qr,
    })
}

/// Pairs with a six-digit code at a known pairing address, then connects like a QR session.
#[tauri::command]
pub async fn wireless_pairing_with_code(
    app: AppHandle,
    host: String,
    port: u16,
    code: String,
) -> Result<u64, String> {
    let host = host
        .trim()
        .parse::<Ipv4Addr>()
        .map_err(|_| "Enter the pairing address as an IPv4 address".to_string())?;
    let code = code.trim().to_string();
    if code.is_empty() || code.contains(':') {
        return Err("Enter the pairing code the phone shows".to_string());
    }
    let (session_id, cancel) = begin_session();
    let machine = PairingMachine::for_code(SocketAddrV4::new(host, port));
    tauri::async_runtime::spawn(drive(app, session_id, machine, code, cancel));
    Ok(session_id)
}

/// Cancels a session; the panel calls it when it closes or starts over.
#[tauri::command]
pub async fn wireless_pairing_cancel(session_id: u64) -> Result<(), String> {
    let mut active = ACTIVE.lock();
    if active
        .as_ref()
        .is_some_and(|session| session.id == session_id)
    {
        if let Some(session) = active.take() {
            session.cancel.cancel();
        }
    }
    Ok(())
}
