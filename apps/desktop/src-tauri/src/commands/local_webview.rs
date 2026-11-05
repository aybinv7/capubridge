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

fn local_preview_webview(app: &tauri::AppHandle, label: &str) -> Result<tauri::Webview, String> {
    validate_local_preview_label(label)?;
    app.get_webview(label)
        .ok_or_else(|| format!("Local preview webview not found: {label}"))
}

fn comparable_page_url(url: &str) -> Option<String> {
    let mut parsed = reqwest::Url::parse(url.trim()).ok()?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return None;
    }
    parsed.set_fragment(None);
    Some(parsed.as_str().trim_end_matches('/').to_string())
}

#[derive(Debug)]
enum DebugTargetMatch {
    Found(serde_json::Value),
    Ambiguous(Vec<serde_json::Value>),
    Missing,
}

fn select_debug_target(
    targets: Vec<serde_json::Value>,
    current_url: &str,
    claimed_target_ids: &[String],
) -> DebugTargetMatch {
    let Some(expected) = comparable_page_url(current_url) else {
        return DebugTargetMatch::Missing;
    };

    let mut candidates: Vec<serde_json::Value> = targets
        .into_iter()
        .filter(|target| target["type"].as_str() == Some("page"))
        .filter(|target| {
            target["webSocketDebuggerUrl"]
                .as_str()
                .is_some_and(|ws| !ws.is_empty())
        })
        .filter(|target| {
            target["id"]
                .as_str()
                .is_some_and(|id| !claimed_target_ids.iter().any(|claimed| claimed == id))
        })
        .filter(|target| {
            target["url"]
                .as_str()
                .and_then(comparable_page_url)
                .is_some_and(|url| url == expected)
        })
        .collect();

    match candidates.len() {
        0 => DebugTargetMatch::Missing,
        1 => DebugTargetMatch::Found(candidates.remove(0)),
        _ => DebugTargetMatch::Ambiguous(candidates),
    }
}

#[tauri::command]
pub async fn local_device_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "This PC".to_string())
}

#[tauri::command]
pub async fn local_webview_inject_scrollbar_hide(
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
pub async fn local_webview_navigate(
    app: tauri::AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = local_preview_webview(&app, &label)?;
    let validated_url = if url.trim() == "about:blank" {
        "about:blank".to_string()
    } else {
        validate_preview_url(&url)?
    };
    let serialized_url = serde_json::to_string(&validated_url).map_err(|e| e.to_string())?;
    let script = format!("window.location.replace({serialized_url});");
    webview.eval(&script).map_err(|e| e.to_string())
}

/// Moves and sizes a preview in one step, so it never shows at the new spot with the old size.
#[tauri::command]
pub async fn local_webview_set_bounds(
    app: tauri::AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if ![x, y, width, height].iter().all(|value| value.is_finite()) {
        return Err("Preview bounds must be finite numbers".to_string());
    }
    let webview = local_preview_webview(&app, &label)?;
    webview
        .set_bounds(tauri::Rect {
            position: tauri::LogicalPosition::new(x, y).into(),
            size: tauri::LogicalSize::new(width.max(1.0), height.max(1.0)).into(),
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn local_webview_open_devtools(app: tauri::AppHandle, label: String) -> Result<(), String> {
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

fn same_origin(left: &str, right: &str) -> bool {
    let (Ok(left), Ok(right)) = (reqwest::Url::parse(left), reqwest::Url::parse(right)) else {
        return false;
    };
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn ambiguity_message(count: usize, current_url: &str, own_url: Option<&str>) -> String {
    if own_url.is_some_and(|own| same_origin(own, current_url)) {
        return format!(
            "{current_url} is Capubridge's own dev server, so WebView2 shows it twice and cannot tell \
             which page to attach to. Run the app you want to inspect on another port."
        );
    }
    format!("{count} WebView2 pages are showing {current_url}; close duplicate local targets")
}

#[tauri::command]
pub async fn local_webview_fetch_cdp_target(
    app: tauri::AppHandle,
    label: String,
    claimed_target_ids: Vec<String>,
) -> Result<serde_json::Value, String> {
    #[cfg(all(target_os = "windows", debug_assertions))]
    {
        use std::time::{Duration, Instant};

        const DISCOVERY_TIMEOUT: Duration = Duration::from_secs(10);
        const POLL_INTERVAL: Duration = Duration::from_millis(300);

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| e.to_string())?;
        let endpoint = format!("http://127.0.0.1:{LOCAL_WEBVIEW_DEBUG_PORT}/json");
        let deadline = Instant::now() + DISCOVERY_TIMEOUT;
        let mut last_issue =
            format!("WebView2 debug endpoint 127.0.0.1:{LOCAL_WEBVIEW_DEBUG_PORT} did not respond");

        let marker = super::local_webview_probe::preview_marker_script(&label)?;

        loop {
            let preview = local_preview_webview(&app, &label)?;
            let current_url = preview.url().map_err(|e| e.to_string())?;
            if let Err(error) = preview.eval(&marker) {
                log::warn!("Failed to mark local preview {label}: {error}");
            }

            match client.get(&endpoint).send().await {
                Ok(response) => match response.json::<Vec<serde_json::Value>>().await {
                    Ok(targets) => {
                        match select_debug_target(
                            targets,
                            current_url.as_str(),
                            &claimed_target_ids,
                        ) {
                            DebugTargetMatch::Found(target) => return Ok(target),
                            DebugTargetMatch::Ambiguous(candidates) => {
                                let count = candidates.len();
                                if let Some(target) =
                                    super::local_webview_probe::pick_marked_page(candidates, &label)
                                        .await
                                {
                                    return Ok(target);
                                }
                                let own_url = app
                                    .get_webview_window("main")
                                    .and_then(|window| window.url().ok());
                                last_issue = ambiguity_message(
                                    count,
                                    current_url.as_str(),
                                    own_url.as_ref().map(|url| url.as_str()),
                                );
                            }
                            DebugTargetMatch::Missing => {
                                last_issue = format!(
                                    "No WebView2 debug target matches the preview page ({current_url})"
                                );
                            }
                        }
                    }
                    Err(error) => {
                        last_issue = format!("Invalid WebView2 debug target list: {error}");
                    }
                },
                Err(error) => {
                    last_issue = format!(
                        "WebView2 debug endpoint 127.0.0.1:{LOCAL_WEBVIEW_DEBUG_PORT} unreachable: {error}"
                    );
                }
            }

            if Instant::now() >= deadline {
                return Err(last_issue);
            }
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    }

    #[cfg(not(all(target_os = "windows", debug_assertions)))]
    {
        let _ = (app, label, claimed_target_ids);
        Err("Local preview CDP access is available only in Windows debug builds".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ambiguity_message, select_debug_target, validate_local_preview_label, validate_preview_url,
        DebugTargetMatch,
    };
    use serde_json::json;

    fn page(id: &str, url: &str) -> serde_json::Value {
        json!({
            "id": id,
            "type": "page",
            "url": url,
            "webSocketDebuggerUrl": format!("ws://127.0.0.1:19222/devtools/page/{id}"),
        })
    }

    #[test]
    fn matches_live_url_after_redirect_and_ignores_fragment_and_trailing_slash() {
        let targets = vec![
            page("main", "http://localhost:5173/storage"),
            page("preview", "https://www.example.com/fr/#/home"),
        ];
        let result = select_debug_target(targets, "https://www.example.com/fr", &[]);
        assert!(matches!(result, DebugTargetMatch::Found(target) if target["id"] == "preview"));
    }

    #[test]
    fn skips_claimed_targets_and_non_page_targets() {
        let mut worker = page("worker", "https://app.test/");
        worker["type"] = json!("service_worker");
        let targets = vec![
            page("taken", "https://app.test/"),
            worker,
            page("free", "https://app.test"),
        ];
        let result = select_debug_target(targets, "https://app.test/", &["taken".to_string()]);
        assert!(matches!(result, DebugTargetMatch::Found(target) if target["id"] == "free"));
    }

    #[test]
    fn reports_ambiguity_and_loading_pages() {
        let targets = vec![
            page("a", "https://app.test/"),
            page("b", "https://app.test/"),
        ];
        assert!(matches!(
            select_debug_target(targets.clone(), "https://app.test/", &[]),
            DebugTargetMatch::Ambiguous(found) if found.len() == 2
        ));
        assert!(matches!(
            select_debug_target(targets, "about:blank", &[]),
            DebugTargetMatch::Missing
        ));
    }

    #[test]
    fn explains_self_targeting_instead_of_blaming_duplicates() {
        let own = ambiguity_message(2, "http://localhost:5173/storage", Some("http://localhost:5173/"));
        assert!(own.contains("own dev server"));
        let other = ambiguity_message(2, "http://localhost:3000/", Some("http://localhost:5173/"));
        assert!(other.contains("close duplicate local targets"));
    }

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
