use serde::{Deserialize, Serialize};

use crate::commands::logcat::clock::ClockSample;

/// One log entry as the app receives it. `ts_ms` is the device's epoch time;
/// convert it with the status's clock offset to place it on the host clock.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogcatLinePayload {
    pub seq: u64,
    pub ts_ms: i64,
    pub uid: Option<u32>,
    pub pid: Option<u32>,
    pub tid: Option<u32>,
    pub level: char,
    pub tag: String,
    pub message: String,
    pub process_name: Option<String>,
    pub package_name: Option<String>,
}

/// Where a capture run stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LogcatStreamState {
    Connecting,
    Live,
    Reconnecting,
    Stopped,
}

/// A change in a capture run's state, with the latest clock measurement.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogcatStatusPayload {
    pub serial: String,
    pub generation: u64,
    pub state: LogcatStreamState,
    pub attempt: u32,
    pub message: Option<String>,
    pub retry_in_ms: Option<u64>,
    pub clock: Option<ClockSample>,
    pub clock_went_back: bool,
}

/// Lines delivered together, at most every poll interval.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogcatBatchPayload {
    pub serial: String,
    pub generation: u64,
    pub lines: Vec<LogcatLinePayload>,
}

/// Where a capture run reports. Implementations decide whether a report from
/// `generation` is still current.
pub(crate) trait LogcatSink: Send + Sync + 'static {
    fn lines(&self, batch: LogcatBatchPayload);
    fn status(&self, status: LogcatStatusPayload);
    fn ended(&self, serial: &str, generation: u64);
}
