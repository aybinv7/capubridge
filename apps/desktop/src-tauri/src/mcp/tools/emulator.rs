use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools};
use crate::commands::emulator::{emulator_launch_avd, emulator_list_avds, emulator_stop_avd};
use crate::mcp::types::{LaunchEmulatorParams, StopEmulatorParams};

#[tool_router(router = emulator_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "list_emulators",
        description = "List Android Virtual Devices installed on this computer. Each entry has `running: null` when the AVD is not started, or `running: { serial, pid }` when an instance is alive — that serial is what list_devices and the device tools use. After launching one, wait until it appears in list_devices with deviceKind: emulator and status online.",
        annotations(read_only_hint = true)
    )]
    async fn list_emulators(&self) -> Result<CallToolResult, ErrorData> {
        let emulators =
            emulator_list_avds().map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&emulators)
    }

    #[tool(
        name = "launch_emulator",
        description = "Start an installed Android Virtual Device by name. Call list_emulators first and use its exact name. If the AVD is already running this returns `alreadyRunning: true` with its serial instead of starting a second instance. Otherwise it clears stale lock files, starts the emulator, and fails fast with the emulator's own FATAL line if it dies while starting. Boot takes ~30s more after this returns; poll list_devices until the emulator is online. Requires confirm: true.",
        annotations(read_only_hint = false)
    )]
    async fn launch_emulator(
        &self,
        Parameters(LaunchEmulatorParams { avd_name, confirm }): Parameters<LaunchEmulatorParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "launch_emulator")?;
        let result = emulator_launch_avd(avd_name)
            .map_err(|error| ErrorData::invalid_params(error, None))?;
        ok_json(&result)
    }

    #[tool(
        name = "stop_emulator",
        description = "Stop a running Android Virtual Device by name. Terminates the emulator process (so the next boot is a cold boot) and clears its lock files — use this to recover an emulator that is stuck offline in ADB and never finished booting. Requires confirm: true.",
        annotations(read_only_hint = false)
    )]
    async fn stop_emulator(
        &self,
        Parameters(StopEmulatorParams { avd_name, confirm }): Parameters<StopEmulatorParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "stop_emulator")?;
        let result =
            emulator_stop_avd(avd_name).map_err(|error| ErrorData::invalid_params(error, None))?;
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
