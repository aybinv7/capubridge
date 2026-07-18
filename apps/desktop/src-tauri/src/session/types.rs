use crate::commands::adb::LogcatEntryPayload;
use crate::commands::perf::PerfMetrics;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionTrackerStatus {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionTemperature {
    Cold,
    Warm,
    Hot,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionCleanupState {
    #[default]
    Active,
    ShuttingDown,
    Detached,
    Stopped,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionHealthSnapshot {
    pub queue_depth: usize,
    pub queue_capacity: usize,
    pub active_operation: Option<String>,
    pub last_terminal_failure: Option<String>,
    pub connection_age_ms: u64,
    pub cleanup_state: SessionCleanupState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDeviceSnapshot {
    pub serial: String,
    pub model: String,
    pub product: String,
    pub transport_id: String,
    pub connection_type: String,
    pub status: String,
    pub temperature: SessionTemperature,
    pub is_stale: bool,
    pub last_seen_at: Option<u64>,
    pub last_updated_at: u64,
    #[serde(default)]
    pub health: Option<SessionHealthSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRegistrySnapshot {
    pub devices: Vec<SessionDeviceSnapshot>,
    pub active_serial: Option<String>,
    pub tracker_status: SessionTrackerStatus,
    pub revision: u64,
    pub last_error: Option<String>,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTargetSnapshot {
    pub serial: String,
    pub id: String,
    #[serde(rename = "type")]
    pub target_type: String,
    pub title: String,
    pub url: String,
    #[serde(rename = "devtoolsFrontendUrl")]
    pub devtools_frontend_url: Option<String>,
    #[serde(rename = "webSocketDebuggerUrl")]
    pub web_socket_debugger_url: String,
    #[serde(rename = "faviconUrl")]
    pub favicon_url: Option<String>,
    pub package_name: Option<String>,
    pub is_stale: bool,
    pub last_updated_at: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionLeaseKind {
    Logcat,
    Perf,
    Mirror,
    Console,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLeaseState {
    pub serial: String,
    pub kind: SessionLeaseKind,
    pub active: bool,
    pub target_id: Option<String>,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SessionEvent {
    RegistryUpdated { snapshot: SessionRegistrySnapshot },
    LeaseStateChanged { lease: SessionLeaseState },
    LogcatEntry { serial: String, entry: LogcatEntryPayload },
    LogcatError { serial: String, message: String },
    PerfMetrics { serial: String, metrics: PerfMetrics },
    PerfError { serial: String, message: String },
}
