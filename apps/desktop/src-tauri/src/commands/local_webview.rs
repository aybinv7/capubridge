use tauri::Manager;

const LOCAL_PREVIEW_LABEL_PREFIX: &str = "local-preview-";

#[cfg(all(target_os = "windows", debug_assertions))]
pub const LOCAL_WEBVIEW_DEBUG_PORT: u16 = 19222;

#[cfg(target_os = "windows")]
pub fn enable_webview2_remote_debugging() {
    #[cfg(debug_assertions)]
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        webview2_remote_debugging_arguments(),
    );
}

#[cfg(all(target_os = "windows", debug_assertions))]
fn webview2_remote_debugging_arguments() -> String {
    format!(
        "--remote-debugging-address=127.0.0.1 --remote-debugging-port={LOCAL_WEBVIEW_DEBUG_PORT} --remote-allow-origins=http://localhost:5173"
    )
}

fn validate_local_preview_label(label: &str) -> Result<(), String> {
    let suffix = label
        .strip_prefix(LOCAL_PREVIEW_LABEL_PREFIX)
        .ok_or_else(|| "Only isolated local preview webviews are allowed".to_string())?;

    if suffix.is_empty()
        || label.len() > 255
        || !suffix
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "_:/-".contains(character))
    {
        return Err("Invalid local preview webview label".to_string());
    }

    Ok(())
}

fn validate_preview_url(url: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| "Invalid preview URL".to_string())?;

    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Preview URLs must use HTTP or HTTPS without credentials".to_string());
    }

    Ok(parsed.to_string())
}

fn local_preview_webview(
    app: &tauri::AppHandle,
    label: &str,
) -> Result<tauri::WebviewWindow, String> {
    validate_local_preview_label(label)?;
    app.get_webview_window(label)
        .ok_or_else(|| format!("Local preview webview not found: {label}"))
}

#[tauri::command]
pub fn local_device_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "This PC".to_string())
}

#[tauri::command]
pub fn local_webview_inject_scrollbar_hide(
    app: tauri::AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = local_preview_webview(&app, &label)?;

    let script = r#"
(function () {
  var inject = function () {
    if (!document.head) { return setTimeout(inject, 16); }
    if (document.getElementById('__capubridge_hide_scrollbar__')) { return; }
    var s = document.createElement('style');
    s.id = '__capubridge_hide_scrollbar__';
    s.textContent = '::-webkit-scrollbar{width:0!important;height:0!important;background:transparent!important}::-webkit-scrollbar-thumb{display:none!important}html,body{scrollbar-width:none!important;-ms-overflow-style:none!important}';
    document.head.appendChild(s);
  };
  inject();
})();
"#;

    webview.eval(script).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn local_webview_navigate(
    app: tauri::AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = local_preview_webview(&app, &label)?;
    let validated_url = validate_preview_url(&url)?;
    let serialized_url = serde_json::to_string(&validated_url).map_err(|e| e.to_string())?;
    let script = format!("window.location.replace({serialized_url});");
    webview.eval(&script).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn local_webview_open_devtools(app: tauri::AppHandle, label: String) -> Result<(), String> {
    let webview = local_preview_webview(&app, &label)?;

    #[cfg(debug_assertions)]
    {
        webview.open_devtools();
        Ok(())
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = webview;
        Err("Local preview DevTools are available only in debug builds".to_string())
    }
}

#[tauri::command]
pub async fn local_webview_fetch_cdp_target(
    target_url: String,
) -> Result<Option<serde_json::Value>, String> {
    #[cfg(all(target_os = "windows", debug_assertions))]
    {
        use std::time::Duration;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| e.to_string())?;

        let endpoint = format!("http://127.0.0.1:{LOCAL_WEBVIEW_DEBUG_PORT}/json");
        let normalized = validate_preview_url(&target_url)?
            .trim_end_matches('/')
            .to_string();

        for attempt in 0..10u8 {
            if attempt > 0 {
                tokio::time::sleep(Duration::from_millis(500)).await;
            }

            let Ok(resp) = client.get(&endpoint).send().await else {
                continue;
            };
            let Ok(targets) = resp.json::<Vec<serde_json::Value>>().await else {
                continue;
            };

            let found = targets.into_iter().find(|target| {
                target["url"]
                    .as_str()
                    .map(|url| url.trim_end_matches('/') == normalized)
                    .unwrap_or(false)
            });

            if found.is_some() {
                return Ok(found);
            }
        }

        Ok(None)
    }

    #[cfg(not(all(target_os = "windows", debug_assertions)))]
    {
        let _ = target_url;
        Err("Local preview CDP access is available only in Windows debug builds".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_local_preview_label, validate_preview_url};

    #[test]
    fn accepts_isolated_preview_labels() {
        assert!(validate_local_preview_label("local-preview-550e8400-e29b-41d4-a716").is_ok());
        assert!(validate_local_preview_label("main").is_err());
        assert!(validate_local_preview_label("local-preview-").is_err());
    }

    #[test]
    fn accepts_only_network_preview_urls_without_credentials() {
        assert!(validate_preview_url("http://localhost:5173").is_ok());
        assert!(validate_preview_url("https://example.com/path").is_ok());
        assert!(validate_preview_url("javascript:alert(1)").is_err());
        assert!(validate_preview_url("https://user:secret@example.com").is_err());
    }

    #[cfg(all(target_os = "windows", debug_assertions))]
    #[test]
    fn debug_endpoint_is_loopback_and_origin_scoped() {
        let arguments = super::webview2_remote_debugging_arguments();
        assert!(arguments.contains("--remote-debugging-address=127.0.0.1"));
        assert!(arguments.contains("--remote-allow-origins=http://localhost:5173"));
        assert!(!arguments.contains("origins=*"));
    }
}
