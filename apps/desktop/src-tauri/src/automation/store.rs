use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

const STORE_SCHEMA_VERSION: u8 = 1;
const STORE_FILE_NAME: &str = "automation-runtime-v1.json";
const MAX_EVENTS_PER_TASK: usize = 10_000;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedAutomationStore {
    schema_version: u8,
    tasks: BTreeMap<String, PersistedTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedTask {
    task: Value,
    runs: BTreeMap<String, Value>,
    events: Vec<Value>,
}

#[derive(Debug)]
pub struct AutomationStore {
    path: PathBuf,
    state: Mutex<PersistedAutomationStore>,
}

#[derive(Clone)]
pub struct AutomationStoreState(pub Arc<AutomationStore>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationEventPage {
    pub events: Vec<Value>,
    pub next_cursor: Option<String>,
}

impl AutomationStore {
    pub fn new(app: &AppHandle) -> Result<Arc<Self>, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Failed to resolve automation data directory: {error}"))?;
        fs::create_dir_all(&dir)
            .map_err(|error| format!("Failed to create automation data directory: {error}"))?;
        let path = dir.join(STORE_FILE_NAME);
        let mut state = load_store(&path)?;
        if recover_interrupted(&mut state) {
            persist_store_file(&path, &state)?;
        }
        Ok(Arc::new(Self {
            path,
            state: Mutex::new(state),
        }))
    }

    pub fn upsert_task(&self, task: Value, run: Value) -> Result<(), String> {
        let task_id = string_field(&task, "id")?;
        let run_id = string_field(&run, "id")?;
        let run_task_id = string_field(&run, "taskId")?;
        if task_id != run_task_id {
            return Err("automation run taskId does not match task id".to_string());
        }
        let mut state = self.state.lock();
        let entry = state.tasks.entry(task_id).or_default();
        entry.task = task;
        entry.runs.insert(run_id, run);
        self.persist(&state)
    }

    pub fn append_event(&self, event: Value) -> Result<(), String> {
        let task_id = string_field(&event, "taskId")?;
        let run_id = string_field(&event, "runId")?;
        let sequence = event
            .get("sequence")
            .and_then(Value::as_u64)
            .ok_or_else(|| "automation event sequence is required".to_string())?;
        let mut state = self.state.lock();
        let entry = state
            .tasks
            .get_mut(&task_id)
            .ok_or_else(|| format!("unknown automation task {task_id}"))?;
        if !entry.runs.contains_key(&run_id) {
            return Err(format!("unknown automation run {run_id}"));
        }
        if entry.events.iter().any(|existing| {
            existing.get("id") == event.get("id")
        }) {
            return Ok(());
        }
        let previous = entry
            .events
            .iter()
            .filter(|existing| existing.get("runId").and_then(Value::as_str) == Some(run_id.as_str()))
            .last()
            .and_then(|existing| existing.get("sequence"))
            .and_then(Value::as_u64);
        if previous.is_some_and(|value| sequence != value + 1) {
            return Err("automation event sequence must be contiguous".to_string());
        }
        if event.get("kind").and_then(Value::as_str) == Some("task.terminal")
            && entry.events.iter().any(|existing| {
                existing.get("kind").and_then(Value::as_str) == Some("task.terminal")
            })
        {
            return Err("automation task already has a terminal event".to_string());
        }
        if entry.events.len() >= MAX_EVENTS_PER_TASK {
            return Err(format!("automation event retention limit is {MAX_EVENTS_PER_TASK}"));
        }
        entry.events.push(event);
        self.persist(&state)
    }

    pub fn read_events(
        &self,
        task_id: &str,
        run_id: &str,
        cursor: Option<String>,
        limit: usize,
    ) -> Result<AutomationEventPage, String> {
        let state = self.state.lock();
        let entry = state
            .tasks
            .get(task_id)
            .ok_or_else(|| format!("unknown automation task {task_id}"))?;
        if !entry.runs.contains_key(run_id) {
            return Err(format!("unknown automation run {run_id}"));
        }
        let start = cursor
            .as_deref()
            .unwrap_or("0")
            .parse::<usize>()
            .map_err(|_| "automation event cursor must be numeric".to_string())?;
        let safe_limit = limit.clamp(1, 500);
        let events = entry
            .events
            .iter()
            .filter(|event| event.get("runId").and_then(Value::as_str) == Some(run_id))
            .skip(start)
            .take(safe_limit)
            .cloned()
            .collect::<Vec<_>>();
        let next = start + events.len();
        let total = entry
            .events
            .iter()
            .filter(|event| event.get("runId").and_then(Value::as_str) == Some(run_id))
            .count();
        Ok(AutomationEventPage {
            events,
            next_cursor: (next < total).then(|| next.to_string()),
        })
    }

    pub fn list_tasks(&self) -> Vec<Value> {
        let state = self.state.lock();
        state
            .tasks
            .values()
            .map(|entry| {
                serde_json::json!({
                    "task": entry.task.clone(),
                    "runs": entry.runs.values().cloned().collect::<Vec<_>>(),
                    "events": entry.events.clone(),
                })
            })
            .collect()
    }

    fn persist(&self, state: &PersistedAutomationStore) -> Result<(), String> {
        persist_store_file(&self.path, state)
    }
}

fn persist_store_file(path: &PathBuf, state: &PersistedAutomationStore) -> Result<(), String> {
    let temporary = path.with_extension("json.tmp");
    let encoded = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Failed encoding automation store: {error}"))?;
    fs::write(&temporary, encoded)
        .map_err(|error| format!("Failed writing automation store: {error}"))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Failed replacing automation store: {error}"))
}

fn load_store(path: &PathBuf) -> Result<PersistedAutomationStore, String> {
    if !path.exists() {
        return Ok(PersistedAutomationStore {
            schema_version: STORE_SCHEMA_VERSION,
            tasks: BTreeMap::new(),
        });
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Failed reading automation store: {error}"))?;
    let store = serde_json::from_str::<PersistedAutomationStore>(&raw)
        .map_err(|error| format!("Failed parsing automation store: {error}"))?;
    if store.schema_version != STORE_SCHEMA_VERSION {
        return Err(format!("Unsupported automation store schema {}", store.schema_version));
    }
    Ok(store)
}

fn recover_interrupted(store: &mut PersistedAutomationStore) -> bool {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    let mut changed = false;
    for entry in store.tasks.values_mut() {
        for run in entry.runs.values_mut() {
            let expired = run
                .get("deviceLease")
                .and_then(|lease| lease.get("expiresAt"))
                .and_then(Value::as_u64)
                .is_some_and(|expires_at| expires_at <= timestamp);
            if expired {
                if let Some(run_object) = run.as_object_mut() {
                    run_object.insert("deviceLease".to_string(), Value::Null);
                }
                changed = true;
            }
        }
        let interrupted = entry
            .runs
            .values()
            .any(|run| run.get("status").and_then(Value::as_str) == Some("running"));
        if !interrupted {
            continue;
        }
        let task_status = entry.task.get("status").and_then(Value::as_str);
        if matches!(
            task_status,
            Some("created" | "queued" | "running" | "awaiting-device" | "awaiting-authorization")
        ) {
            if let Some(task) = entry.task.as_object_mut() {
                task.insert("status".to_string(), Value::String("awaiting-reasoner".to_string()));
                task.insert("activeRunId".to_string(), Value::Null);
                task.insert("updatedAt".to_string(), Value::from(timestamp));
            }
            changed = true;
        }
        for run in entry.runs.values_mut() {
            if run.get("status").and_then(Value::as_str) != Some("running") {
                continue;
            }
            if let Some(run_object) = run.as_object_mut() {
                run_object.insert("status".to_string(), Value::String("pending".to_string()));
                run_object.insert("deviceLease".to_string(), Value::Null);
            }
            changed = true;
        }
    }
    changed
}

fn string_field(value: &Value, field: &str) -> Result<String, String> {
    value
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("automation {field} is required"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interrupted_running_task_becomes_awaiting_reasoner_and_releases_lease() {
        let mut store = PersistedAutomationStore {
            schema_version: STORE_SCHEMA_VERSION,
            tasks: BTreeMap::from([(
                "task-1".to_string(),
                PersistedTask {
                    task: serde_json::json!({
                        "id": "task-1",
                        "status": "running",
                        "activeRunId": "run-1",
                        "updatedAt": 1
                    }),
                    runs: BTreeMap::from([(
                        "run-1".to_string(),
                        serde_json::json!({
                            "id": "run-1",
                            "status": "running",
                            "deviceLease": { "id": "lease-1" }
                        })),
                    ]),
                    events: Vec::new(),
                },
            )]),
        };

        assert!(recover_interrupted(&mut store));
        let task = &store.tasks["task-1"].task;
        assert_eq!(task["status"], "awaiting-reasoner");
        assert_eq!(task["activeRunId"], Value::Null);
        let run = &store.tasks["task-1"].runs["run-1"];
        assert_eq!(run["status"], "pending");
        assert_eq!(run["deviceLease"], Value::Null);
    }
}
