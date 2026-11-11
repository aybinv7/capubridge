use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::AppHandle;

use crate::adb_runtime::ensure_adb_runtime;
use crate::commands::adb::{catch_adb_panic, map_adb_server_err};
use crate::commands::adb_devices::{server_answers, track_devices};
use crate::session::events::emit_registry_snapshot;
use crate::session::registry::SessionRegistry;
use crate::session::types::SessionTrackerStatus;

static DEVICE_TRACKER_STARTED: AtomicBool = AtomicBool::new(false);

/// After a failed start, the next attempt waits this long, doubling up to `RETRY_MAX`.
const RETRY_MIN: Duration = Duration::from_secs(2);
const RETRY_MAX: Duration = Duration::from_secs(30);
/// A pause after a working connection drops, before the server is checked again.
const RECONNECT_PAUSE: Duration = Duration::from_millis(500);

fn report(
    app: &AppHandle,
    registry: &SessionRegistry,
    status: SessionTrackerStatus,
    error: Option<String>,
) {
    emit_registry_snapshot(app, registry.update_tracker_status(status, error));
}

pub fn start_device_tracker(app: AppHandle, registry: Arc<SessionRegistry>) {
    if DEVICE_TRACKER_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    let (refresh_tx, refresh_rx) = mpsc::channel::<()>();

    {
        let refresh_app = app.clone();
        let refresh_registry = registry.clone();
        thread::Builder::new()
            .name("capubridge-session-refresh".to_string())
            .spawn(move || {
                while refresh_rx.recv().is_ok() {
                    while refresh_rx.recv_timeout(Duration::from_millis(150)).is_ok() {}
                    match refresh_registry.refresh_from_adb() {
                        Ok(snapshot) => emit_registry_snapshot(&refresh_app, snapshot),
                        Err(error) => {
                            let snapshot = refresh_registry
                                .update_tracker_status(SessionTrackerStatus::Error, Some(error));
                            emit_registry_snapshot(&refresh_app, snapshot);
                        }
                    }
                }
            })
            .expect("failed to spawn session refresh worker");
    }

    thread::Builder::new()
        .name("capubridge-device-tracker".to_string())
        .spawn(move || {
            let mut retry = RETRY_MIN;
            let mut failing = false;
            loop {
                if !server_answers() {
                    if !failing {
                        report(&app, &registry, SessionTrackerStatus::Starting, None);
                    }
                    if let Err(error) = ensure_adb_runtime(&app) {
                        log::warn!("[device_tracker] could not start the adb server: {error}");
                        report(&app, &registry, SessionTrackerStatus::Error, Some(error));
                        failing = true;
                        thread::sleep(retry);
                        retry = (retry * 2).min(RETRY_MAX);
                        continue;
                    }
                }

                let tracker_app = app.clone();
                let tracker_registry = registry.clone();
                let callback_tx = refresh_tx.clone();
                let connected = Arc::new(AtomicBool::new(false));
                let callback_connected = connected.clone();
                let tracker_result = catch_adb_panic("session_track_devices", move || {
                    track_devices(move |_| {
                        if !callback_connected.swap(true, Ordering::SeqCst) {
                            report(
                                &tracker_app,
                                &tracker_registry,
                                SessionTrackerStatus::Running,
                                None,
                            );
                        }
                        let _ = callback_tx.send(());
                    })
                    .map_err(map_adb_server_err)
                });

                match tracker_result {
                    Ok(()) => break,
                    Err(_) if connected.load(Ordering::SeqCst) => {
                        failing = false;
                        retry = RETRY_MIN;
                        thread::sleep(RECONNECT_PAUSE);
                    }
                    Err(error) => {
                        report(&app, &registry, SessionTrackerStatus::Error, Some(error));
                        failing = true;
                        thread::sleep(retry);
                        retry = (retry * 2).min(RETRY_MAX);
                    }
                }
            }
        })
        .expect("failed to spawn device tracker worker");
}
