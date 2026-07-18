use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::RwLock;
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult, AppResultExt};
use crate::commands::adb::{
    adb_cancel_list_packages_inner, adb_list_devices, AdbDevice, DeviceInfo, PackageListScope,
    ReverseRule, WebViewSocket,
};
use crate::session::cache_store::SessionCacheStore;
use crate::session::device_session::DeviceSession;
use crate::session::events::emit_registry_snapshot;
use crate::session::guards::require_online_session;
use crate::session::types::{
    SessionDeviceSnapshot, SessionLeaseKind, SessionLeaseState, SessionRegistrySnapshot,
    SessionTargetSnapshot, SessionTemperature, SessionTrackerStatus,
};

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn session_temperature(
    serial: &str,
    active_serial: Option<&str>,
    is_stale: bool,
) -> SessionTemperature {
    if !is_stale && active_serial == Some(serial) {
        return SessionTemperature::Hot;
    }
    if is_stale {
        return SessionTemperature::Cold;
    }
    SessionTemperature::Warm
}

fn device_rank(device: &SessionDeviceSnapshot) -> u8 {
    if !device.is_stale && matches!(device.temperature, SessionTemperature::Hot) {
        return 0;
    }
    if !device.is_stale && device.status == "online" {
        return 1;
    }
    if !device.is_stale {
        return 2;
    }
    3
}

fn to_session_device(
    device: AdbDevice,
    active_serial: Option<&str>,
    timestamp: u64,
) -> SessionDeviceSnapshot {
    SessionDeviceSnapshot {
        serial: device.serial.clone(),
        model: device.model,
        product: device.product,
        transport_id: device.transport_id,
        connection_type: device.connection_type,
        status: device.status,
        temperature: session_temperature(&device.serial, active_serial, false),
        is_stale: false,
        last_seen_at: Some(timestamp),
        last_updated_at: timestamp,
        health: None,
    }
}

#[derive(Debug)]
struct SessionRegistryInner {
    devices: HashMap<String, SessionDeviceSnapshot>,
    leases: HashMap<String, DeviceLeaseState>,
    active_serial: Option<String>,
    tracker_status: SessionTrackerStatus,
    revision: u64,
    last_error: Option<String>,
    updated_at: u64,
}

#[derive(Debug, Clone, Default)]
struct DeviceLeaseState {
    logcat_active: bool,
    perf_active: bool,
    mirror_active: bool,
    console_target_id: Option<String>,
}

#[derive(Debug)]
pub struct SessionRegistry {
    inner: RwLock<SessionRegistryInner>,
    sessions: RwLock<HashMap<String, Arc<DeviceSession>>>,
    cache_store: RwLock<Option<Arc<SessionCacheStore>>>,
}

#[derive(Clone)]
pub struct SessionRegistryState(pub Arc<SessionRegistry>);

impl SessionRegistry {
    pub fn new() -> Self {
        let now = now_millis();
        Self {
            inner: RwLock::new(SessionRegistryInner {
                devices: HashMap::new(),
                leases: HashMap::new(),
                active_serial: None,
                tracker_status: SessionTrackerStatus::Stopped,
                revision: 0,
                last_error: None,
                updated_at: now,
            }),
            sessions: RwLock::new(HashMap::new()),
            cache_store: RwLock::new(None),
        }
    }

    pub fn snapshot(&self) -> SessionRegistrySnapshot {
        let (mut devices, active_serial, tracker_status, revision, last_error, updated_at) = {
            let inner = self.inner.read();
            (
                inner.devices.values().cloned().collect::<Vec<_>>(),
                inner.active_serial.clone(),
                inner.tracker_status.clone(),
                inner.revision,
                inner.last_error.clone(),
                inner.updated_at,
            )
        };
        let sessions = self.sessions.read();
        for device in &mut devices {
            if let Some(session) = sessions.get(&device.serial) {
                device.health = Some(session.health_snapshot());
            }
        }
        drop(sessions);
        devices.sort_by(|left, right| {
            device_rank(left)
                .cmp(&device_rank(right))
                .then_with(|| left.serial.cmp(&right.serial))
        });
        SessionRegistrySnapshot {
            devices,
            active_serial,
            tracker_status,
            revision,
            last_error,
            updated_at,
        }
    }

    pub fn list_devices(&self) -> Vec<SessionDeviceSnapshot> {
        self.snapshot().devices
    }

    pub fn device_snapshot(&self, serial: &str) -> Option<SessionDeviceSnapshot> {
        self.inner.read().devices.get(serial).cloned()
    }

    pub fn session_for_serial(&self, serial: &str) -> Option<Arc<DeviceSession>> {
        self.sessions.read().get(serial).cloned()
    }

    pub fn ensure_session(&self, serial: &str) -> Arc<DeviceSession> {
        let mut sessions = self.sessions.write();
        sessions
            .entry(serial.to_string())
            .or_insert_with(|| DeviceSession::new(serial.to_string()))
            .clone()
    }

    pub fn active_serial(&self) -> Option<String> {
        self.inner.read().active_serial.clone()
    }

    pub fn set_active_serial(
        &self,
        serial: Option<String>,
    ) -> Result<SessionRegistrySnapshot, String> {
        let timestamp = now_millis();
        {
            let mut inner = self.inner.write();
            if let Some(ref next_serial) = serial {
                if !inner.devices.contains_key(next_serial) {
                    return Err(format!("Unknown device serial: {next_serial}"));
                }
            }

            inner.active_serial = serial;
            let active_serial = inner.active_serial.clone();
            for device in inner.devices.values_mut() {
                device.temperature =
                    session_temperature(&device.serial, active_serial.as_deref(), device.is_stale);
                device.last_updated_at = timestamp;
            }
            inner.revision += 1;
            inner.updated_at = timestamp;
        }
        let snapshot = self.snapshot();
        self.persist_snapshot(&snapshot);
        Ok(snapshot)
    }

    pub fn update_tracker_status(
        &self,
        status: SessionTrackerStatus,
        last_error: Option<String>,
    ) -> SessionRegistrySnapshot {
        let timestamp = now_millis();
        {
            let mut inner = self.inner.write();
            inner.tracker_status = status;
            inner.last_error = last_error;
            inner.revision += 1;
            inner.updated_at = timestamp;
        }
        let snapshot = self.snapshot();
        self.persist_snapshot(&snapshot);
        snapshot
    }

    pub fn refresh_from_adb(&self) -> Result<SessionRegistrySnapshot, String> {
        let devices = adb_list_devices()?;
        Ok(self.replace_devices(devices))
    }

    pub fn replace_devices(&self, devices: Vec<AdbDevice>) -> SessionRegistrySnapshot {
        let timestamp = now_millis();
        let stale_serials = {
            let mut inner = self.inner.write();
            let active_serial = inner.active_serial.clone();
            let fresh_serials = devices
                .iter()
                .map(|device| device.serial.clone())
                .collect::<HashSet<_>>();

            for device in devices {
                self.ensure_session(&device.serial);
                inner
                    .leases
                    .entry(device.serial.clone())
                    .or_insert_with(DeviceLeaseState::default);
                inner.devices.insert(
                    device.serial.clone(),
                    to_session_device(device, active_serial.as_deref(), timestamp),
                );
            }

            for device in inner.devices.values_mut() {
                if !fresh_serials.contains(&device.serial) {
                    device.is_stale = true;
                    device.status = "offline".to_string();
                    device.temperature =
                        session_temperature(&device.serial, active_serial.as_deref(), true);
                    device.last_updated_at = timestamp;
                    if let Some(session) = self.session_for_serial(&device.serial) {
                        session.mark_targets_stale();
                        session.mark_packages_stale();
                    }
                } else {
                    device.is_stale = false;
                    device.temperature =
                        session_temperature(&device.serial, active_serial.as_deref(), false);
                }
            }

            inner.last_error = None;
            inner.revision += 1;
            inner.updated_at = timestamp;
            inner
                .devices
                .values()
                .filter(|device| device.is_stale)
                .map(|device| device.serial.clone())
                .collect::<Vec<_>>()
        };
        let stale_sessions = {
            let mut sessions = self.sessions.write();
            stale_serials
                .iter()
                .filter_map(|serial| {
                    sessions
                        .remove(serial)
                        .map(|session| (serial.clone(), session))
                })
                .collect::<Vec<_>>()
        };
        for (serial, session) in stale_sessions {
            session.shutdown();
            if let Some(device) = self.inner.write().devices.get_mut(&serial) {
                device.health = Some(session.health_snapshot());
            }
        }
        let snapshot = self.snapshot();
        self.persist_snapshot(&snapshot);
        snapshot
    }

    pub fn configure_cache_store(
        &self,
        cache_store: Arc<SessionCacheStore>,
    ) -> Result<Option<SessionRegistrySnapshot>, String> {
        {
            let mut configured = self.cache_store.write();
            *configured = Some(cache_store.clone());
        }

        let Some(snapshot) = cache_store.load_registry_snapshot()? else {
            return Ok(None);
        };

        {
            let mut inner = self.inner.write();
            inner.devices = snapshot
                .devices
                .iter()
                .cloned()
                .map(|device| (device.serial.clone(), device))
                .collect();
            inner.leases = snapshot
                .devices
                .iter()
                .map(|device| (device.serial.clone(), DeviceLeaseState::default()))
                .collect();
            inner.active_serial = snapshot.active_serial.clone();
            inner.tracker_status = snapshot.tracker_status.clone();
            inner.revision = snapshot.revision;
            inner.last_error = snapshot.last_error.clone();
            inner.updated_at = snapshot.updated_at;
        }

        Ok(Some(self.snapshot()))
    }

    fn persist_snapshot(&self, snapshot: &SessionRegistrySnapshot) {
        let cache_store = self.cache_store.read().clone();
        let Some(cache_store) = cache_store else {
            return;
        };

        if let Err(error) = cache_store.save_registry_snapshot(snapshot) {
            log::warn!("[session-cache] Failed to persist registry snapshot: {error}");
        }
    }

    fn set_lease_state(
        &self,
        serial: &str,
        kind: SessionLeaseKind,
        active: bool,
        target_id: Option<String>,
    ) -> Result<SessionLeaseState, String> {
        let updated_at = now_millis();
        let mut inner = self.inner.write();
        if !inner.devices.contains_key(serial) {
            return Err(format!("Unknown device serial: {serial}"));
        }

        let leases = inner
            .leases
            .entry(serial.to_string())
            .or_insert_with(DeviceLeaseState::default);

        match kind {
            SessionLeaseKind::Logcat => leases.logcat_active = active,
            SessionLeaseKind::Perf => leases.perf_active = active,
            SessionLeaseKind::Mirror => leases.mirror_active = active,
            SessionLeaseKind::Console => {
                leases.console_target_id = if active { target_id.clone() } else { None };
            }
        }

        Ok(SessionLeaseState {
            serial: serial.to_string(),
            kind,
            active,
            target_id: target_id.filter(|value| !value.is_empty()),
            updated_at,
        })
    }

    pub fn set_logcat_lease(
        &self,
        serial: &str,
        active: bool,
    ) -> Result<SessionLeaseState, String> {
        self.set_lease_state(serial, SessionLeaseKind::Logcat, active, None)
    }

    pub fn set_perf_lease(
        &self,
        serial: &str,
        active: bool,
    ) -> Result<SessionLeaseState, String> {
        self.set_lease_state(serial, SessionLeaseKind::Perf, active, None)
    }

    pub fn set_mirror_lease(
        &self,
        serial: &str,
        active: bool,
    ) -> Result<SessionLeaseState, String> {
        self.set_lease_state(serial, SessionLeaseKind::Mirror, active, None)
    }

    pub fn attach_console_target(
        &self,
        serial: &str,
        target_id: String,
    ) -> Result<SessionLeaseState, String> {
        self.set_lease_state(serial, SessionLeaseKind::Console, true, Some(target_id))
    }

    pub fn detach_console_target(&self, serial: &str) -> Result<SessionLeaseState, String> {
        self.set_lease_state(serial, SessionLeaseKind::Console, false, None)
    }
}

impl SessionRegistryState {
    pub fn new() -> Self {
        Self(Arc::new(SessionRegistry::new()))
    }

    pub fn registry(&self) -> Arc<SessionRegistry> {
        self.0.clone()
    }
}

fn session_for_online_serial(
    state: &State<'_, SessionRegistryState>,
    serial: &str,
) -> Result<Arc<DeviceSession>, String> {
    require_online_session(&state.registry(), serial)
}

#[tauri::command]
pub fn session_list_devices(
    state: State<'_, SessionRegistryState>,
) -> AppResult<Vec<SessionDeviceSnapshot>> {
    Ok(state.registry().list_devices())
}

#[tauri::command]
pub fn session_get_registry_state(
    state: State<'_, SessionRegistryState>,
) -> AppResult<SessionRegistrySnapshot> {
    Ok(state.registry().snapshot())
}

#[tauri::command]
pub fn session_refresh_devices(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
) -> AppResult<SessionRegistrySnapshot> {
    let snapshot = state
        .registry()
        .refresh_from_adb()
        .app_context("session_refresh_devices")?;
    emit_registry_snapshot(&app, snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
pub fn session_get_device_info(
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<DeviceInfo> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.get_device_info())
        .app_context("session_get_device_info")
}

#[tauri::command]
pub fn session_shell_command(
    state: State<'_, SessionRegistryState>,
    serial: String,
    command: String,
) -> AppResult<String> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.shell_command(command))
        .app_context("session_shell_command")
}

#[tauri::command]
pub fn session_tcpip(
    state: State<'_, SessionRegistryState>,
    serial: String,
    port: u16,
) -> AppResult<()> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.tcpip(port))
        .app_context("session_tcpip")
}

#[tauri::command]
pub fn session_root(
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<()> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.root())
        .app_context("session_root")
}

#[tauri::command]
pub fn session_reboot(
    state: State<'_, SessionRegistryState>,
    serial: String,
    mode: Option<String>,
) -> AppResult<()> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.reboot(mode))
        .app_context("session_reboot")
}

#[tauri::command]
pub fn session_list_packages(
    state: State<'_, SessionRegistryState>,
    serial: String,
    scope: Option<PackageListScope>,
) -> AppResult<Vec<crate::commands::adb::AdbPackage>> {
    if state.registry().device_snapshot(&serial).is_none() {
        return Err(AppError::from_legacy(
            "session_list_packages",
            format!("Unknown device serial: {serial}"),
        ));
    }

    state
        .registry()
        .session_for_serial(&serial)
        .map(|session| session.list_packages(scope))
        .unwrap_or_else(|| Ok(Vec::new()))
        .app_context("session_list_packages")
}

#[tauri::command]
pub fn session_refresh_packages(
    state: State<'_, SessionRegistryState>,
    serial: String,
    scope: Option<PackageListScope>,
) -> AppResult<Vec<crate::commands::adb::AdbPackage>> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.refresh_packages(scope))
        .app_context("session_refresh_packages")
}

#[tauri::command]
pub fn session_cancel_list_packages(
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<()> {
    if let Some(session) = state.registry().session_for_serial(&serial) {
        return session
            .cancel_packages()
            .app_context("session_cancel_list_packages");
    }
    adb_cancel_list_packages_inner(&serial);
    Ok(())
}

#[tauri::command]
pub fn session_open_package(
    state: State<'_, SessionRegistryState>,
    serial: String,
    package_name: String,
) -> AppResult<String> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.open_package(package_name))
        .app_context("session_open_package")
}

#[tauri::command]
pub fn session_reverse(
    state: State<'_, SessionRegistryState>,
    serial: String,
    remote_port: u16,
    local_port: u16,
) -> AppResult<()> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.reverse(remote_port, local_port))
        .app_context("session_reverse")
}

#[tauri::command]
pub fn session_remove_reverse(
    state: State<'_, SessionRegistryState>,
    serial: String,
    remote_port: u16,
) -> AppResult<()> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.remove_reverse(remote_port))
        .app_context("session_remove_reverse")
}

#[tauri::command]
pub fn session_list_reverse(
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<Vec<ReverseRule>> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.list_reverse())
        .app_context("session_list_reverse")
}

#[tauri::command]
pub fn session_list_webview_sockets(
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<Vec<WebViewSocket>> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.list_webview_sockets())
        .app_context("session_list_webview_sockets")
}

#[tauri::command]
pub fn session_list_targets(
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<Vec<SessionTargetSnapshot>> {
    if state.registry().device_snapshot(&serial).is_none() {
        return Err(AppError::from_legacy(
            "session_list_targets",
            format!("Unknown device serial: {serial}"),
        ));
    }

    Ok(state
        .registry()
        .session_for_serial(&serial)
        .map(|session| session.list_targets())
        .unwrap_or_default())
}

#[tauri::command]
pub fn session_refresh_targets(
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<Vec<SessionTargetSnapshot>> {
    session_for_online_serial(&state, &serial)
        .and_then(|session| session.refresh_targets())
        .app_context("session_refresh_targets")
}

#[tauri::command]
pub fn session_set_active_device(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: Option<String>,
) -> AppResult<SessionRegistrySnapshot> {
    let snapshot = state
        .registry()
        .set_active_serial(serial)
        .app_context("session_set_active_device")?;
    emit_registry_snapshot(&app, snapshot.clone());
    Ok(snapshot)
}
