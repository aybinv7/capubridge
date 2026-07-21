//! Device-control tools: `list_packages`, `launch_app`, `take_screenshot`,
//! `get_screen_size`, `tap`, `swipe`, `input_text`, `press_key`, `shell_command`.

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, write_png_to_temp_file, CapuBridgeTools};
use crate::mcp::device_control;
use crate::mcp::types::{
    GetScreenSizeParams, InputTextParams, LaunchAppParams, ListPackagesParams, PackageScope,
    PressKeyParams, ScreenshotParams, ShellCommandParams, SwipeParams, TapParams,
};
use crate::commands::adb::PackageListScope;
use crate::commands::mirror::{adb_mirror_get_screen_size, adb_mirror_screenshot};
use crate::session::guards::require_online_session;

#[tool_router(router = device_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "list_packages",
        description = "List installed packages on a device. scope is third-party (default, user-installed apps) or all (includes system packages). Get serial from list_devices.",
        annotations(read_only_hint = true)
    )]
    async fn list_packages(
        &self,
        Parameters(ListPackagesParams { serial, scope }): Parameters<ListPackagesParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let scope = match scope {
            PackageScope::ThirdParty => PackageListScope::ThirdParty,
            PackageScope::All => PackageListScope::All,
        };
        let packages = session
            .list_packages(Some(scope))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&packages)
    }

    #[tool(
        name = "launch_app",
        description = "Launch an app by package name on a device. Get package_name from list_packages. Requires confirm: true.",
        annotations(read_only_hint = false)
    )]
    async fn launch_app(
        &self,
        Parameters(LaunchAppParams {
            serial,
            package_name,
            confirm,
        }): Parameters<LaunchAppParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "launch_app")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let activity = session
            .open_package(package_name)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "launchedActivity": activity }))
    }

    #[tool(
        name = "take_screenshot",
        description = "Capture a screenshot of the device screen. By default writes a PNG to a temp file and returns its path (read the file directly). Pass inline: true to instead get a base64-encoded PNG in the result — only do this if you can't read a local file path, since it's much larger. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn take_screenshot(
        &self,
        Parameters(ScreenshotParams { serial, inline }): Parameters<ScreenshotParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let png_base64 = adb_mirror_screenshot(serial)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        if inline {
            return ok_json(&serde_json::json!({ "pngBase64": png_base64 }));
        }
        let (path, size_bytes) = write_png_to_temp_file(&png_base64)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({
            "path": path.display().to_string(),
            "sizeBytes": size_bytes,
        }))
    }

    #[tool(
        name = "get_screen_size",
        description = "Get the device's physical screen size in pixels, for computing tap/swipe coordinates. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn get_screen_size(
        &self,
        Parameters(GetScreenSizeParams { serial }): Parameters<GetScreenSizeParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let size = adb_mirror_get_screen_size(serial)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&size)
    }

    #[tool(
        name = "tap",
        description = "Tap the device screen at (x, y) in screen pixels. Get screen bounds from get_screen_size. Rejected with an error if (x, y) is outside the current screen bounds. Note: a tap that lands in-bounds but on empty space still reports success — the device has no way to report whether anything was actually hit, so verify the effect with take_screenshot afterward. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn tap(
        &self,
        Parameters(TapParams { serial, x, y, confirm }): Parameters<TapParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "tap")?;
        let size = adb_mirror_get_screen_size(serial.clone())
            .map_err(|error| ErrorData::internal_error(error, None))?;
        device_control::validate_point(x, y, size.width, size.height)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::tap_command(x, y))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "swipe",
        description = "Swipe the device screen from (x1, y1) to (x2, y2) over duration_ms (default 300). Both endpoints are rejected with an error if outside the current screen bounds (get bounds from get_screen_size). Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn swipe(
        &self,
        Parameters(SwipeParams {
            serial,
            x1,
            y1,
            x2,
            y2,
            duration_ms,
            confirm,
        }): Parameters<SwipeParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "swipe")?;
        let size = adb_mirror_get_screen_size(serial.clone())
            .map_err(|error| ErrorData::internal_error(error, None))?;
        device_control::validate_point(x1, y1, size.width, size.height)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        device_control::validate_point(x2, y2, size.width, size.height)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::swipe_command(
                x1,
                y1,
                x2,
                y2,
                duration_ms.unwrap_or(300),
            ))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "input_text",
        description = "Type text into the currently focused field on the device. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn input_text(
        &self,
        Parameters(InputTextParams { serial, text, confirm }): Parameters<InputTextParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "input_text")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::input_text_command(&text))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "press_key",
        description = "Send an Android KeyEvent code to the device (3=HOME, 4=BACK, 66=ENTER, 67=DEL, 82=MENU, 187=APP_SWITCH, 26=POWER, 24/25=VOLUME_UP/DOWN). Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn press_key(
        &self,
        Parameters(PressKeyParams {
            serial,
            keycode,
            confirm,
        }): Parameters<PressKeyParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "press_key")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        session
            .shell_command(device_control::keyevent_command(keycode))
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "ok": true }))
    }

    #[tool(
        name = "shell_command",
        description = "Run an arbitrary command on the device via `adb shell`. High risk: this executes verbatim on the connected device with no restrictions — review the command carefully. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true, open_world_hint = true)
    )]
    async fn shell_command(
        &self,
        Parameters(ShellCommandParams {
            serial,
            command,
            confirm,
        }): Parameters<ShellCommandParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "shell_command")?;
        let session = require_online_session(&self.registry, &serial)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        let output = session
            .shell_command(command)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&serde_json::json!({ "output": output }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;

    #[tokio::test]
    async fn list_packages_unknown_device_errors() {
        let result = tools()
            .list_packages(Parameters(ListPackagesParams {
                serial: "does-not-exist".into(),
                scope: PackageScope::ThirdParty,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn launch_app_without_confirm_is_rejected_before_touching_the_device() {
        let result = tools()
            .launch_app(Parameters(LaunchAppParams {
                serial: "does-not-exist".into(),
                package_name: "com.example.app".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn launch_app_with_confirm_but_unknown_device_errors() {
        let result = tools()
            .launch_app(Parameters(LaunchAppParams {
                serial: "does-not-exist".into(),
                package_name: "com.example.app".into(),
                confirm: true,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn tap_without_confirm_is_rejected() {
        let result = tools()
            .tap(Parameters(TapParams {
                serial: "does-not-exist".into(),
                x: 0,
                y: 0,
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn tap_with_confirm_but_unknown_device_errors() {
        // Proves the new get_screen_size-based bounds check doesn't change
        // the outcome for an unreachable device — it still errors cleanly
        // rather than panicking or hanging.
        let result = tools()
            .tap(Parameters(TapParams {
                serial: "does-not-exist".into(),
                x: 0,
                y: 0,
                confirm: true,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn swipe_without_confirm_is_rejected() {
        let result = tools()
            .swipe(Parameters(SwipeParams {
                serial: "does-not-exist".into(),
                x1: 0,
                y1: 0,
                x2: 1,
                y2: 1,
                duration_ms: None,
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn swipe_with_confirm_but_unknown_device_errors() {
        let result = tools()
            .swipe(Parameters(SwipeParams {
                serial: "does-not-exist".into(),
                x1: 0,
                y1: 0,
                x2: 1,
                y2: 1,
                duration_ms: None,
                confirm: true,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn input_text_without_confirm_is_rejected() {
        let result = tools()
            .input_text(Parameters(InputTextParams {
                serial: "does-not-exist".into(),
                text: "hello".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn press_key_without_confirm_is_rejected() {
        let result = tools()
            .press_key(Parameters(PressKeyParams {
                serial: "does-not-exist".into(),
                keycode: 4,
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn shell_command_without_confirm_is_rejected() {
        let result = tools()
            .shell_command(Parameters(ShellCommandParams {
                serial: "does-not-exist".into(),
                command: "echo hi".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn take_screenshot_unknown_device_errors() {
        let result = tools()
            .take_screenshot(Parameters(ScreenshotParams {
                serial: "does-not-exist".into(),
                inline: false,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn get_screen_size_unknown_device_errors() {
        let result = tools()
            .get_screen_size(Parameters(GetScreenSizeParams {
                serial: "does-not-exist".into(),
            }))
            .await;
        assert!(result.is_err());
    }
}
