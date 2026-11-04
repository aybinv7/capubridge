use std::fs;
use std::sync::OnceLock;
use std::time::Duration;

use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use tauri::{Emitter, State};
use zip::ZipArchive;

use crate::automation::hedge::{hedged, Transience};
use crate::automation::store::{AutomationEventPage, AutomationStoreState};
use crate::blocking::run_blocking;

/// Request body forwarded to the Jev System One endpoint.
///
/// The body is built on the TypeScript side from a redacted observation.
/// This command only transports it and classifies transport failures.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JevDecidePayload {
    pub body: serde_json::Value,
}

/// Environment variable carrying the Jev endpoint (gateway URL for POST /v1/systemone).
///
/// TypeSafe's own API is `https://api.typesafe.ai/v1/systemone`; OpenRouter
/// serves the same models from `https://openrouter.ai/api/alpha/decisions`.
const JEV_ENDPOINT_ENV: &str = "CAPUBRIDGE_JEV_ENDPOINT";
/// Environment variable carrying the Jev API key. Never leaves this module.
const JEV_API_KEY_ENV: &str = "CAPUBRIDGE_JEV_API_KEY";
/// Optional model override, because the same model has a different slug per
/// provider: `jev-1.13` on TypeSafe, `typesafe/jev-1.13-20260917` on
/// OpenRouter (verified live; the `~`-prefixed form is rejected as
/// nonexistent). Overrides the `model` the TypeScript policy pinned, without
/// a rebuild.
const JEV_MODEL_ENV: &str = "CAPUBRIDGE_JEV_MODEL";
/// Start the hedged second leg once a call has outrun the measured normal
/// band: warm calls answered in 0.4 to 1.2 s.
const JEV_HEDGE_AFTER: Duration = Duration::from_millis(1_500);
/// Give up on one decision after this long, across both legs.
const JEV_DEADLINE: Duration = Duration::from_secs(8);
/// Bound on establishing a connection, separate from the decision deadline.
const JEV_CONNECT_TIMEOUT: Duration = Duration::from_secs(4);
/// Keeps pooled connections alive across the seconds between steps, so only
/// the first decision of a run pays the TLS handshake.
const JEV_POOL_IDLE: Duration = Duration::from_secs(90);
/// Bytes of a non-2xx body kept in the error for diagnosis.
const JEV_ERROR_SNIPPET_LEN: usize = 500;

/// Forwards one batched Jev decision request and returns the parsed response.
///
/// The API key is read from the process environment and never crosses into
/// JavaScript. Non-2xx responses, timeouts and malformed bodies surface as
/// distinct, prefixed errors so the TypeScript policy can map them without
/// parsing free text.
#[tauri::command]
pub async fn jev_decide(payload: JevDecidePayload) -> Result<serde_json::Value, String> {
    let endpoint = std::env::var(JEV_ENDPOINT_ENV).map_err(|_| {
        format!("jev-not-configured: set {JEV_ENDPOINT_ENV} to the Jev System One endpoint")
    })?;
    let api_key = std::env::var(JEV_API_KEY_ENV)
        .map_err(|_| format!("jev-not-configured: set {JEV_API_KEY_ENV} to call Jev"))?;
    let mut body = payload.body;
    if let Ok(model) = std::env::var(JEV_MODEL_ENV) {
        if !model.is_empty() {
            if let Some(object) = body.as_object_mut() {
                object.insert("model".into(), serde_json::Value::String(model));
            }
        }
    }
    let client = jev_client()?;
    hedged(
        || send_jev(client, endpoint.clone(), api_key.clone(), body.clone()),
        JEV_HEDGE_AFTER,
        JEV_DEADLINE,
        || JevFailure {
            message: format!(
                "jev-timeout: no Jev answer within {} ms, including a hedged retry",
                JEV_DEADLINE.as_millis()
            ),
            transient: true,
        },
    )
    .await
    .map_err(|failure| failure.message)
}

/// One process-wide client. Building a client per call paid a fresh TCP and
/// TLS handshake on every decision, measured at 0.75 to 2.6 s against a
/// 0.43 s answer on a reused connection.
static JEV_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn jev_client() -> Result<&'static reqwest::Client, String> {
    if let Some(client) = JEV_CLIENT.get() {
        return Ok(client);
    }
    let client = reqwest::Client::builder()
        .connect_timeout(JEV_CONNECT_TIMEOUT)
        .pool_idle_timeout(JEV_POOL_IDLE)
        .tcp_keepalive(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("jev-transport: failed to build HTTP client: {error}"))?;
    Ok(JEV_CLIENT.get_or_init(|| client))
}

/// A failed Jev attempt, classified so the hedge never races a request that
/// would fail identically on a second leg.
#[derive(Debug)]
struct JevFailure {
    message: String,
    transient: bool,
}

impl Transience for JevFailure {
    fn is_transient(&self) -> bool {
        self.transient
    }
}

/// Sends one decision request. Transport errors, timeouts, 408, 429 and 5xx
/// are transient; any other non-2xx is permanent.
async fn send_jev(
    client: &'static reqwest::Client,
    endpoint: String,
    api_key: String,
    body: serde_json::Value,
) -> Result<serde_json::Value, JevFailure> {
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| JevFailure {
            message: if error.is_timeout() {
                format!("jev-timeout: Jev decision call timed out: {error}")
            } else {
                format!("jev-transport: failed to reach Jev: {error}")
            },
            transient: true,
        })?;
    let status = response.status();
    if !status.is_success() {
        let code = status.as_u16();
        let snippet = response.text().await.unwrap_or_default();
        let snippet: String = snippet.chars().take(JEV_ERROR_SNIPPET_LEN).collect();
        return Err(JevFailure {
            message: format!("jev-http-{code}: {snippet}"),
            transient: status.is_server_error() || code == 408 || code == 429,
        });
    }
    response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| JevFailure {
            message: format!("jev-malformed: Jev returned an unparsable body: {error}"),
            transient: true,
        })
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTaskUpsertPayload {
    pub task: serde_json::Value,
    pub run: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationEventPayload {
    pub event: serde_json::Value,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationEventReadPayload {
    pub task_id: String,
    pub run_id: String,
    pub cursor: Option<String>,
    pub limit: Option<usize>,
}

#[tauri::command]
pub async fn automation_task_upsert(
    state: State<'_, AutomationStoreState>,
    payload: AutomationTaskUpsertPayload,
) -> Result<(), String> {
    let store = state.0.clone();
    run_blocking(move || store.upsert_task(payload.task, payload.run)).await?
}

#[tauri::command]
pub async fn automation_event_append(
    app: tauri::AppHandle,
    state: State<'_, AutomationStoreState>,
    payload: AutomationEventPayload,
) -> Result<(), String> {
    let store = state.0.clone();
    let event = payload.event.clone();
    run_blocking(move || store.append_event(event)).await??;
    app.emit("capubridge:automation-task-event", payload)
        .map_err(|error| format!("Failed emitting automation event: {error}"))
}

#[tauri::command]
pub async fn automation_events_read(
    state: State<'_, AutomationStoreState>,
    payload: AutomationEventReadPayload,
) -> Result<AutomationEventPage, String> {
    let store = state.0.clone();
    run_blocking(move || {
        store.read_events(
            &payload.task_id,
            &payload.run_id,
            payload.cursor,
            payload.limit.unwrap_or(100),
        )
    })
    .await?
}

#[tauri::command]
pub async fn automation_tasks_list(
    state: State<'_, AutomationStoreState>,
) -> Result<Vec<serde_json::Value>, String> {
    let store = state.0.clone();
    run_blocking(move || store.list_tasks()).await
}

/// Maximum decoded bytes accepted for one session attachment.
const MAX_ATTACHMENT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationSummary {
    pub run_status: String,
    pub policy_id: String,
    pub flow_name: Option<String>,
    pub goal: Option<String>,
    pub step_count: u64,
    pub failed_step_index: Option<u64>,
}

/// Summarizes the automation track from its NDJSON lines: step count and
/// the first non-ok outcome index. Malformed lines are skipped so a
/// partially written track still summarizes.
pub(crate) fn summarize_automation_track(ndjson: &str) -> (u64, Option<u64>) {
    let mut step_count: u64 = 0;
    let mut failed_step_index: Option<u64> = None;
    for line in ndjson.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(event) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let outcome = event
            .get("data")
            .and_then(|data| data.get("outcome"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or("ok");
        if failed_step_index.is_none() && outcome != "ok" {
            failed_step_index = Some(step_count);
        }
        step_count += 1;
    }
    (step_count, failed_step_index)
}

/// Reads the automation summary for a zipped session when its manifest
/// carries an automation section. Opens the archive itself so callers never
/// hold a competing borrow on it.
pub(crate) fn automation_summary_from_path(
    session_path: &std::path::Path,
    manifest: &serde_json::Value,
) -> Option<AutomationSummary> {
    let section = manifest.get("automation")?;
    let file = fs::File::open(session_path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;
    let ndjson = match archive.by_name("tracks/automation.ndjson") {
        Ok(mut track_file) => {
            let mut content = String::new();
            std::io::Read::read_to_string(&mut track_file, &mut content).ok()?;
            content
        }
        Err(_) => String::new(),
    };
    let (step_count, failed_step_index) = summarize_automation_track(&ndjson);
    Some(automation_summary(
        section,
        step_count,
        failed_step_index,
    ))
}

/// Builds an automation summary from a manifest section and track stats.
pub(crate) fn automation_summary(
    section: &serde_json::Value,
    step_count: u64,
    failed_step_index: Option<u64>,
) -> AutomationSummary {
    AutomationSummary {
        run_status: section
            .get("runStatus")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        policy_id: section
            .get("policyId")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        flow_name: section
            .get("flowName")
            .and_then(serde_json::Value::as_str)
            .map(String::from),
        goal: section
            .get("goal")
            .and_then(serde_json::Value::as_str)
            .map(String::from),
        step_count,
        failed_step_index,
    }
}

/// Validates an attachment file name: no path separators, no parent
/// traversal, safe characters only, and a supported image extension.
fn validate_attachment_name(name: &str) -> Result<&str, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Attachment name is empty".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err(format!("Invalid attachment name: {trimmed}"));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
    {
        return Err(format!("Invalid attachment name: {trimmed}"));
    }
    if !trimmed.ends_with(".png") {
        return Err(format!("Unsupported attachment type: {trimmed}"));
    }
    Ok(trimmed)
}

/// Stores one base64-encoded screenshot in the session work directory so it
/// ships inside the archive as attachments/<name> instead of being inlined
/// into track NDJSON.
#[tauri::command]
pub async fn recording_session_attach(
    app: tauri::AppHandle,
    session_id: String,
    name: String,
    base64_data: String,
) -> Result<(), String> {
    use super::recording::session_work_dir;
    let name = validate_attachment_name(&name)?.to_string();
    let work_dir = session_work_dir(&app, &session_id)?;
    if !work_dir.is_dir() {
        return Err("Recording session is not active".to_string());
    }
    let bytes = general_purpose::STANDARD
        .decode(base64_data.trim())
        .map_err(|e| format!("Attachment is not valid base64: {e}"))?;
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err("Attachment exceeds the size limit".to_string());
    }
    let attachments_dir = work_dir.join("attachments");
    fs::create_dir_all(&attachments_dir)
        .map_err(|e| format!("Failed to create attachments dir: {e}"))?;
    fs::write(attachments_dir.join(&name), &bytes)
        .map_err(|e| format!("Failed to write attachment {name}: {e}"))?;
    Ok(())
}

/// Reads one session attachment (a step screenshot) from a finalized
/// archive and returns it base64-encoded for display.
#[tauri::command]
pub async fn recording_read_attachment(
    file_path: String,
    name: String,
) -> Result<String, String> {
    let name = validate_attachment_name(&name)?.to_string();
    let file = fs::File::open(&file_path).map_err(|e| format!("Cannot open session file: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid .capu file: {e}"))?;
    let mut attachment = archive
        .by_name(&format!("attachments/{name}"))
        .map_err(|_| format!("Attachment not found: {name}"))?;
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut attachment, &mut bytes)
        .map_err(|e| format!("Failed to read attachment {name}: {e}"))?;
    Ok(general_purpose::STANDARD.encode(&bytes))
}
