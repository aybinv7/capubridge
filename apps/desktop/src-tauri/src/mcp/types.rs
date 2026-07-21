//! Input parameter types for the MCP tool surface.
//!
//! Tool outputs reuse the existing session snapshot types (which already derive
//! `Serialize`); only the inputs need `JsonSchema` for the MCP input schema.

use schemars::JsonSchema;
use serde::Deserialize;

/// Parameters for a tool that targets a single device by serial.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct SerialParams {
    /// ADB serial of the device to target. Get valid serials from `list_devices`.
    pub serial: String,
}

/// Parameters for selecting (or clearing) the active device.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct SelectDeviceParams {
    /// ADB serial to make active. Omit or pass null to clear the active device.
    #[serde(default)]
    pub serial: Option<String>,
}

/// Parameters for executing JavaScript in a connected WebView target.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct EvaluateJsParams {
    /// ADB serial of the device that owns the target.
    pub serial: String,
    /// Target id from `list_targets`.
    pub target_id: String,
    /// JavaScript expression to evaluate in the page context.
    pub expression: String,
    /// Must be `true` to actually run the expression; this tool mutates a live
    /// page. Call without confirm first to see this requirement echoed back.
    #[serde(default)]
    pub confirm: bool,
}

/// Which storage to read via `read_storage`.
#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum StorageKind {
    LocalStorage,
    SessionStorage,
    IndexeddbDatabases,
    IndexeddbStore,
}

/// Parameters for reading storage from a connected WebView target.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ReadStorageParams {
    /// ADB serial of the device that owns the target.
    pub serial: String,
    /// Target id from `list_targets`.
    pub target_id: String,
    pub kind: StorageKind,
    /// Required when `kind` is `indexeddb_store`.
    #[serde(default)]
    pub database: Option<String>,
    /// Required when `kind` is `indexeddb_store`.
    #[serde(default)]
    pub store: Option<String>,
    /// Max rows to return for `indexeddb_store` (default 100, clamped to 500).
    #[serde(default)]
    pub limit: Option<u32>,
    /// Rows to skip for `indexeddb_store` (default 0).
    #[serde(default)]
    pub offset: Option<u32>,
}
