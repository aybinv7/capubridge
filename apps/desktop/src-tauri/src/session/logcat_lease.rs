use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use parking_lot::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State, WindowEvent};

use crate::commands::logcat::buffers::normalize_buffers;
use crate::commands::logcat::fanout::LOGCAT_FANOUT;
use crate::commands::logcat::leases::{
    logcat_holder_name, LogcatAcquire, LogcatRelease, LogcatRun, LOGCAT_LEASES,
};
use crate::commands::logcat::spawn_logcat_run;
use crate::commands::logcat::types::{
    LogcatBatchPayload, LogcatSink, LogcatStatusPayload, LogcatStreamMessage,
};
use crate::error::{AppResult, AppResultExt};
use crate::session::events::emit_lease_state;
use crate::session::live_features::require_hot_session;
use crate::session::registry::{SessionRegistry, SessionRegistryState};
use crate::session::types::SessionLeaseState;

static HOOKED_WINDOWS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

/// Delivers a run's reports to the windows holding it, dropping those of a run
/// that was replaced.
struct AppLogcatSink {
    app: AppHandle,
    registry: Arc<SessionRegistry>,
}

impl LogcatSink for AppLogcatSink {
    fn lines(&self, batch: LogcatBatchPayload) {
        if LOGCAT_LEASES
            .lock()
            .is_current(&batch.serial, batch.generation)
        {
            LOGCAT_FANOUT.lock().lines(batch);
        }
    }

    fn status(&self, status: LogcatStatusPayload) {
        if LOGCAT_LEASES
            .lock()
            .is_current(&status.serial, status.generation)
        {
            LOGCAT_FANOUT.lock().status(status);
        }
    }

    fn ended(&self, serial: &str, generation: u64) {
        let held = {
            let mut leases = LOGCAT_LEASES.lock();
            if !leases.ended(serial, generation) {
                return;
            }
            leases.is_held(serial)
        };
        if held {
            return;
        }
        if let Ok(lease) = self.registry.set_logcat_lease(serial, false) {
            emit_lease_state(&self.app, lease);
        }
    }
}

fn spawn_run(app: &AppHandle, registry: Arc<SessionRegistry>, serial: &str, run: LogcatRun) {
    let sink = Arc::new(AppLogcatSink {
        app: app.clone(),
        registry,
    });
    spawn_logcat_run(serial.to_string(), run, sink);
}

fn finish_release(serial: &str, holder: &str, release: &LogcatRelease) {
    LOGCAT_FANOUT.lock().detach(serial, holder);
    if let Some(run) = &release.stopped {
        run.stop();
    }
}

fn release_window_holder(app: &AppHandle, holder: &str) {
    let released = LOGCAT_LEASES.lock().release_everywhere(holder);
    let registry = app.state::<SessionRegistryState>().registry();
    for (serial, release) in released {
        finish_release(&serial, holder, &release);
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
/// window) and streams it to `on_event`: line batches (at most every 50 ms or
/// 500 lines) and state changes, sent only to the windows that hold it. One
/// capture runs per device, shared by every holder; a holder that joins a
/// running capture first receives its recent backlog. `restart` replaces the
/// capture with a fresh run without dropping anyone. `buffers` picks the
/// logcat buffers (`-b`); a holder that names other buffers than the running
/// capture restarts it, one that names none keeps what is running.
#[tauri::command]
pub async fn session_start_logcat_lease(
    app: AppHandle,
    webview: tauri::Webview,
    state: State<'_, SessionRegistryState>,
    serial: String,
    on_event: Channel<LogcatStreamMessage>,
    holder: Option<String>,
    restart: Option<bool>,
    buffers: Option<Vec<String>>,
) -> AppResult<SessionLeaseState> {
    require_hot_session(&state, &serial).app_context("session_start_logcat_lease")?;
    let buffers = match buffers {
        Some(names) => normalize_buffers(&names).app_context("session_start_logcat_lease")?,
        None => None,
    };

    let registry = state.registry();
    let holder = logcat_holder_name(holder.or_else(|| Some(webview.label().to_string())));
    let outcome = LOGCAT_LEASES.lock().acquire(
        &serial,
        &holder,
        restart.unwrap_or(false),
        buffers.as_deref(),
    );
    let generation = match &outcome {
        LogcatAcquire::Start { run, .. } => run.generation,
        LogcatAcquire::Joined { generation } => *generation,
    };
    LOGCAT_FANOUT
        .lock()
        .attach(&serial, &holder, generation, Box::new(on_event));
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
    finish_release(&serial, &holder, &release);
    let lease = state
        .registry()
        .set_logcat_lease(&serial, release.still_held)
        .app_context("session_stop_logcat_lease")?;
    emit_lease_state(&app, lease.clone());
    Ok(lease)
}
