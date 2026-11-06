use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::commands::mirror::stop_mirror_session;
use crate::commands::perf::{perf_session_running, spawn_perf_session, stop_perf_session};
use crate::error::{AppResult, AppResultExt};
use crate::session::events::{emit_lease_state, emit_perf_error, emit_perf_metrics};
use crate::session::guards::require_online_session;
use crate::session::perf_holders::{holder_name, PERF_HOLDERS};
use crate::session::registry::{SessionRegistry, SessionRegistryState};
use crate::session::types::SessionLeaseState;

pub(crate) fn require_hot_session(
    state: &State<'_, SessionRegistryState>,
    serial: &str,
) -> Result<(), String> {
    require_online_session(&state.registry(), serial)?;
    if state.registry().active_serial().as_deref() != Some(serial) {
        return Err(format!("device-not-active: {serial}"));
    }
    Ok(())
}

fn spawn_perf_lease_session(
    app: &AppHandle,
    registry: Arc<SessionRegistry>,
    serial: &str,
) -> Result<(), String> {
    let metrics_app = app.clone();
    let error_app = app.clone();
    let stopped_app = app.clone();
    let metrics_serial = serial.to_string();
    let error_serial = serial.to_string();

    spawn_perf_session(
        serial.to_string(),
        move |metrics| {
            emit_perf_metrics(&metrics_app, metrics_serial.clone(), metrics);
        },
        move |message| {
            emit_perf_error(&error_app, error_serial.clone(), message);
        },
        move |stopped_serial| {
            {
                let mut holders = PERF_HOLDERS.lock();
                if perf_session_running(&stopped_serial) {
                    return;
                }
                holders.clear(&stopped_serial);
            }
            if let Ok(lease) = registry.set_perf_lease(&stopped_serial, false) {
                emit_lease_state(&stopped_app, lease);
            }
        },
    )
}

/// Takes the perf stream for `holder` (default `"default"`). The stream starts
/// for the first holder and is shared, never restarted, for later ones.
#[tauri::command]
pub async fn session_start_perf_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
    holder: Option<String>,
) -> AppResult<SessionLeaseState> {
    require_hot_session(&state, &serial).app_context("session_start_perf_lease")?;

    let registry = state.registry();
    let holder = holder_name(holder);
    {
        let mut holders = PERF_HOLDERS.lock();
        if holders.acquire(&serial, &holder, perf_session_running(&serial)) {
            if let Err(error) = spawn_perf_lease_session(&app, registry.clone(), &serial) {
                holders.release(&serial, &holder);
                return Err(error).app_context("session_start_perf_lease");
            }
        }
    }

    let lease = registry
        .set_perf_lease(&serial, true)
        .app_context("session_start_perf_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

/// Releases the perf stream for `holder`. The stream stops only when no holder
/// is left; the returned lease stays active while another holder remains.
#[tauri::command]
pub async fn session_stop_perf_lease(
    app: AppHandle,
    state: State<'_, SessionRegistryState>,
    serial: String,
    holder: Option<String>,
) -> AppResult<SessionLeaseState> {
    let holder = holder_name(holder);
    let release = {
        let mut holders = PERF_HOLDERS.lock();
        let release = holders.release(&serial, &holder);
        if release.stop_session {
            stop_perf_session(&serial);
        }
        release
    };
    let lease = state
        .registry()
        .set_perf_lease(&serial, release.still_held)
        .app_context("session_stop_perf_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

#[tauri::command]
pub async fn session_start_mirror_lease(
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
pub async fn session_attach_console_target(
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
pub async fn session_detach_console_target(
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
