use tauri::{AppHandle, State};

use crate::commands::adb::{
    start_logcat_session_with_callbacks, stop_logcat_session,
};
use crate::commands::mirror::stop_mirror_session;
use crate::commands::perf::{start_perf_session_with_callbacks, stop_perf_session};
use crate::error::{AppResult, AppResultExt};
use crate::session::events::{
    emit_lease_state, emit_logcat_entry, emit_logcat_error, emit_perf_error, emit_perf_metrics,
};
use crate::session::guards::require_online_session;
use crate::session::registry::SessionRegistryState;
use crate::session::types::SessionLeaseState;

fn require_hot_session(
    state: &State<'_, SessionRegistryState>,
    serial: &str,
) -> Result<(), String> {
    require_online_session(&state.registry(), serial)?;
    if state.registry().active_serial().as_deref() != Some(serial) {
        return Err(format!("device-not-active: {serial}"));
    }
    Ok(())
}

#[tauri::command]
pub fn session_start_logcat_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<SessionLeaseState> {
    require_hot_session(&state, &serial).app_context("session_start_logcat_lease")?;

    let registry = state.registry();
    let entry_app = app.clone();
    let error_app = app.clone();
    let stopped_app = app.clone();
    let stopped_registry = registry.clone();

    start_logcat_session_with_callbacks(
        serial.clone(),
        move |entry| {
            emit_logcat_entry(&entry_app, entry.serial.clone(), entry);
        },
        move |payload| {
            emit_logcat_error(&error_app, payload.serial, payload.message);
        },
        move |stopped_serial| {
            if let Ok(lease) = stopped_registry.set_logcat_lease(&stopped_serial, false) {
                emit_lease_state(&stopped_app, lease);
            }
        },
    )
    .app_context("session_start_logcat_lease")?;

    let lease = registry
        .set_logcat_lease(&serial, true)
        .app_context("session_start_logcat_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub fn session_stop_logcat_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<SessionLeaseState> {
    stop_logcat_session(&serial);
    let lease = state
        .registry()
        .set_logcat_lease(&serial, false)
        .app_context("session_stop_logcat_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub async fn session_start_perf_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<SessionLeaseState> {
    require_hot_session(&state, &serial).app_context("session_start_perf_lease")?;

    let registry = state.registry();
    let metrics_app = app.clone();
    let error_app = app.clone();
    let stopped_app = app.clone();
    let stopped_registry = registry.clone();
    let metrics_serial = serial.clone();
    let error_serial = serial.clone();

    start_perf_session_with_callbacks(
        serial.clone(),
        move |metrics| {
            emit_perf_metrics(&metrics_app, metrics_serial.clone(), metrics);
        },
        move |message| {
            emit_perf_error(&error_app, error_serial.clone(), message);
        },
        move |stopped_serial| {
            if let Ok(lease) = stopped_registry.set_perf_lease(&stopped_serial, false) {
                emit_lease_state(&stopped_app, lease);
            }
        },
    )
    .await
    .app_context("session_start_perf_lease")?;

    let lease = registry
        .set_perf_lease(&serial, true)
        .app_context("session_start_perf_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub fn session_stop_perf_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<SessionLeaseState> {
    stop_perf_session(&serial);
    let lease = state
        .registry()
        .set_perf_lease(&serial, false)
        .app_context("session_stop_perf_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub fn session_start_mirror_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<SessionLeaseState> {
    require_hot_session(&state, &serial).app_context("session_start_mirror_lease")?;
    let lease = state
        .registry()
        .set_mirror_lease(&serial, true)
        .app_context("session_start_mirror_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub async fn session_stop_mirror_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<SessionLeaseState> {
    stop_mirror_session(&serial)
        .await
        .app_context("session_stop_mirror_lease")?;
    let lease = state
        .registry()
        .set_mirror_lease(&serial, false)
        .app_context("session_stop_mirror_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub fn session_attach_console_target(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
    target_id: String,
) -> AppResult<SessionLeaseState> {
    require_hot_session(&state, &serial).app_context("session_attach_console_target")?;
    let lease = state
        .registry()
        .attach_console_target(&serial, target_id)
        .app_context("session_attach_console_target")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub fn session_detach_console_target(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
) -> AppResult<SessionLeaseState> {
    let lease = state
        .registry()
        .detach_console_target(&serial)
        .app_context("session_detach_console_target")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}
