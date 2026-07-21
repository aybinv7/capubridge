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

/// Parameters for a tool that targets a single connected WebView target.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct TargetParams {
    /// ADB serial of the device that owns the target.
    pub serial: String,
    /// Target id from `list_targets`.
    pub target_id: String,
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

/// Parameters for clicking a DOM element in a connected WebView target.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ClickElementParams {
    /// ADB serial of the device that owns the target.
    pub serial: String,
    /// Target id from `list_targets`.
    pub target_id: String,
    /// CSS selector to find the element. Tried before `text` if both given.
    #[serde(default)]
    pub selector: Option<String>,
    /// Visible text to find the element by, if `selector` doesn't match (or
    /// is omitted). Matches an exact or substring match against a candidate
    /// element's trimmed text content; the most specific (deepest) match wins.
    #[serde(default)]
    pub text: Option<String>,
    /// Must be `true` to actually click; this mutates a live page. Call
    /// without confirm first to see this requirement echoed back.
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

/// Which packages to list via `list_packages`.
#[derive(Debug, Deserialize, JsonSchema, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum PackageScope {
    /// User-installed apps only (excludes system packages). Default.
    ThirdParty,
    /// Every installed package, including system apps.
    All,
}

impl Default for PackageScope {
    fn default() -> Self {
        Self::ThirdParty
    }
}

/// Parameters for `list_packages`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ListPackagesParams {
    /// ADB serial of the device to list packages on.
    pub serial: String,
    #[serde(default)]
    pub scope: PackageScope,
}

/// Parameters for `launch_app`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct LaunchAppParams {
    /// ADB serial of the device to launch the app on.
    pub serial: String,
    /// Package name to launch, e.g. `com.example.app`. Get valid names from `list_packages`.
    pub package_name: String,
    /// Must be `true` to actually launch the app.
    #[serde(default)]
    pub confirm: bool,
}

/// Parameters for `take_screenshot`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ScreenshotParams {
    /// ADB serial of the device to screenshot.
    pub serial: String,
    /// If `true`, return the PNG as a base64 string in the result instead of
    /// writing it to a temp file. Off by default — a full-resolution
    /// screenshot easily reaches hundreds of KB of base64 text, which can
    /// exceed a client's per-call token budget. Only set this for MCP clients
    /// that can't read a local file path.
    #[serde(default)]
    pub inline: bool,
}

/// Parameters for `tap`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct TapParams {
    pub serial: String,
    /// X coordinate in device screen pixels. Get screen size from `get_screen_size`.
    pub x: u32,
    pub y: u32,
    /// Must be `true` to actually perform the tap.
    #[serde(default)]
    pub confirm: bool,
}

/// Parameters for `swipe`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct SwipeParams {
    pub serial: String,
    pub x1: u32,
    pub y1: u32,
    pub x2: u32,
    pub y2: u32,
    /// Swipe duration in milliseconds (default 300).
    #[serde(default)]
    pub duration_ms: Option<u32>,
    /// Must be `true` to actually perform the swipe.
    #[serde(default)]
    pub confirm: bool,
}

/// Parameters for `input_text`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct InputTextParams {
    pub serial: String,
    /// Text to type into the currently focused field.
    pub text: String,
    /// Must be `true` to actually type the text.
    #[serde(default)]
    pub confirm: bool,
}

/// Parameters for `press_key`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct PressKeyParams {
    pub serial: String,
    /// Android KeyEvent code, e.g. 3 = HOME, 4 = BACK, 66 = ENTER, 67 = DEL,
    /// 187 = APP_SWITCH, 26 = POWER. See Android's KeyEvent reference for more.
    pub keycode: u32,
    /// Must be `true` to actually send the key event.
    #[serde(default)]
    pub confirm: bool,
}

/// Parameters for `get_screen_size`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetScreenSizeParams {
    pub serial: String,
}

/// Parameters for `shell_command`. High-risk: runs an arbitrary command on
/// the device via `adb shell`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ShellCommandParams {
    pub serial: String,
    /// The full shell command to run on the device, e.g. `pm list packages`.
    pub command: String,
    /// Must be `true` to actually run the command. This executes arbitrary
    /// code on the device — review the command carefully before confirming.
    #[serde(default)]
    pub confirm: bool,
}
