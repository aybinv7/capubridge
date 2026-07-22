//! Tools that drive the running Vue frontend via the bridge (see
//! [`crate::mcp::bridge`]). These need the app window open; when it isn't (or
//! the precondition they need isn't met), they return a clear error rather
//! than hanging.

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools};
use crate::mcp::types::SelectTargetParams;

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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;

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
}
