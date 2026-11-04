use keyring::Entry;
use serde::Serialize;
use std::time::Duration;

use crate::blocking::run_blocking;

const CREDENTIAL_SERVICE: &str = "capubridge.desktop.reasoning";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningProviderCredentialStatus {
    pub provider: String,
    pub configured: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningProviderCredentialPayload {
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningProviderPayload {
    pub provider: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningProviderCompletionPayload {
    pub provider: String,
    pub model: String,
    pub messages: Vec<ReasoningMessage>,
}

#[derive(Debug, Clone, serde::Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningProviderCompletion {
    pub provider: String,
    pub model: String,
    pub text: String,
}

fn supported_provider(provider: &str) -> Result<&str, String> {
    match provider {
        "openrouter" | "openai" | "anthropic" => Ok(provider),
        _ => Err("Unsupported reasoning provider".into()),
    }
}

fn credential_entry(provider: &str) -> Result<Entry, String> {
    let provider = supported_provider(provider)?;
    Entry::new(CREDENTIAL_SERVICE, provider)
        .map_err(|_| "Credential store is unavailable".into())
}

fn provider_api_key(provider: &str) -> Result<String, String> {
    credential_entry(provider)?
        .get_password()
        .map_err(|_| "provider-not-configured".into())
}

fn validate_completion(payload: &ReasoningProviderCompletionPayload) -> Result<(), String> {
    supported_provider(&payload.provider)?;
    if payload.model.trim().is_empty() || payload.messages.is_empty() {
        return Err("provider-malformed".into());
    }
    if payload.messages.iter().any(|message| {
        !matches!(message.role.as_str(), "system" | "user" | "assistant") || message.content.trim().is_empty()
    }) {
        return Err("provider-malformed".into());
    }
    Ok(())
}

fn completion_endpoint(provider: &str) -> &'static str {
    match provider {
        "openrouter" => "https://openrouter.ai/api/v1/chat/completions",
        "openai" => "https://api.openai.com/v1/chat/completions",
        "anthropic" => "https://api.anthropic.com/v1/messages",
        _ => unreachable!(),
    }
}

fn completion_text(provider: &str, response: serde_json::Value) -> Result<String, String> {
    let text = match provider {
        "anthropic" => response
            .get("content")
            .and_then(|content| content.as_array())
            .and_then(|content| content.first())
            .and_then(|content| content.get("text"))
            .and_then(|text| text.as_str()),
        _ => response
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|text| text.as_str()),
    };
    text.filter(|text| !text.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| "provider-malformed".into())
}

/// Writes a provider key to the operating system credential store.
#[tauri::command]
pub async fn reasoning_provider_set_credential(
    payload: ReasoningProviderCredentialPayload,
) -> Result<ReasoningProviderCredentialStatus, String> {
    run_blocking(move || store_credential(payload)).await?
}

fn store_credential(
    payload: ReasoningProviderCredentialPayload,
) -> Result<ReasoningProviderCredentialStatus, String> {
    if payload.api_key.trim().is_empty() {
        return Err("Provider API key cannot be empty".into());
    }
    let provider = supported_provider(&payload.provider)?;
    credential_entry(provider)?
        .set_password(&payload.api_key)
        .map_err(|_| "Failed to save provider credential".to_string())?;
    Ok(ReasoningProviderCredentialStatus {
        provider: provider.into(),
        configured: true,
    })
}

/// Reports only whether a provider key exists; it never returns the key.
#[tauri::command]
pub async fn reasoning_provider_get_credential_status(
    payload: ReasoningProviderPayload,
) -> Result<ReasoningProviderCredentialStatus, String> {
    run_blocking(move || read_credential_status(payload)).await?
}

fn read_credential_status(
    payload: ReasoningProviderPayload,
) -> Result<ReasoningProviderCredentialStatus, String> {
    let provider = supported_provider(&payload.provider)?;
    let configured = credential_entry(provider)?.get_password().is_ok();
    Ok(ReasoningProviderCredentialStatus {
        provider: provider.into(),
        configured,
    })
}

/// Removes a provider key from the operating system credential store.
#[tauri::command]
pub async fn reasoning_provider_delete_credential(
    payload: ReasoningProviderPayload,
) -> Result<ReasoningProviderCredentialStatus, String> {
    run_blocking(move || remove_credential(payload)).await?
}

fn remove_credential(
    payload: ReasoningProviderPayload,
) -> Result<ReasoningProviderCredentialStatus, String> {
    let provider = supported_provider(&payload.provider)?;
    let entry = credential_entry(provider)?;
    if entry.get_password().is_ok() {
        entry
            .delete_credential()
            .map_err(|_| "Failed to remove provider credential".to_string())?;
    }
    Ok(ReasoningProviderCredentialStatus {
        provider: provider.into(),
        configured: false,
    })
}

/// Completes one provider request with a credential held only in the OS store.
#[tauri::command]
pub async fn reasoning_provider_complete(
    payload: ReasoningProviderCompletionPayload,
) -> Result<ReasoningProviderCompletion, String> {
    validate_completion(&payload)?;
    let api_key = provider_api_key(&payload.provider)?;
    let body = if payload.provider == "anthropic" {
        serde_json::json!({
            "model": payload.model,
            "max_tokens": 2048,
            "messages": payload.messages,
        })
    } else {
        serde_json::json!({
            "model": payload.model,
            "messages": payload.messages,
        })
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|_| "provider-transport".to_string())?;
    let request = client.post(completion_endpoint(&payload.provider)).json(&body);
    let request = if payload.provider == "anthropic" {
        request
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
    } else {
        request.bearer_auth(api_key)
    };
    let response = request.send().await.map_err(|error| {
        if error.is_timeout() {
            "provider-timeout".to_string()
        } else {
            "provider-transport".to_string()
        }
    })?;
    match response.status().as_u16() {
        401 | 403 => return Err("provider-unauthorized".into()),
        429 => return Err("provider-quota".into()),
        status if !(200..300).contains(&status) => return Err("provider-transport".into()),
        _ => {}
    }
    let text = response
        .json::<serde_json::Value>()
        .await
        .map_err(|_| "provider-malformed".to_string())
        .and_then(|response| completion_text(&payload.provider, response))?;
    Ok(ReasoningProviderCompletion {
        provider: payload.provider,
        model: payload.model,
        text,
    })
}

#[cfg(test)]
mod tests {
    use super::{completion_text, supported_provider};

    #[test]
    fn rejects_unknown_provider_names_before_touching_the_credential_store() {
        assert!(supported_provider("unknown").is_err());
    }

    #[test]
    fn extracts_direct_provider_response_text_without_credentials() {
        let response = serde_json::json!({ "choices": [{ "message": { "content": "next action" } }] });
        assert_eq!(completion_text("openai", response).unwrap(), "next action");
    }
}
