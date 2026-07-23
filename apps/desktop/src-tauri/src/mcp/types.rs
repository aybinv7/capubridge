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

/// Parameters for long-pressing a DOM element in a connected WebView target.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct LongPressParams {
    /// ADB serial of the device that owns the target.
    pub serial: String,
    /// Target id from `list_targets`.
    pub target_id: String,
    /// CSS selector to find the element. Tried before `text` if both given.
    #[serde(default)]
    pub selector: Option<String>,
    /// Visible text to find the element by, if `selector` doesn't match (or
    /// is omitted). Same matching rules as `click_element`.
    #[serde(default)]
    pub text: Option<String>,
    /// How long to hold the press, in milliseconds (default 600).
    #[serde(default)]
    pub duration_ms: Option<u32>,
    /// Must be `true` to actually perform the long press; this mutates a live
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

/// Which packages to list via `list_packages`.
#[derive(Debug, Default, Deserialize, JsonSchema, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum PackageScope {
    /// User-installed apps only (excludes system packages). Default.
    #[default]
    ThirdParty,
    /// Every installed package, including system apps.
    All,
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

/// Parameters for `read_recording` — read one saved session's overview.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ReadRecordingParams {
    /// Absolute path to the `.capu` session file (from `list_recordings`).
    pub file_path: String,
}

/// Parameters for `read_recording_track` — page through one event track.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ReadRecordingTrackParams {
    /// Absolute path to the `.capu` session file (from `list_recordings`).
    pub file_path: String,
    /// Track name: one of rrweb, network, console, perf, databases.
    pub track: String,
    /// Events to skip from the start of the track (default 0).
    #[serde(default)]
    pub offset: Option<u32>,
    /// Max events to return (default 100, clamped to 500).
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Parameters for `read_recording_db` — inspect recorded database state at a
/// point on the session timeline.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ReadRecordingDbParams {
    /// Path to the recording's extracted SQLite database, from
    /// `read_recording`'s `databasePath` field.
    pub database_path: String,
    /// Timeline position in milliseconds (relative to the recording start).
    pub position_ms: i64,
    /// A specific source id (from `read_recording`'s `databaseSources`) to read
    /// rows for. Omit to get a per-source change summary at this position
    /// (the timeline overview) instead of rows.
    #[serde(default)]
    pub source_id: Option<String>,
    /// Rows to skip when `source_id` is given (default 0).
    #[serde(default)]
    pub offset: Option<i64>,
    /// Max rows to return when `source_id` is given (default 100, max 500).
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Parameters for `select_target` — drive the app UI to select + connect a
/// CDP target so the frontend has a live connection (e.g. before recording).
#[derive(Debug, Deserialize, JsonSchema)]
pub struct SelectTargetParams {
    /// ADB serial of the device that owns the target.
    pub serial: String,
    /// Target id to select and connect, from `list_targets`.
    pub target_id: String,
}

/// Parameters for `start_recording` — start a replay recording in the app UI
/// on the currently selected+connected target. Track flags default to a
/// lightweight DOM+network+console capture; heavier tracks are opt-in.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct StartRecordingParams {
    /// Human-readable label for the session (default "AI recording").
    #[serde(default)]
    pub label: Option<String>,
    /// Capture DOM (rrweb) — the visual replay track. Default true.
    #[serde(default)]
    pub rrweb: Option<bool>,
    /// Capture network requests. Default true.
    #[serde(default)]
    pub network: Option<bool>,
    /// Capture console output. Default true.
    #[serde(default)]
    pub console: Option<bool>,
    /// Capture performance metrics. Default false (heavier).
    #[serde(default)]
    pub perf: Option<bool>,
    /// Capture database snapshots/changes. Default false (heavier). When true,
    /// enable the specific db tracks below.
    #[serde(default)]
    pub databases: Option<bool>,
    /// Capture localStorage changes (requires databases). Default false.
    #[serde(default)]
    pub local_storage: Option<bool>,
    /// Capture IndexedDB changes (requires databases). Default false.
    #[serde(default)]
    pub indexed_db: Option<bool>,
    /// Reload the target page first for a clean rrweb DOM snapshot. Disruptive
    /// (reloads the live page); default false.
    #[serde(default)]
    pub reload_target: Option<bool>,
    /// Must be `true` to actually start recording (it acts on the live app,
    /// and reload_target reloads the page).
    #[serde(default)]
    pub confirm: bool,
}

/// Parameters for `query_recording` — filter one track of a saved session and
/// optionally correlate matches against another track by a timestamp window.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct QueryRecordingParams {
    /// Absolute path to the `.capu` session file (from `list_recordings`).
    pub file_path: String,
    /// Track to filter: network, console, rrweb, perf, or databases.
    pub track: String,
    /// Network: minimum HTTP status (e.g. 400 for errors). Events without a
    /// status (failed/no-response) do not match a numeric threshold.
    #[serde(default)]
    pub min_status: Option<i64>,
    /// Network: maximum HTTP status.
    #[serde(default)]
    pub max_status: Option<i64>,
    /// Network: case-insensitive substring match on the request URL.
    #[serde(default)]
    pub url_pattern: Option<String>,
    /// Network: case-insensitive exact match on resource type (e.g. XHR, Fetch).
    #[serde(default)]
    pub resource_type: Option<String>,
    /// Network: case-insensitive exact match on HTTP method.
    #[serde(default)]
    pub method: Option<String>,
    /// Console: case-insensitive exact match on level (error, warning, log, ...).
    #[serde(default)]
    pub level: Option<String>,
    /// Only include events at or after this ms offset from the recording start.
    #[serde(default)]
    pub start_ms: Option<i64>,
    /// Only include events at or before this ms offset.
    #[serde(default)]
    pub end_ms: Option<i64>,
    /// Max matches to return (default 50, clamped to 200). Results are compact
    /// projections, not full payloads — set verbose for full data.
    #[serde(default)]
    pub limit: Option<u32>,
    /// Matches to skip (default 0).
    #[serde(default)]
    pub offset: Option<u32>,
    /// Return each event's full `data` instead of the compact projection.
    /// Off by default — network bodies/headers are large.
    #[serde(default)]
    pub verbose: Option<bool>,
    /// Correlate each match against this other track (e.g. query network with
    /// correlate_track=console to see console output around each request).
    #[serde(default)]
    pub correlate_track: Option<String>,
    /// Correlation window in ms on either side of a match (default 500).
    #[serde(default)]
    pub correlate_window_ms: Option<i64>,
}
