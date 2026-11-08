use parking_lot::Mutex;
use serde::Serialize;
use std::sync::LazyLock;

use super::adb_host::{self, HostError};
use super::mdns_services::MdnsService;
use super::native_mdns::NativeBrowser;

/// Where the list of nearby adb services comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryBackend {
    /// The adb server's own mDNS discovery (`adb mdns services`).
    Adb,
    /// Capubridge's own mDNS browser, used when the adb server's is off.
    Native,
}

/// Whether nearby phones can be discovered at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryStatus {
    Ready,
    AdbUnavailable,
    DiscoveryUnavailable,
}

/// One discovery poll as the panel sees it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WirelessDiscovery {
    pub status: DiscoveryStatus,
    pub backend: Option<DiscoveryBackend>,
    pub services: Vec<MdnsService>,
    pub detail: Option<String>,
}

enum Source {
    Adb,
    Native(NativeBrowser),
}

/// A poll failure: the adb server is down, or no mDNS source could run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum DiscoveryError {
    AdbUnavailable(String),
    Unavailable(String),
}

static SHARED: LazyLock<Mutex<Option<Source>>> = LazyLock::new(|| Mutex::new(None));

/// Prefers the adb server's discovery; starts the native browser only when adb reports its
/// own mDNS as unavailable. Blocking: call from a blocking thread.
fn open_source() -> Result<Source, DiscoveryError> {
    match adb_host::mdns_check() {
        Ok(check) if check.available => Ok(Source::Adb),
        Ok(check) => {
            log::info!(
                "[wireless] adb mDNS unavailable ({}); using the native browser",
                check.detail
            );
            NativeBrowser::start()
                .map(Source::Native)
                .map_err(DiscoveryError::Unavailable)
        }
        Err(HostError::Unreachable(detail)) => Err(DiscoveryError::AdbUnavailable(detail)),
        Err(error) => Err(DiscoveryError::Unavailable(error.to_string())),
    }
}

/// Lists nearby adb services through the shared source, opening it on first use. A failed
/// poll drops the source so the next poll chooses again. Blocking.
pub(crate) fn poll_services() -> Result<(DiscoveryBackend, Vec<MdnsService>), DiscoveryError> {
    let mut shared = SHARED.lock();
    if shared.is_none() {
        *shared = Some(open_source()?);
    }
    let result = match shared.as_mut() {
        Some(Source::Adb) => adb_host::mdns_services()
            .map(|services| (DiscoveryBackend::Adb, services))
            .map_err(|error| match error {
                HostError::Unreachable(detail) => DiscoveryError::AdbUnavailable(detail),
                other => DiscoveryError::Unavailable(other.to_string()),
            }),
        Some(Source::Native(browser)) => Ok((DiscoveryBackend::Native, browser.services())),
        None => Err(DiscoveryError::Unavailable(
            "Discovery did not start".to_string(),
        )),
    };
    if result.is_err() {
        *shared = None;
    }
    result
}

/// Stops discovery; the native browser's daemon shuts down with it.
pub(crate) fn stop() {
    SHARED.lock().take();
}

pub(crate) fn snapshot() -> WirelessDiscovery {
    match poll_services() {
        Ok((backend, services)) => WirelessDiscovery {
            status: DiscoveryStatus::Ready,
            backend: Some(backend),
            services,
            detail: None,
        },
        Err(DiscoveryError::AdbUnavailable(detail)) => WirelessDiscovery {
            status: DiscoveryStatus::AdbUnavailable,
            backend: None,
            services: Vec::new(),
            detail: Some(detail),
        },
        Err(DiscoveryError::Unavailable(detail)) => WirelessDiscovery {
            status: DiscoveryStatus::DiscoveryUnavailable,
            backend: None,
            services: Vec::new(),
            detail: Some(detail),
        },
    }
}
