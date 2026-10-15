use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const DEFAULT_ARTEMIS_URL: &str = "http://127.0.0.1:8000";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtemisStartPayload {
    pub goal: String,
    pub device_serial: Option<String>,
    pub model: String,
    pub locked_app_package: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtemisTracePayload {
    pub trace_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtemisStartResult {
    pub trace_id: String,
    pub status: String,
}

fn base_url() -> String {
    std::env::var("CAPUBRIDGE_ARTEMIS_URL")
        .unwrap_or_else(|_| DEFAULT_ARTEMIS_URL.into())
        .trim_end_matches('/')
        .to_owned()
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "artemis-transport".into())
}

async fn json_response(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let body = response.json::<Value>().await.map_err(|_| "artemis-malformed".to_string())?;
    if status.is_success() {
        return Ok(body);
    }
    let detail = body.get("detail").and_then(Value::as_str).unwrap_or("Artemis request failed");
    Err(format!("artemis-http-{}: {detail}", status.as_u16()))
}

/// Starts one ARTEMIS-owned mobile task through its local daemon.
#[tauri::command]
pub async fn artemis_start_task(payload: ArtemisStartPayload) -> Result<ArtemisStartResult, String> {
    if payload.goal.trim().is_empty() || !matches!(payload.model.as_str(), "flash" | "pro") {
        return Err("artemis-malformed".into());
    }
    let body = serde_json::json!({
        "goal": payload.goal,
        "profile": payload.model,
        "device_serial": payload.device_serial,
        "locked_app_package": payload.locked_app_package,
        "ingress": "capubridge",
    });
    let response = client()?.post(format!("{}/api/run", base_url())).json(&body).send().await
        .map_err(|_| "artemis-unavailable".to_string())?;
    let json = json_response(response).await?;
    let task = json.get("tasks").and_then(Value::as_array).and_then(|tasks| tasks.first())
        .ok_or_else(|| "artemis-malformed".to_string())?;
    let trace_id = task.get("session_id").and_then(Value::as_str).ok_or_else(|| "artemis-malformed".to_string())?;
    let status = json.get("status").and_then(Value::as_str).unwrap_or("queued");
    Ok(ArtemisStartResult { trace_id: trace_id.into(), status: status.into() })
}

/// Reads an ARTEMIS trace without interpreting or replaying its device actions.
#[tauri::command]
pub async fn artemis_get_trace(payload: ArtemisTracePayload) -> Result<Value, String> {
    let response = client()?.get(format!("{}/api/sessions/{}", base_url(), payload.trace_id)).send().await
        .map_err(|_| "artemis-unavailable".to_string())?;
    json_response(response).await
}

#[tauri::command]
pub async fn artemis_get_steps(payload: ArtemisTracePayload) -> Result<Value, String> {
    let response = client()?.get(format!("{}/api/sessions/{}/steps", base_url(), payload.trace_id)).send().await
        .map_err(|_| "artemis-unavailable".to_string())?;
    json_response(response).await
}

/// Stops one ARTEMIS task and lets its daemon release the device lease.
#[tauri::command]
pub async fn artemis_stop_task(payload: ArtemisTracePayload) -> Result<(), String> {
    let response = client()?.post(format!("{}/api/stop", base_url())).json(&serde_json::json!({ "session_id": payload.trace_id })).send().await
        .map_err(|_| "artemis-unavailable".to_string())?;
    if response.status() == StatusCode::OK { Ok(()) } else { Err("artemis-stop-failed".into()) }
}

/// Returns the daemon readiness report so the UI can show repair steps before launch.
#[tauri::command]
pub async fn artemis_diagnose() -> Result<Value, String> {
    let response = client()?.get(format!("{}/api/system/readiness", base_url())).send().await
        .map_err(|_| "artemis-unavailable".to_string())?;
    json_response(response).await
}
