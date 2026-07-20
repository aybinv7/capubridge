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
