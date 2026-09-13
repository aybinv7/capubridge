use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools};
use crate::mcp::types::{MockRuleParams, SetMockModeParams};

#[tool_router(router = mock_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "upsert_mock_rule",
        description = "Create or update an HTTP/CDP interception rule in the CapuBridge app. Call set_mock_mode with mode cdp after selecting the target to make the rule intercept its WebView requests. This changes CapuBridge's persisted mock configuration and requires confirm: true.",
        annotations(read_only_hint = false)
    )]
    async fn upsert_mock_rule(
        &self,
        Parameters(params): Parameters<MockRuleParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(params.confirm, "upsert_mock_rule")?;
        let payload = serde_json::json!({
            "id": params.id,
            "name": params.name,
            "method": params.method,
            "urlPattern": params.url_pattern,
            "urlMatchType": params.url_match_type,
            "statusCode": params.status_code,
            "contentType": params.content_type.unwrap_or_else(|| "application/json".to_string()),
            "responseHeaders": params.response_headers.unwrap_or_default().into_iter().map(|header| serde_json::json!({
                "id": uuid::Uuid::new_v4().to_string(),
                "name": header.name,
                "value": header.value,
            })).collect::<Vec<_>>(),
            "responseBody": params.response_body,
            "delayMs": params.delay_ms.unwrap_or(0),
            "passThrough": params.pass_through.unwrap_or(false),
            "enabled": params.enabled.unwrap_or(true),
        });
        let result = self.bridge_call("upsert_mock_rule", payload).await?;
        ok_json(&result)
    }

    #[tool(
        name = "set_mock_mode",
        description = "Set CapuBridge mock mode: cdp intercepts requests inside the selected WebView; http runs its local mock server; off disables mocking. Requires confirm: true because it changes CapuBridge's persisted mock configuration.",
        annotations(read_only_hint = false)
    )]
    async fn set_mock_mode(
        &self,
        Parameters(params): Parameters<SetMockModeParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(params.confirm, "set_mock_mode")?;
        let result = self
            .bridge_call("set_mock_mode", serde_json::json!({ "mode": params.mode }))
            .await?;
        ok_json(&result)
    }
}
