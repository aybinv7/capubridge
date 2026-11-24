use super::*;
use crate::mcp::tools::fixture::tools;
use crate::mcp::tools::McpRequestIdentity;

#[tokio::test]
async fn run_flow_without_app_handle_errors_clearly() {
    let result = tools()
        .run_flow(
            McpRequestIdentity::test_identity(),
            Parameters(RunFlowParams {
                flow_id: "flow-1".into(),
                device_serial: "serial-1".into(),
                confirm: true,
            }),
        )
        .await;
    assert!(result.is_err());
}

#[tokio::test]
async fn run_agent_goal_rejects_remote_policy_without_acknowledgement() {
    let result = tools()
        .run_agent_goal(
            McpRequestIdentity::test_identity(),
            Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "jev".into(),
                device_serial: "serial-1".into(),
                flow_id: None,
                app_package: None,
                limits: None,
                acknowledge_data_notice: None,
                confirm: true,
            }),
        )
        .await;
    let message = format!("{:?}", result.expect_err("must reject"));
    assert!(message.contains("acknowledge_data_notice"));
}

#[tokio::test]
async fn run_agent_goal_accepts_local_policy_without_acknowledgement() {
    let result = tools()
        .run_agent_goal(
            McpRequestIdentity::test_identity(),
            Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "rules".into(),
                device_serial: "serial-1".into(),
                flow_id: Some("flow-1".into()),
                app_package: None,
                limits: None,
                acknowledge_data_notice: None,
                confirm: true,
            }),
        )
        .await;
    assert!(result.is_err(), "no app handle, so the bridge must fail");
}

#[tokio::test]
async fn run_agent_goal_rejects_removed_artemis_policy_naming_jev() {
    let result = tools()
        .run_agent_goal(
            McpRequestIdentity::test_identity(),
            Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "artemis".into(),
                device_serial: "serial-1".into(),
                flow_id: None,
                app_package: None,
                limits: None,
                acknowledge_data_notice: Some(true),
                confirm: true,
            }),
        )
        .await;
    let message = format!("{:?}", result.expect_err("must reject"));
    assert!(message.contains("Artemis policy was removed"));
    assert!(message.contains("jev"));
}

#[tokio::test]
async fn task_create_rejects_removed_artemis_policy() {
    let result = tools()
        .task_create(
            McpRequestIdentity::test_identity(),
            Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "artemis".into(),
                device_serial: "serial-1".into(),
                flow_id: None,
                app_package: None,
                limits: None,
                acknowledge_data_notice: None,
                confirm: true,
            }),
        )
        .await;
    let message = format!("{:?}", result.expect_err("must reject"));
    assert!(message.contains("Artemis policy was removed"));
}

#[tokio::test]
async fn run_agent_goal_rejects_unknown_policy_listing_supported_ones() {
    let result = tools()
        .run_agent_goal(
            McpRequestIdentity::test_identity(),
            Parameters(RunAgentGoalParams {
                goal: "sign in".into(),
                policy_id: "mystery".into(),
                device_serial: "serial-1".into(),
                flow_id: None,
                app_package: None,
                limits: None,
                acknowledge_data_notice: Some(true),
                confirm: true,
            }),
        )
        .await;
    let message = format!("{:?}", result.expect_err("must reject"));
    assert!(message.contains("rules, jev, embedded"));
}

#[tokio::test]
async fn task_handoff_rejects_removed_artemis_owner() {
    let result = tools()
        .task_handoff(Parameters(HandoffTaskParams {
            task_id: "task-1".into(),
            owner: "artemis".into(),
            reason: None,
            confirm: true,
        }))
        .await;
    let message = format!("{:?}", result.expect_err("must reject"));
    assert!(message.contains("Artemis policy was removed"));
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
