use std::collections::{HashMap, VecDeque};
use std::sync::LazyLock;

use parking_lot::Mutex;

use crate::commands::logcat::types::{
    LogcatBatchPayload, LogcatLinePayload, LogcatStatusPayload, LogcatStreamMessage,
};

/// Lines kept per device for a window that joins a capture already running.
pub(crate) const BACKLOG_MAX_LINES: usize = 5_000;
/// Byte budget of that backlog, counting tag and message text.
pub(crate) const BACKLOG_MAX_BYTES: usize = 4 * 1024 * 1024;

/// Somewhere a holder receives its device's stream (a window's IPC channel).
pub(crate) trait LogcatOutlet: Send {
    /// Delivers one message; an error means the receiver is gone.
    fn send(&self, message: LogcatStreamMessage) -> Result<(), String>;
}

impl LogcatOutlet for tauri::ipc::Channel<LogcatStreamMessage> {
    fn send(&self, message: LogcatStreamMessage) -> Result<(), String> {
        tauri::ipc::Channel::send(self, message).map_err(|error| error.to_string())
    }
}

fn line_bytes(line: &LogcatLinePayload) -> usize {
    64 + line.tag.len() + line.message.len()
}

#[derive(Default)]
struct DeviceFanout {
    outlets: HashMap<String, Box<dyn LogcatOutlet>>,
    backlog: VecDeque<LogcatLinePayload>,
    backlog_bytes: usize,
    generation: u64,
    last_status: Option<LogcatStatusPayload>,
}

impl DeviceFanout {
    fn reset_for(&mut self, generation: u64) {
        if self.generation != generation {
            self.generation = generation;
            self.backlog.clear();
            self.backlog_bytes = 0;
            self.last_status = None;
        }
    }

    fn remember(&mut self, lines: &[LogcatLinePayload]) {
        for line in lines {
            self.backlog_bytes += line_bytes(line);
            self.backlog.push_back(line.clone());
        }
        while self.backlog.len() > BACKLOG_MAX_LINES || self.backlog_bytes > BACKLOG_MAX_BYTES {
            match self.backlog.pop_front() {
                Some(dropped) => self.backlog_bytes -= line_bytes(&dropped),
                None => break,
            }
        }
    }

    fn broadcast(&mut self, message: &LogcatStreamMessage) {
        self.outlets
            .retain(|_, outlet| outlet.send(message.clone()).is_ok());
    }
}

/// Delivers each device's stream to the holders that asked for it, and keeps a
/// bounded backlog so a window that joins late (a pop-out) starts with recent lines.
#[derive(Default)]
pub(crate) struct LogcatFanout {
    by_serial: HashMap<String, DeviceFanout>,
}

impl LogcatFanout {
    /// Adds `holder`'s outlet. When it joins a run that is already going it is
    /// sent the backlog and the latest status first.
    pub fn attach(
        &mut self,
        serial: &str,
        holder: &str,
        generation: u64,
        outlet: Box<dyn LogcatOutlet>,
    ) {
        let device = self.by_serial.entry(serial.to_string()).or_default();
        device.reset_for(generation);
        if let Some(status) = device.last_status.clone() {
            let _ = outlet.send(LogcatStreamMessage::Status(status));
        }
        if !device.backlog.is_empty() {
            let _ = outlet.send(LogcatStreamMessage::Batch(LogcatBatchPayload {
                serial: serial.to_string(),
                generation,
                lines: device.backlog.iter().cloned().collect(),
            }));
        }
        device.outlets.insert(holder.to_string(), outlet);
    }

    /// Removes `holder`'s outlet; the device's backlog goes with its last outlet.
    pub fn detach(&mut self, serial: &str, holder: &str) {
        let Some(device) = self.by_serial.get_mut(serial) else {
            return;
        };
        device.outlets.remove(holder);
        if device.outlets.is_empty() {
            self.by_serial.remove(serial);
        }
    }

    pub fn lines(&mut self, batch: LogcatBatchPayload) {
        let Some(device) = self.by_serial.get_mut(&batch.serial) else {
            return;
        };
        device.reset_for(batch.generation);
        device.remember(&batch.lines);
        device.broadcast(&LogcatStreamMessage::Batch(batch));
    }

    pub fn status(&mut self, status: LogcatStatusPayload) {
        let Some(device) = self.by_serial.get_mut(&status.serial) else {
            return;
        };
        device.reset_for(status.generation);
        device.last_status = Some(status.clone());
        device.broadcast(&LogcatStreamMessage::Status(status));
    }

    #[cfg(test)]
    fn backlog_len(&self, serial: &str) -> usize {
        self.by_serial
            .get(serial)
            .map_or(0, |device| device.backlog.len())
    }
}

/// Process-wide logcat fan-out.
pub(crate) static LOGCAT_FANOUT: LazyLock<Mutex<LogcatFanout>> =
    LazyLock::new(|| Mutex::new(LogcatFanout::default()));

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;
    use crate::commands::logcat::types::LogcatStreamState;

    const SERIAL: &str = "emulator-5554";

    #[derive(Clone, Default)]
    struct Recorder {
        messages: Arc<Mutex<Vec<LogcatStreamMessage>>>,
        closed: bool,
    }

    impl LogcatOutlet for Recorder {
        fn send(&self, message: LogcatStreamMessage) -> Result<(), String> {
            if self.closed {
                return Err("window closed".to_string());
            }
            self.messages.lock().push(message);
            Ok(())
        }
    }

    fn line(seq: u64) -> LogcatLinePayload {
        LogcatLinePayload {
            seq,
            ts_ms: 1_730_000_000_000 + seq as i64,
            uid: None,
            pid: Some(1),
            tid: Some(1),
            level: 'I',
            tag: "T".to_string(),
            message: format!("line {seq}"),
            process_name: None,
            package_name: None,
        }
    }

    fn batch(generation: u64, seqs: std::ops::Range<u64>) -> LogcatBatchPayload {
        LogcatBatchPayload {
            serial: SERIAL.to_string(),
            generation,
            lines: seqs.map(line).collect(),
        }
    }

    fn status(generation: u64) -> LogcatStatusPayload {
        LogcatStatusPayload {
            serial: SERIAL.to_string(),
            generation,
            state: LogcatStreamState::Live,
            attempt: 0,
            message: None,
            retry_in_ms: None,
            clock: None,
            clock_went_back: false,
        }
    }

    fn batch_seqs(message: &LogcatStreamMessage) -> Vec<u64> {
        match message {
            LogcatStreamMessage::Batch(batch) => batch.lines.iter().map(|line| line.seq).collect(),
            LogcatStreamMessage::Status(_) => Vec::new(),
        }
    }

    #[test]
    fn every_holder_gets_each_batch_once() {
        let mut fanout = LogcatFanout::default();
        let main = Recorder::default();
        let popout = Recorder::default();
        fanout.attach(SERIAL, "main", 1, Box::new(main.clone()));
        fanout.attach(SERIAL, "dock-logcat", 1, Box::new(popout.clone()));
        fanout.lines(batch(1, 0..3));
        assert_eq!(main.messages.lock().len(), 1);
        assert_eq!(popout.messages.lock().len(), 1);
    }

    #[test]
    fn a_late_joiner_starts_with_the_status_and_backlog() {
        let mut fanout = LogcatFanout::default();
        fanout.attach(SERIAL, "main", 1, Box::new(Recorder::default()));
        fanout.status(status(1));
        fanout.lines(batch(1, 0..4));
        let popout = Recorder::default();
        fanout.attach(SERIAL, "dock-logcat", 1, Box::new(popout.clone()));
        let messages = popout.messages.lock();
        assert!(matches!(messages[0], LogcatStreamMessage::Status(_)));
        assert_eq!(batch_seqs(&messages[1]), vec![0, 1, 2, 3]);
    }

    #[test]
    fn the_backlog_is_bounded_and_reset_by_a_new_run() {
        let mut fanout = LogcatFanout::default();
        fanout.attach(SERIAL, "main", 1, Box::new(Recorder::default()));
        fanout.lines(batch(1, 0..(BACKLOG_MAX_LINES as u64 + 10)));
        assert_eq!(fanout.backlog_len(SERIAL), BACKLOG_MAX_LINES);
        fanout.lines(batch(2, 0..2));
        assert_eq!(fanout.backlog_len(SERIAL), 2);
    }

    #[test]
    fn a_closed_window_is_dropped_and_the_last_detach_forgets_the_device() {
        let mut fanout = LogcatFanout::default();
        let closed = Recorder {
            closed: true,
            ..Recorder::default()
        };
        fanout.attach(SERIAL, "gone", 1, Box::new(closed));
        fanout.attach(SERIAL, "main", 1, Box::new(Recorder::default()));
        fanout.lines(batch(1, 0..1));
        fanout.detach(SERIAL, "main");
        assert_eq!(fanout.backlog_len(SERIAL), 0);
    }
}
