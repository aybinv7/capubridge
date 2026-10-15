use serde::{Deserialize, Serialize};

pub const AUTOMATION_TASK_SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ReasoningOwner {
    Embedded,
    McpHost,
    Artemis,
    Deterministic,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AutomationTaskOrigin {
    LocalChat,
    Mcp,
    Artemis,
    Flow,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AutomationTaskStatus {
    Created,
    Queued,
    Running,
    AwaitingReasoner,
    AwaitingDevice,
    AwaitingAuthorization,
    Completed,
    Failed,
    Blocked,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AutomationTaskRunStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Blocked,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AutomationPrincipalKind {
    Local,
    Mcp,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationPrincipal {
    pub id: String,
    pub label: String,
    pub kind: AutomationPrincipalKind,
    pub connection_id: Option<String>,
    pub client_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTask {
    pub schema_version: u8,
    pub id: String,
    pub conversation_id: Option<String>,
    pub origin: AutomationTaskOrigin,
    pub principal: AutomationPrincipal,
    pub original_goal: String,
    pub app_package: Option<String>,
    pub device_serial: Option<String>,
    pub reasoning_owner: Option<ReasoningOwner>,
    pub authorization_scope: Option<serde_json::Value>,
    pub status: AutomationTaskStatus,
    pub active_run_id: Option<String>,
    pub terminal_reason: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTaskRun {
    pub schema_version: u8,
    pub id: String,
    pub task_id: String,
    pub attempt: u32,
    pub status: AutomationTaskRunStatus,
    pub reasoning_owner: ReasoningOwner,
    pub principal_id: String,
    pub device_lease: Option<serde_json::Value>,
    pub started_at: Option<u64>,
    pub ended_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTaskEvent {
    pub schema_version: u8,
    pub id: String,
    pub task_id: String,
    pub run_id: String,
    pub sequence: u64,
    pub occurred_at: u64,
    pub origin: AutomationTaskOrigin,
    pub principal_id: String,
    pub connection_id: Option<String>,
    pub kind: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTaskRuntimeFixture {
    pub schema_version: u8,
    pub task: AutomationTask,
    pub run: AutomationTaskRun,
    pub events: Vec<AutomationTaskEvent>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../src/modules/automation/__fixtures__/task-runtime-v1.json");

    #[test]
    fn shared_task_runtime_fixture_round_trips_without_shape_changes() {
        let fixture: AutomationTaskRuntimeFixture =
            serde_json::from_str(FIXTURE).expect("fixture should deserialize");
        assert_eq!(fixture.schema_version, AUTOMATION_TASK_SCHEMA_VERSION);
        let actual: serde_json::Value =
            serde_json::from_str(&serde_json::to_string(&fixture).expect("fixture should serialize"))
                .expect("serialized fixture should be JSON");
        let expected: serde_json::Value = serde_json::from_str(FIXTURE).expect("fixture should be JSON");
        assert_eq!(actual, expected);
    }
}
