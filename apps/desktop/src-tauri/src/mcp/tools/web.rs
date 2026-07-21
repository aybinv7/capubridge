//! Web/CDP tools: `evaluate_js`, `click_element`, `read_storage`,
//! `read_console`, `read_network`.

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, warm_up_new_capture_session, CapuBridgeTools};
use crate::mcp::cdp;
use crate::mcp::types::{ClickElementParams, EvaluateJsParams, ReadStorageParams, StorageKind, TargetParams};

#[tool_router(router = web_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "evaluate_js",
        description = "Execute a JavaScript expression in a connected WebView target via CDP Runtime.evaluate. Get target_id from list_targets. Mutates a live page: requires confirm: true, or the call fails with an explanation instead of running anything.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn evaluate_js(
        &self,
        Parameters(EvaluateJsParams {
            serial,
            target_id,
            expression,
            confirm,
        }): Parameters<EvaluateJsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if !confirm {
            return Err(ErrorData::invalid_params(
                "evaluate_js runs JavaScript in a live page and requires confirm: true. \
                 Re-call with confirm: true once you intend to run this expression."
                    .to_string(),
                None,
            ));
        }

        let target = self.find_target(&serial, &target_id)?;

        let envelope = cdp::evaluate(&target.web_socket_debugger_url, &expression)
            .await
            .map_err(|error| ErrorData::internal_error(error, None))?;
        let value = cdp::evaluate_value(&envelope).map_err(|error| {
            ErrorData::internal_error(format!("Expression threw: {error}"), None)
        })?;
        ok_json(&value)
    }

    #[tool(
        name = "click_element",
        description = "Click a DOM element in a connected WebView target by CSS selector and/or visible text, using synthetic pointer/mouse events dispatched directly on the element — NOT a physical screen tap. Prefer this over tap for interacting with a specific button/link/nav item in a Capacitor/WebView app: it either finds the exact element and clicks it, or reports found: false, so there's no silent miss the way an off-target screen coordinate has. Provide selector and/or text (selector is tried first); at least one is required. Get target_id from list_targets. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn click_element(
        &self,
        Parameters(ClickElementParams {
            serial,
            target_id,
            selector,
            text,
            confirm,
        }): Parameters<ClickElementParams>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::require_confirm(confirm, "click_element")?;
        if selector.is_none() && text.is_none() {
            return Err(ErrorData::invalid_params(
                "click_element requires at least one of selector or text".to_string(),
                None,
            ));
        }

        let target = self.find_target(&serial, &target_id)?;
        let script = cdp::click_element_script(selector.as_deref(), text.as_deref());
        let envelope = cdp::evaluate(&target.web_socket_debugger_url, &script)
            .await
            .map_err(|error| ErrorData::internal_error(error, None))?;
        let value = cdp::evaluate_value(&envelope).map_err(|error| {
            ErrorData::internal_error(format!("Expression threw: {error}"), None)
        })?;
        ok_json(&value)
    }

    #[tool(
        name = "read_storage",
        description = "Read localStorage, sessionStorage, or IndexedDB from a connected WebView target. Get target_id from list_targets. kind is one of local_storage, session_storage, indexeddb_databases, indexeddb_store. indexeddb_store additionally requires database and store, and supports limit (default 100, max 500) and offset for pagination. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_storage(
        &self,
        Parameters(ReadStorageParams {
            serial,
            target_id,
            kind,
            database,
            store,
            limit,
            offset,
        }): Parameters<ReadStorageParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let target = self.find_target(&serial, &target_id)?;

        let script = match kind {
            StorageKind::LocalStorage => cdp::local_storage_script().to_string(),
            StorageKind::SessionStorage => cdp::session_storage_script().to_string(),
            StorageKind::IndexeddbDatabases => cdp::indexeddb_databases_script().to_string(),
            StorageKind::IndexeddbStore => {
                let database = database.ok_or_else(|| {
                    ErrorData::invalid_params(
                        "kind=indexeddb_store requires 'database'".to_string(),
                        None,
                    )
                })?;
                let store = store.ok_or_else(|| {
                    ErrorData::invalid_params(
                        "kind=indexeddb_store requires 'store'".to_string(),
                        None,
                    )
                })?;
                let limit = limit.unwrap_or(100).clamp(1, 500);
                let offset = offset.unwrap_or(0);
                cdp::indexeddb_store_script(&database, &store, limit, offset)
            }
        };

        let envelope = cdp::evaluate(&target.web_socket_debugger_url, &script)
            .await
            .map_err(|error| ErrorData::internal_error(error, None))?;
        let value = cdp::evaluate_value(&envelope)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&value)
    }

    #[tool(
        name = "read_console",
        description = "Read captured console messages for a connected WebView target. Capture starts on the first call for a target; that first call waits briefly (up to ~500ms) for initial data, but may still return few or no entries if the page has been quiet — call again after triggering activity to see more. Bounded to the most recent 200 entries. Get target_id from list_targets. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_console(
        &self,
        Parameters(TargetParams { serial, target_id }): Parameters<TargetParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let target = self.find_target(&serial, &target_id)?;
        let (session, is_new) = self
            .captures
            .ensure(&target_id, &target.web_socket_debugger_url);
        warm_up_new_capture_session(is_new, || !session.console_snapshot().is_empty()).await;
        ok_json(&session.console_snapshot())
    }

    #[tool(
        name = "read_network",
        description = "Read captured network requests for a connected WebView target. Capture starts on the first call for a target; that first call waits briefly (up to ~500ms) for initial data, but may still return few or no requests if nothing is in flight — call again after triggering activity to see more. Bounded to the most recent 200 requests. Get target_id from list_targets. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_network(
        &self,
        Parameters(TargetParams { serial, target_id }): Parameters<TargetParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let target = self.find_target(&serial, &target_id)?;
        let (session, is_new) = self
            .captures
            .ensure(&target_id, &target.web_socket_debugger_url);
        warm_up_new_capture_session(is_new, || !session.network_snapshot().is_empty()).await;
        ok_json(&session.network_snapshot())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;

    #[tokio::test]
    async fn evaluate_js_without_confirm_is_rejected() {
        let result = tools()
            .evaluate_js(Parameters(EvaluateJsParams {
                serial: "does-not-matter".into(),
                target_id: "does-not-matter".into(),
                expression: "1+1".into(),
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn evaluate_js_with_confirm_but_unknown_target_errors() {
        let result = tools()
            .evaluate_js(Parameters(EvaluateJsParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
                expression: "1+1".into(),
                confirm: true,
            }))
            .await;
        let error = result.expect_err("unknown target must error, not attempt a connection");
        assert!(error.message.contains("no-such-target"));
    }

    #[tokio::test]
    async fn click_element_without_confirm_is_rejected() {
        let result = tools()
            .click_element(Parameters(ClickElementParams {
                serial: "does-not-matter".into(),
                target_id: "does-not-matter".into(),
                selector: Some("button".into()),
                text: None,
                confirm: false,
            }))
            .await;
        let error = result.expect_err("must be rejected without confirm");
        assert!(error.message.contains("confirm: true"));
    }

    #[tokio::test]
    async fn click_element_requires_selector_or_text() {
        let result = tools()
            .click_element(Parameters(ClickElementParams {
                serial: "does-not-matter".into(),
                target_id: "does-not-matter".into(),
                selector: None,
                text: None,
                confirm: true,
            }))
            .await;
        let error = result.expect_err("neither selector nor text given");
        assert!(error.message.contains("selector") && error.message.contains("text"));
    }

    #[tokio::test]
    async fn click_element_with_confirm_and_selector_but_unknown_target_errors() {
        let result = tools()
            .click_element(Parameters(ClickElementParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
                selector: Some("button".into()),
                text: None,
                confirm: true,
            }))
            .await;
        let error = result.expect_err("unknown target must error, not attempt a connection");
        assert!(error.message.contains("no-such-target"));
    }

    #[tokio::test]
    async fn read_storage_unknown_target_errors() {
        let result = tools()
            .read_storage(Parameters(ReadStorageParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
                kind: StorageKind::LocalStorage,
                database: None,
                store: None,
                limit: None,
                offset: None,
            }))
            .await;
        let error = result.expect_err("unknown target must error");
        assert!(error.message.contains("no-such-target"));
    }

    #[tokio::test]
    async fn read_console_unknown_target_errors() {
        let result = tools()
            .read_console(Parameters(TargetParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
            }))
            .await;
        let error = result.expect_err("unknown target must error");
        assert!(error.message.contains("no-such-target"));
    }

    #[tokio::test]
    async fn read_network_unknown_target_errors() {
        let result = tools()
            .read_network(Parameters(TargetParams {
                serial: "does-not-exist".into(),
                target_id: "no-such-target".into(),
            }))
            .await;
        let error = result.expect_err("unknown target must error");
        assert!(error.message.contains("no-such-target"));
    }
}
