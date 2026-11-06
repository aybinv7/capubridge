use tauri::{AppHandle, Emitter};

use crate::commands::logcat::LogcatEntryPayload;
use crate::commands::perf::PerfMetrics;
use crate::session::types::{SessionEvent, SessionLeaseState, SessionRegistrySnapshot};

pub const SESSION_EVENT_NAME: &str = "capubridge:session-event";

pub fn emit_registry_snapshot(app: &AppHandle, snapshot: SessionRegistrySnapshot) {
    let _ = app.emit(
        SESSION_EVENT_NAME,
        SessionEvent::RegistryUpdated { snapshot },
    );
}

pub fn emit_lease_state(app: &AppHandle, lease: SessionLeaseState) {
    let _ = app.emit(SESSION_EVENT_NAME, SessionEvent::LeaseStateChanged { lease });
}

pub fn emit_logcat_entry(app: &AppHandle, serial: String, entry: LogcatEntryPayload) {
    let _ = app.emit(SESSION_EVENT_NAME, SessionEvent::LogcatEntry { serial, entry });
}

pub fn emit_logcat_error(app: &AppHandle, serial: String, message: String) {
    let _ = app.emit(SESSION_EVENT_NAME, SessionEvent::LogcatError { serial, message });
}

pub fn emit_perf_metrics(app: &AppHandle, serial: String, metrics: PerfMetrics) {
    let _ = app.emit(SESSION_EVENT_NAME, SessionEvent::PerfMetrics { serial, metrics });
}

pub fn emit_perf_error(app: &AppHandle, serial: String, message: String) {
    let _ = app.emit(SESSION_EVENT_NAME, SessionEvent::PerfError { serial, message });
}
