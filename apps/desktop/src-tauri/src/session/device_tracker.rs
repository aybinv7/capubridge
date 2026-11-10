use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::AppHandle;

use crate::commands::adb::{catch_adb_panic, map_adb_server_err};
use crate::commands::adb_devices::track_devices;
use crate::session::events::emit_registry_snapshot;
use crate::session::registry::SessionRegistry;
use crate::session::types::SessionTrackerStatus;

static DEVICE_TRACKER_STARTED: AtomicBool = AtomicBool::new(false);

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
        .spawn(move || loop {
            let starting_snapshot =
                registry.update_tracker_status(SessionTrackerStatus::Starting, None);
            emit_registry_snapshot(&app, starting_snapshot);
            let _ = refresh_tx.send(());

            let tracker_app = app.clone();
            let tracker_registry = registry.clone();
            let callback_tx = refresh_tx.clone();
            let tracker_result = catch_adb_panic("session_track_devices", move || {
                let running_snapshot =
                    tracker_registry.update_tracker_status(SessionTrackerStatus::Running, None);
                emit_registry_snapshot(&tracker_app, running_snapshot);

                track_devices(move |_| {
                    let _ = callback_tx.send(());
                })
                .map_err(map_adb_server_err)
            });

            match tracker_result {
                Ok(()) => break,
                Err(error) => {
                    let error_snapshot =
                        registry.update_tracker_status(SessionTrackerStatus::Error, Some(error));
                    emit_registry_snapshot(&app, error_snapshot);
                    thread::sleep(Duration::from_secs(2));
                }
            }
        })
        .expect("failed to spawn device tracker worker");
}
