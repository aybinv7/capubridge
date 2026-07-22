//! Tools that drive the running Vue frontend via the bridge (see
//! [`crate::mcp::bridge`]). These need the app window open; when it isn't (or
//! the precondition they need isn't met), they return a clear error rather
//! than hanging.

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools};
use crate::mcp::types::{SelectTargetParams, StartRecordingParams};

#[tool_router(router = frontend_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "select_target",
        description = "Select and connect a CDP target IN THE APP UI (the frontend's own connection, separate from what evaluate_js/read_storage use). This is the precondition for recording: the frontend can only record a target it is connected to. Get serial + target_id from list_targets. Requires the CapuBridge app window to be open. Returns the connected target, or errors if the app isn't running or the target can't be found/connected.",
        annotations(read_only_hint = false)
    )]
    async fn select_target(
        &self,
        Parameters(SelectTargetParams { serial, target_id }): Parameters<SelectTargetParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call(
                "select_target",
                serde_json::json!({ "serial": serial, "targetId": target_id }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "start_recording",
        description = "Start a replay recording in the app UI on the currently selected+connected target (call select_target first). Track flags default to DOM (rrweb) + network + console; perf and databases are opt-in. Returns the session id once recording. Requires the app window open and a connected target, and confirm: true (it records the live app; reload_target reloads the page). Stop with stop_recording; inspect the result later with list_recordings / read_recording.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn start_recording(
        &self,
        Parameters(params): Parameters<StartRecordingParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(params.confirm, "start_recording")?;

        // Assemble the RecordingConfig the frontend expects, applying defaults:
        // a lightweight DOM+network+console capture unless told otherwise.
        let config = serde_json::json!({
            "label": params.label.unwrap_or_else(|| "AI recording".to_string()),
            "tracks": {
                "rrweb": params.rrweb.unwrap_or(true),
                "network": params.network.unwrap_or(true),
                "console": params.console.unwrap_or(true),
                "perf": params.perf.unwrap_or(false),
                "databases": params.databases.unwrap_or(false),
            },
            "databaseTracks": {
                "localStorage": params.local_storage.unwrap_or(false),
                "indexedDB": params.indexed_db.unwrap_or(false),
            },
            "reloadTarget": params.reload_target.unwrap_or(false),
        });

        let result = self.bridge_call("start_recording", config).await?;
        ok_json(&result)
    }

    #[tool(
        name = "stop_recording",
        description = "Stop the recording in progress in the app UI and finalize the .capu session file. Returns the saved file path (usable with read_recording), or reports that nothing was recording. Requires the app window open. Read-only-ish (finalizes; no confirm needed).",
        annotations(read_only_hint = false)
    )]
    async fn stop_recording(&self) -> Result<CallToolResult, ErrorData> {
        let result = self.bridge_call("stop_recording", serde_json::Value::Null).await?;
        ok_json(&result)
    }

    #[tool(
        name = "get_recording_status",
        description = "Report whether a recording is currently in progress in the app UI: phase, session id, and start time. Requires the app window open. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn get_recording_status(&self) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call("recording_status", serde_json::Value::Null)
            .await?;
        ok_json(&result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;

    fn start_params(confirm: bool) -> StartRecordingParams {
        StartRecordingParams {
            label: None,
            rrweb: None,
            network: None,
            console: None,
            perf: None,
            databases: None,
            local_storage: None,
            indexed_db: None,
            reload_target: None,
            confirm,
        }
    }

    #[tokio::test]
    async fn select_target_without_app_handle_errors_clearly() {
        // The unit fixture has no AppHandle, so the bridge call can't run — it
        // must fail with a clear message, not hang or panic.
        let result = tools()
            .select_target(Parameters(SelectTargetParams {
                serial: "serial".into(),
                target_id: "target".into(),
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn start_recording_without_confirm_is_rejected() {
        let result = tools()
            .start_recording(Parameters(start_params(false)))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn start_recording_with_confirm_but_no_app_handle_errors() {
        // Passes the confirm gate, then fails at the bridge (no app in tests).
        let result = tools()
            .start_recording(Parameters(start_params(true)))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn stop_recording_without_app_handle_errors() {
        assert!(tools().stop_recording().await.is_err());
    }

    #[tokio::test]
    async fn get_recording_status_without_app_handle_errors() {
        assert!(tools().get_recording_status().await.is_err());
    }
}
