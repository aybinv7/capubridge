use tauri::Manager;

pub const LOCAL_WEBVIEW_DEBUG_PORT: u16 = 19222;

#[cfg(target_os = "windows")]
pub fn enable_webview2_remote_debugging() {
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        format!("--remote-debugging-port={LOCAL_WEBVIEW_DEBUG_PORT} --remote-allow-origins=*"),
    );
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
    let webview = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Local webview not found: {label}"))?;

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
pub fn local_webview_open_devtools(app: tauri::AppHandle, label: String) -> Result<(), String> {
    let webview = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Local webview not found: {label}"))?;

    #[cfg(any(debug_assertions, feature = "devtools"))]
    {
        webview.open_devtools();
        Ok(())
    }

    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    {
        let _ = webview;
        Err("Webview DevTools are available only in debug builds or release builds with the devtools feature.".to_string())
    }
}

#[tauri::command]
pub async fn local_webview_fetch_cdp_target(
    target_url: String,
) -> Result<Option<serde_json::Value>, String> {
    use std::time::Duration;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    let endpoint = format!("http://localhost:{LOCAL_WEBVIEW_DEBUG_PORT}/json");
    let normalized = target_url.trim_end_matches('/').to_string();

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

        let found = targets.into_iter().find(|t| {
            t["url"]
                .as_str()
                .map(|u| u.trim_end_matches('/') == normalized)
                .unwrap_or(false)
        });

        if found.is_some() {
            return Ok(found);
        }
    }

    Ok(None)
}
