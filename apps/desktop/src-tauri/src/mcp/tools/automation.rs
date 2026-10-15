//! Automation workbench tools: the outer loop for external agents.
//!
//! The fast inner loop (observe, decide, act) lives inside CapuBridge and is
//! never exposed here: a step decision has a 70-500 ms budget and an MCP
//! round-trip per step would cost seconds. These tools serve the outer loop
//! instead — starting runs, reading traces, diagnosing failures and
//! promoting runs to flows — and drive the app UI through the frontend
//! bridge, so the executor, stores and recording pipeline stay exactly the
//! ones the user sees. Starting and observing are separate calls because
//! runs are long-lived and no tool may block for a whole run.

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools, McpRequestIdentity};
use crate::mcp::types::{
    CancelRunParams, DeleteFlowParams, PromoteRunParams, ReadRunTraceParams, RunAgentGoalParams,
    RunFlowParams, RunIdParams, SaveFlowParams, UpdateFlowParams, TaskIdParams, ReadTaskEventsParams,
    CancelTaskParams, HandoffTaskParams, UpdateTaskPlanParams, PauseResumeTaskParams, ExecuteTaskBatchParams,
    VerifyTaskParams, WaitForRunParams,
};

/// Policies that run locally. Anything else sends redacted screen structure
/// off this machine and needs explicit acknowledgement per call.
const LOCAL_POLICIES: [&str; 2] = ["rules", "artemis"];
const SUPPORTED_POLICIES: [&str; 4] = ["rules", "artemis", "jev", "embedded"];

/// Maximum trace records returned in one read.
const MAX_TRACE_LIMIT: u64 = 500;

#[tool_router(router = automation_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "run_flow",
        description = "Start a saved automation flow on a device (via the app UI). Returns a run id immediately; then call wait_for_run once instead of polling get_run_status. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn run_flow(
        &self,
        identity: McpRequestIdentity,
        Parameters(RunFlowParams {
            flow_id,
            device_serial,
            confirm,
        }): Parameters<RunFlowParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "run_flow")?;
        let result = self
            .bridge_call(
                "automation_run_flow",
                serde_json::json!({
                    "flowId": flow_id,
                    "deviceSerial": device_serial,
                    "principalId": identity.principal.id,
                    "connectionId": identity.connection_id,
                    "clientName": identity.principal.name,
                }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "run_agent_goal",
        description = "Start an agent-goal automation run with a policy (via the app UI). Returns a run id immediately; then call wait_for_run once instead of polling get_run_status. Jev and embedded reasoning send redacted screen structure off this machine and need acknowledge_data_notice: true. Pass app_package (the one app the goal may act in) unless flow_id names a flow that declares one. ARTEMIS runs locally and preserves its own supervised trace. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn run_agent_goal(
        &self,
        identity: McpRequestIdentity,
        Parameters(RunAgentGoalParams {
            goal,
            policy_id,
            device_serial,
            flow_id,
            app_package,
            limits,
            acknowledge_data_notice,
            confirm,
        }): Parameters<RunAgentGoalParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if !SUPPORTED_POLICIES.contains(&policy_id.as_str()) {
            return Err(ErrorData::invalid_params(
                format!("Policy '{policy_id}' is unavailable in the current automation bridge."),
                None,
            ));
        }
        if !LOCAL_POLICIES.contains(&policy_id.as_str()) && !acknowledge_data_notice.unwrap_or(false) {
            return Err(ErrorData::invalid_params(
                format!(
                    "Policy '{policy_id}' sends redacted screen structure off this machine. \
                     Re-call with acknowledge_data_notice: true to accept the transfer."
                ),
                None,
            ));
        }
        self.require_mutation(confirm, "run_agent_goal")?;
        let result = self
            .bridge_call(
                "automation_run_agent_goal",
                serde_json::json!({
                    "goal": goal,
                    "policyId": policy_id,
                    "deviceSerial": device_serial,
                    "flowId": flow_id,
                    "appPackage": app_package,
                    "limits": limits.map(|bounds| serde_json::json!({
                        "maxSteps": bounds.max_steps,
                        "maxDurationMs": bounds.max_duration_ms,
                        "maxConsecutiveFailures": bounds.max_consecutive_failures,
                    })),
                    "acknowledgeDataNotice": acknowledge_data_notice.unwrap_or(false),
                    "principalId": identity.principal.id,
                    "connectionId": identity.connection_id,
                    "clientName": identity.principal.name,
                }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "task_create",
        description = "Create and start a durable automation task. Returns taskId and runId immediately; use task_get and task_read_trace for progress. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn task_create(
        &self,
        identity: McpRequestIdentity,
        Parameters(RunAgentGoalParams {
            goal,
            policy_id,
            device_serial,
            flow_id,
            app_package,
            limits,
            acknowledge_data_notice,
            confirm,
        }): Parameters<RunAgentGoalParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if !SUPPORTED_POLICIES.contains(&policy_id.as_str()) {
            return Err(ErrorData::invalid_params(format!("Policy '{policy_id}' is unavailable in the current automation bridge."), None));
        }
        if !LOCAL_POLICIES.contains(&policy_id.as_str()) && !acknowledge_data_notice.unwrap_or(false) {
            return Err(ErrorData::invalid_params("Remote task creation requires acknowledge_data_notice: true.".to_string(), None));
        }
        self.require_mutation(confirm, "task_create")?;
        let result = self
            .bridge_call(
                "automation_run_agent_goal",
                serde_json::json!({
                    "goal": goal,
                    "policyId": policy_id,
                    "deviceSerial": device_serial,
                    "flowId": flow_id,
                    "appPackage": app_package,
                    "limits": limits.map(|bounds| serde_json::json!({
                        "maxSteps": bounds.max_steps,
                        "maxDurationMs": bounds.max_duration_ms,
                        "maxConsecutiveFailures": bounds.max_consecutive_failures,
                    })),
                    "acknowledgeDataNotice": acknowledge_data_notice.unwrap_or(false),
                    "principalId": identity.principal.id,
                    "connectionId": identity.connection_id,
                    "clientName": identity.principal.name,
                }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "get_run_status",
        description = "Status, current step and outcome of an automation run started by run_flow / run_agent_goal. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn get_run_status(
        &self,
        Parameters(RunIdParams { run_id }): Parameters<RunIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call(
                "automation_get_run_status",
                serde_json::json!({ "runId": run_id }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "wait_for_run",
        description = "Block until an automation run finishes (or timeout_secs, default 50, max 110) and return a compact summary: status, failure reason, duration and one line per step (last 40). Use this instead of polling get_run_status: one call replaces the whole poll loop. done: false means still running; call again. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn wait_for_run(
        &self,
        Parameters(WaitForRunParams { run_id, timeout_secs }): Parameters<WaitForRunParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let wait = std::time::Duration::from_secs(timeout_secs.unwrap_or(50).clamp(1, 110));
        let result = self
            .bridge_call_with_timeout(
                "automation_wait_for_run",
                serde_json::json!({ "runId": run_id, "timeoutMs": wait.as_millis() as u64 }),
                wait + std::time::Duration::from_secs(10),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(name = "task_get", description = "Read the durable task and current attempt by task id. Read-only.", annotations(read_only_hint = true))]
    async fn task_get(
        &self,
        Parameters(TaskIdParams { task_id }): Parameters<TaskIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call("automation_get_task", serde_json::json!({ "taskId": task_id }))
            .await?;
        ok_json(&result)
    }

    #[tool(name = "task_observe", description = "Capture the task device's current redacted observation and append it to the task trace. Read-only.", annotations(read_only_hint = true))]
    async fn task_observe(
        &self,
        Parameters(TaskIdParams { task_id }): Parameters<TaskIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self.bridge_call("automation_observe_task", serde_json::json!({ "taskId": task_id })).await?;
        ok_json(&result)
    }

    #[tool(name = "task_read_trace", description = "Read bounded canonical task events by task id. Read-only.", annotations(read_only_hint = true))]
    async fn task_read_trace(
        &self,
        Parameters(ReadTaskEventsParams { task_id, cursor, limit }): Parameters<ReadTaskEventsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call(
                "automation_read_task_events",
                serde_json::json!({ "taskId": task_id, "cursor": cursor, "limit": limit.unwrap_or(100).clamp(1, MAX_TRACE_LIMIT) }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "read_run_trace",
        description = "Page through an automation run's step records with decisions, outcomes and assertion results. Bounded output: offset defaults to 0, limit defaults to 100 and is clamped to 500. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_run_trace(
        &self,
        Parameters(ReadRunTraceParams {
            run_id,
            offset,
            limit,
        }): Parameters<ReadRunTraceParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let limit = limit.unwrap_or(100).clamp(1, MAX_TRACE_LIMIT);
        let offset = offset.unwrap_or(0);
        let result = self
            .bridge_call(
                "automation_read_run_trace",
                serde_json::json!({ "runId": run_id, "offset": offset, "limit": limit }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "promote_run",
        description = "Freeze an automation run into an editable manual flow. Returns the flow id, the step count and the promotion warnings (weak targets and dropped steps) — the warnings are the part to read before trusting the flow.",
        annotations(read_only_hint = false)
    )]
    async fn promote_run(
        &self,
        Parameters(PromoteRunParams { run_id, name }): Parameters<PromoteRunParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call(
                "automation_promote_run",
                serde_json::json!({ "runId": run_id, "name": name }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "list_flows",
        description = "Saved automation flows available to run_flow: id, name, app package and step count. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn list_flows(&self) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call("automation_list_flows", serde_json::Value::Null)
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "save_flow",
        description = "Create a validated automation flow from explicit steps (same step vocabulary as the flow editor: tap, type, swipe, wait, assert, ...). Steps validate one by one and failures report precise paths. The flow appears in the app Flows tab, editable and runnable.",
        annotations(read_only_hint = false)
    )]
    async fn save_flow(
        &self,
        Parameters(SaveFlowParams {
            name,
            app_package,
            description,
            steps,
        }): Parameters<SaveFlowParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call(
                "automation_save_flow",
                serde_json::json!({
                    "name": name,
                    "appPackage": app_package,
                    "description": description,
                    "steps": steps,
                }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "update_flow",
        description = "Patch a saved automation flow (name, package, description, steps). Omitted fields keep their values; replacement steps validate like save_flow.",
        annotations(read_only_hint = false)
    )]
    async fn update_flow(
        &self,
        Parameters(UpdateFlowParams {
            flow_id,
            name,
            app_package,
            description,
            steps,
        }): Parameters<UpdateFlowParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call(
                "automation_update_flow",
                serde_json::json!({
                    "flowId": flow_id,
                    "name": name,
                    "appPackage": app_package,
                    "description": description,
                    "steps": steps,
                }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "delete_flow",
        description = "Delete a saved automation flow. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn delete_flow(
        &self,
        Parameters(DeleteFlowParams { flow_id, confirm }): Parameters<DeleteFlowParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "delete_flow")?;
        let result = self
            .bridge_call(
                "automation_delete_flow",
                serde_json::json!({ "flowId": flow_id }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(
        name = "cancel_run",
        description = "Cancel a running automation run. Idempotent on finished runs. Requires confirm: true.",
        annotations(read_only_hint = false, destructive_hint = true)
    )]
    async fn cancel_run(
        &self,
        Parameters(CancelRunParams { run_id, confirm }): Parameters<CancelRunParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "cancel_run")?;
        let result = self
            .bridge_call(
                "automation_cancel_run",
                serde_json::json!({ "runId": run_id }),
            )
            .await?;
        ok_json(&result)
    }

    #[tool(name = "task_cancel", description = "Cancel the active attempt for a durable task. Requires confirm: true.", annotations(read_only_hint = false, destructive_hint = true))]
    async fn task_cancel(
        &self,
        Parameters(CancelTaskParams { task_id, confirm }): Parameters<CancelTaskParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "task_cancel")?;
        let result = self
            .bridge_call("automation_cancel_task", serde_json::json!({ "taskId": task_id }))
            .await?;
        ok_json(&result)
    }

    #[tool(name = "task_handoff", description = "Change the task reasoning owner and record the reason. Requires confirm: true.", annotations(read_only_hint = false))]
    async fn task_handoff(
        &self,
        Parameters(HandoffTaskParams { task_id, owner, reason, confirm }): Parameters<HandoffTaskParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if !["embedded", "mcp-host", "artemis", "deterministic"].contains(&owner.as_str()) {
            return Err(ErrorData::invalid_params("owner must be embedded, mcp-host, artemis, or deterministic".to_string(), None));
        }
        self.require_mutation(confirm, "task_handoff")?;
        let result = self
            .bridge_call("automation_handoff_task", serde_json::json!({ "taskId": task_id, "owner": owner, "reason": reason }))
            .await?;
        ok_json(&result)
    }

    #[tool(name = "task_heartbeat", description = "Renew the current task owner's lease. Read-only; a stale owner is rejected and the task awaits recovery.", annotations(read_only_hint = true))]
    async fn task_heartbeat(
        &self,
        Parameters(TaskIdParams { task_id }): Parameters<TaskIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self.bridge_call("automation_heartbeat_task", serde_json::json!({ "taskId": task_id })).await?;
        ok_json(&result)
    }

    #[tool(name = "task_update_plan", description = "Attach a concise plan/checkpoint summary to a durable task. Requires confirm: true.", annotations(read_only_hint = false))]
    async fn task_update_plan(
        &self,
        Parameters(UpdateTaskPlanParams { task_id, summary, confirm }): Parameters<UpdateTaskPlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "task_update_plan")?;
        let result = self
            .bridge_call("automation_update_task_plan", serde_json::json!({ "taskId": task_id, "summary": summary }))
            .await?;
        ok_json(&result)
    }

    #[tool(name = "task_pause", description = "Pause the active task attempt and preserve it as awaiting-reasoner. Requires confirm: true.", annotations(read_only_hint = false))]
    async fn task_pause(
        &self,
        Parameters(PauseResumeTaskParams { task_id, confirm }): Parameters<PauseResumeTaskParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "task_pause")?;
        let result = self.bridge_call("automation_pause_task", serde_json::json!({ "taskId": task_id })).await?;
        ok_json(&result)
    }

    #[tool(name = "task_resume", description = "Resume an awaiting-reasoner task as its next durable attempt. Requires confirm: true.", annotations(read_only_hint = false))]
    async fn task_resume(
        &self,
        Parameters(PauseResumeTaskParams { task_id, confirm }): Parameters<PauseResumeTaskParams>,
    ) -> Result<CallToolResult, ErrorData> {
        self.require_mutation(confirm, "task_resume")?;
        let result = self.bridge_call("automation_resume_task", serde_json::json!({ "taskId": task_id })).await?;
        ok_json(&result)
    }

    #[tool(name = "task_execute_batch", description = "Execute validated flow steps on an awaiting task through the shared executor. Returns immediately. Requires confirm: true.", annotations(read_only_hint = false, destructive_hint = true))]
    async fn task_execute_batch(
        &self,
        identity: McpRequestIdentity,
        Parameters(ExecuteTaskBatchParams { task_id, steps, confirm }): Parameters<ExecuteTaskBatchParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let steps = steps.as_array().ok_or_else(|| ErrorData::invalid_params("steps must be an array of flow steps".to_string(), None))?;
        self.require_mutation(confirm, "task_execute_batch")?;
        let result = self
            .bridge_call("automation_execute_task_batch", serde_json::json!({
                "taskId": task_id,
                "steps": steps,
                "principalId": identity.principal.id,
            }))
            .await?;
        ok_json(&result)
    }

    #[tool(name = "task_verify", description = "Run one bounded assertion against a task's device and append the verification result. Read-only.", annotations(read_only_hint = true))]
    async fn task_verify(
        &self,
        Parameters(VerifyTaskParams { task_id, assertion }): Parameters<VerifyTaskParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = self
            .bridge_call("automation_verify_task", serde_json::json!({ "taskId": task_id, "assertion": assertion }))
            .await?;
        ok_json(&result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;
    use crate::mcp::tools::McpRequestIdentity;

    #[tokio::test]
    async fn run_flow_without_app_handle_errors_clearly() {
        let result = tools()
            .run_flow(McpRequestIdentity::test_identity(), Parameters(RunFlowParams {
                flow_id: "flow-1".into(),
                device_serial: "serial-1".into(),
                confirm: true,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn run_agent_goal_rejects_remote_policy_without_acknowledgement() {
        let result = tools()
            .run_agent_goal(McpRequestIdentity::test_identity(), Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "jev".into(),
                device_serial: "serial-1".into(),
                flow_id: None,
                app_package: None,
                limits: None,
                acknowledge_data_notice: None,
                confirm: true,
            }))
            .await;
        let message = format!("{:?}", result.expect_err("must reject"));
        assert!(message.contains("acknowledge_data_notice"));
    }

    #[tokio::test]
    async fn run_agent_goal_accepts_local_policy_without_acknowledgement() {
        let result = tools()
            .run_agent_goal(McpRequestIdentity::test_identity(), Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "rules".into(),
                device_serial: "serial-1".into(),
                flow_id: Some("flow-1".into()),
                app_package: None,
                limits: None,
                acknowledge_data_notice: None,
                confirm: true,
            }))
            .await;
        assert!(result.is_err(), "no app handle, so the bridge must fail");
    }

    #[tokio::test]
    async fn run_agent_goal_accepts_artemis_without_acknowledgement() {
        let result = tools()
            .run_agent_goal(McpRequestIdentity::test_identity(), Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "artemis".into(),
                device_serial: "serial-1".into(),
                flow_id: None,
                app_package: None,
                limits: None,
                acknowledge_data_notice: None,
                confirm: true,
            }))
            .await;
        assert!(result.is_err(), "no app handle, so the bridge must fail");
    }

    #[tokio::test]
    async fn read_run_trace_without_app_handle_errors_clearly() {
        let result = tools()
            .read_run_trace(Parameters(ReadRunTraceParams {
                run_id: "run-1".into(),
                offset: None,
                limit: None,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn delete_flow_without_confirm_is_rejected() {
        let result = tools()
            .delete_flow(Parameters(DeleteFlowParams {
                flow_id: "flow-1".into(),
                confirm: false,
            }))
            .await;
        let message = format!("{:?}", result.expect_err("must reject"));
        assert!(message.contains("confirm"));
    }

    #[tokio::test]
    async fn save_flow_without_app_handle_errors_clearly() {
        let result = tools()
            .save_flow(Parameters(SaveFlowParams {
                name: "Agent made".into(),
                app_package: "com.example.app".into(),
                description: None,
                steps: None,
            }))
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn cancel_run_without_confirm_is_rejected() {
        let result = tools()
            .cancel_run(Parameters(CancelRunParams {
                run_id: "run-1".into(),
                confirm: false,
            }))
            .await;
        let message = format!("{:?}", result.expect_err("must reject"));
        assert!(message.contains("confirm"));
    }
}
