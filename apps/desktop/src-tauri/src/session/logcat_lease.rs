use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use parking_lot::Mutex;
use tauri::{AppHandle, Manager, State, WindowEvent};

use crate::commands::logcat::leases::{
    logcat_holder_name, LogcatAcquire, LogcatRun, LOGCAT_LEASES,
};
use crate::commands::logcat::{spawn_logcat_run, LogcatCallbacks};
use crate::error::{AppResult, AppResultExt};
use crate::session::events::{emit_lease_state, emit_logcat_entry, emit_logcat_error};
use crate::session::live_features::require_hot_session;
use crate::session::registry::{SessionRegistry, SessionRegistryState};
use crate::session::types::SessionLeaseState;

static HOOKED_WINDOWS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

fn spawn_run(app: &AppHandle, registry: Arc<SessionRegistry>, serial: &str, run: LogcatRun) {
    let entry_app = app.clone();
    let error_app = app.clone();
    let stopped_app = app.clone();
    let entry_generation = run.generation;
    let entry_serial = serial.to_string();
    let error_serial = serial.to_string();

    spawn_logcat_run(
        serial.to_string(),
        run,
        LogcatCallbacks {
            on_entry: Box::new(move |entry| {
                if LOGCAT_LEASES
                    .lock()
                    .is_current(&entry_serial, entry_generation)
                {
                    emit_logcat_entry(&entry_app, entry.serial.clone(), entry);
                }
            }),
            on_error: Box::new(move |payload| {
                if LOGCAT_LEASES
                    .lock()
                    .is_current(&error_serial, entry_generation)
                {
                    emit_logcat_error(&error_app, payload.serial, payload.message);
                }
            }),
            on_stopped: Box::new(move |stopped_serial, generation| {
                let held = {
                    let mut leases = LOGCAT_LEASES.lock();
                    if !leases.ended(&stopped_serial, generation) {
                        return;
                    }
                    leases.is_held(&stopped_serial)
                };
                if held {
                    return;
                }
                if let Ok(lease) = registry.set_logcat_lease(&stopped_serial, false) {
                    emit_lease_state(&stopped_app, lease);
                }
            }),
        },
    );
}

fn release_window_holder(app: &AppHandle, holder: &str) {
    let registry = app.state::<SessionRegistryState>().registry();
    let released = LOGCAT_LEASES.lock().release_everywhere(holder);
    for (serial, release) in released {
        if let Some(run) = release.stopped {
            run.stop();
        }
        if let Ok(lease) = registry.set_logcat_lease(&serial, release.still_held) {
            emit_lease_state(app, lease);
        }
    }
}

fn hook_window_close(app: &AppHandle, webview: &tauri::Webview, holder: &str) {
    if holder != webview.label() || !HOOKED_WINDOWS.lock().insert(holder.to_string()) {
        return;
    }
    let close_app = app.clone();
    let close_holder = holder.to_string();
    webview.window().on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            HOOKED_WINDOWS.lock().remove(&close_holder);
            release_window_holder(&close_app, &close_holder);
        }
    });
}

/// Takes the device's logcat capture for `holder` (default: the calling
/// window). One capture runs per device, shared by every holder; `restart`
/// replaces it with a fresh run without dropping anyone.
#[tauri::command]
pub async fn session_start_logcat_lease(
    app: AppHandle,
    webview: tauri::Webview,
    state: State<'_, SessionRegistryState>,
    serial: String,
    holder: Option<String>,
    restart: Option<bool>,
) -> AppResult<SessionLeaseState> {
    require_hot_session(&state, &serial).app_context("session_start_logcat_lease")?;

    let registry = state.registry();
    let holder = logcat_holder_name(holder.or_else(|| Some(webview.label().to_string())));
    let outcome = LOGCAT_LEASES
        .lock()
        .acquire(&serial, &holder, restart.unwrap_or(false));
    if let LogcatAcquire::Start { run, replaced } = outcome {
        if let Some(previous) = replaced {
            previous.stop();
        }
        spawn_run(&app, registry.clone(), &serial, run);
    }
    hook_window_close(&app, &webview, &holder);

    let lease = registry
        .set_logcat_lease(&serial, true)
        .app_context("session_start_logcat_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}

/// Gives `holder`'s logcat lease back; the capture stops with the last holder.
#[tauri::command]
pub async fn session_stop_logcat_lease(
    app: AppHandle,
    webview: tauri::Webview,
    state: State<'_, SessionRegistryState>,
    serial: String,
    holder: Option<String>,
) -> AppResult<SessionLeaseState> {
    let holder = logcat_holder_name(holder.or_else(|| Some(webview.label().to_string())));
    let release = LOGCAT_LEASES.lock().release(&serial, &holder);
    if let Some(run) = release.stopped {
        run.stop();
    }
    let lease = state
        .registry()
        .set_logcat_lease(&serial, release.still_held)
        .app_context("session_stop_logcat_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}
