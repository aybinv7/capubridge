use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools};
use crate::commands::emulator::{emulator_launch_avd, emulator_list_avds};
use crate::mcp::types::LaunchEmulatorParams;

#[tool_router(router = emulator_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "list_emulators",
        description = "List Android Virtual Devices installed on this computer. These are launchable AVD definitions, not yet-running ADB devices. After launching one, wait until it appears in list_devices with deviceKind: emulator.",
        annotations(read_only_hint = true)
    )]
    async fn list_emulators(&self) -> Result<CallToolResult, ErrorData> {
        let emulators = emulator_list_avds().map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&emulators)
    }

    #[tool(
        name = "launch_emulator",
        description = "Open an installed Android Virtual Device by name. Call list_emulators first and use its exact avd_name. This opens a visible emulator window, then it will appear in list_devices when ADB is ready. Requires confirm: true.",
        annotations(read_only_hint = false)
    )]
    async fn launch_emulator(
        &self,
        Parameters(LaunchEmulatorParams { avd_name, confirm }): Parameters<LaunchEmulatorParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "launch_emulator")?;
        let result = emulator_launch_avd(avd_name)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        ok_json(&result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;

    #[tokio::test]
    async fn launch_emulator_without_confirmation_is_rejected() {
        let result = tools()
            .launch_emulator(Parameters(LaunchEmulatorParams {
                avd_name: "Pixel_9".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }
}
