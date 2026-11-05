use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tokio::net::tcp::OwnedWriteHalf;
use tokio::sync::{Mutex as TokioMutex, Notify};

/// The live stream per device: its generation and the signal that stops it. A stream's own
/// teardown only cleans the device while it is still the live one, so a stream that ends late
/// never kills the server a newer stream just started.
static SCRCPY_STREAM_SHUTDOWNS: LazyLock<Mutex<HashMap<String, (u64, Arc<Notify>)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static SCRCPY_STREAM_GENERATION: AtomicU64 = AtomicU64::new(0);
static SCRCPY_CONTROL_SESSIONS: LazyLock<Mutex<HashMap<String, ScrcpyControlSession>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
pub(crate) struct ScrcpyControlSession {
    pub(crate) socket: Arc<TokioMutex<OwnedWriteHalf>>,
    pub(crate) width: u16,
    pub(crate) height: u16,
}

fn clamp_u16_size(size: u32) -> u16 {
    size.min(u16::MAX as u32) as u16
}

/// Makes this stream the live one for the device and returns its generation.
pub(crate) fn register_scrcpy_stream(serial: &str, shutdown: Arc<Notify>) -> Result<u64, String> {
    let generation = SCRCPY_STREAM_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    SCRCPY_STREAM_SHUTDOWNS
        .lock()
        .map_err(|_| "scrcpy shutdown map lock poisoned".to_string())?
        .insert(serial.to_string(), (generation, shutdown));
    Ok(generation)
}

pub(crate) fn stop_scrcpy_stream_session(serial: &str) {
    if let Ok(mut sessions) = SCRCPY_STREAM_SHUTDOWNS.lock() {
        if let Some((_, notify)) = sessions.remove(serial) {
            notify.notify_waiters();
        }
    }
}

/// Forgets the stream if it is still the live one for its device; true when it was.
pub(crate) fn release_scrcpy_stream_generation(serial: &str, generation: u64) -> bool {
    let Ok(mut sessions) = SCRCPY_STREAM_SHUTDOWNS.lock() else {
        return false;
    };
    match sessions.get(serial) {
        Some((live, _)) if *live == generation => {
            sessions.remove(serial);
            true
        }
        _ => false,
    }
}

pub(crate) fn insert_scrcpy_control_session(
    serial: &str,
    socket: Arc<TokioMutex<OwnedWriteHalf>>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    SCRCPY_CONTROL_SESSIONS
        .lock()
        .map_err(|_| "scrcpy control map lock poisoned".to_string())?
        .insert(
            serial.to_string(),
            ScrcpyControlSession {
                socket,
                width: clamp_u16_size(width),
                height: clamp_u16_size(height),
            },
        );
    Ok(())
}

pub(crate) fn remove_scrcpy_control_session(serial: &str) {
    if let Ok(mut sessions) = SCRCPY_CONTROL_SESSIONS.lock() {
        sessions.remove(serial);
    }
}

/// Keep touch coordinate mapping in sync after a mid-stream resize/rotation.
pub(crate) fn update_scrcpy_control_size(serial: &str, width: u32, height: u32) {
    if let Ok(mut sessions) = SCRCPY_CONTROL_SESSIONS.lock() {
        if let Some(session) = sessions.get_mut(serial) {
            session.width = clamp_u16_size(width);
            session.height = clamp_u16_size(height);
        }
    }
}

pub(crate) fn get_scrcpy_control_session(serial: &str) -> Option<ScrcpyControlSession> {
    SCRCPY_CONTROL_SESSIONS
        .lock()
        .ok()
        .and_then(|sessions| sessions.get(serial).cloned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_superseded_stream_does_not_claim_the_device() {
        let serial = "generation-test-superseded";
        let first = register_scrcpy_stream(serial, Arc::new(Notify::new())).expect("register");
        stop_scrcpy_stream_session(serial);
        let second = register_scrcpy_stream(serial, Arc::new(Notify::new())).expect("register");

        assert!(!release_scrcpy_stream_generation(serial, first));
        assert!(release_scrcpy_stream_generation(serial, second));
        assert!(!release_scrcpy_stream_generation(serial, second));
    }

    #[test]
    fn a_stopped_stream_leaves_cleanup_to_the_stop() {
        let serial = "generation-test-stopped";
        let generation = register_scrcpy_stream(serial, Arc::new(Notify::new())).expect("register");
        stop_scrcpy_stream_session(serial);

        assert!(!release_scrcpy_stream_generation(serial, generation));
    }
}
