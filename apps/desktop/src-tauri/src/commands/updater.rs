//! In-app updater commands.
//!
//! We drive the updater through custom commands (instead of the plugin's JS
//! API) so the update endpoint can be chosen at runtime based on the user's
//! channel preference. The stable channel resolves to GitHub's static
//! `releases/latest` manifest; the pre-release channel queries the GitHub API
//! for the newest published release (including pre-releases) and reads its
//! `latest.json` asset. All network access happens here in Rust, so the webview
//! CSP is untouched.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// GitHub `owner/repo` the updater pulls releases from.
const REPO: &str = "aybinv7/capubridge";

/// Holds the update resolved by [`updater_check`] until [`updater_install`]
/// consumes it. Managed as Tauri state.
#[derive(Default)]
pub struct PendingUpdate(pub Mutex<Option<Update>>);

/// Metadata about an available update, returned to the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

/// Download-progress event payload emitted as `updater://progress`.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    chunk_length: usize,
    content_length: Option<u64>,
}

/// Resolve the `latest.json` endpoint for the requested channel.
async fn resolve_endpoint(prerelease: bool) -> Result<String, String> {
    if !prerelease {
        // GitHub resolves `releases/latest` to the newest non-pre-release.
        return Ok(format!(
            "https://github.com/{REPO}/releases/latest/download/latest.json"
        ));
    }

    // Pre-release channel: ask the GitHub API for recent releases (newest
    // first, including pre-releases) and use the first published release that
    // ships an updater manifest.
    let api = format!("https://api.github.com/repos/{REPO}/releases?per_page=15");
    let client = reqwest::Client::new();
    let releases: serde_json::Value = client
        .get(&api)
        .header("User-Agent", "capubridge-updater")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("GitHub API parse failed: {e}"))?;

    resolve_prerelease_asset(&releases)
}

/// Pick the `latest.json` browser download URL from a GitHub releases payload.
/// Split out so it can be unit-tested without hitting the network.
fn resolve_prerelease_asset(releases: &serde_json::Value) -> Result<String, String> {
    let releases = releases
        .as_array()
        .ok_or_else(|| "Unexpected GitHub API response".to_string())?;

    for release in releases {
        if release
            .get("draft")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false)
        {
            continue;
        }
        let assets = release
            .get("assets")
            .and_then(serde_json::Value::as_array);
        let Some(assets) = assets else { continue };
        for asset in assets {
            if asset.get("name").and_then(serde_json::Value::as_str) == Some("latest.json") {
                if let Some(url) = asset
                    .get("browser_download_url")
                    .and_then(serde_json::Value::as_str)
                {
                    return Ok(url.to_string());
                }
            }
        }
    }

    Err("No published release with an updater manifest was found".to_string())
}

/// Check the given channel for an available update. Stores the resolved update
/// in state (or clears it) and returns its metadata, or `None` if up to date.
#[tauri::command]
pub async fn updater_check(
    app: AppHandle,
    prerelease: bool,
) -> Result<Option<UpdateInfo>, String> {
    let endpoint = resolve_endpoint(prerelease).await?;
    let url = endpoint
        .parse()
        .map_err(|e| format!("Invalid updater endpoint: {e}"))?;

    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    let update = updater.check().await.map_err(|e| e.to_string())?;

    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
        pub_date: u.date.map(|d| d.to_string()),
    });

    *app.state::<PendingUpdate>().0.lock().unwrap() = update;

    Ok(info)
}

/// Download and install the update previously resolved by [`updater_check`],
/// emitting `updater://progress` events, then relaunch the app.
#[tauri::command]
pub async fn updater_install(app: AppHandle) -> Result<(), String> {
    let update = {
        let state = app.state::<PendingUpdate>();
        let mut guard = state.0.lock().unwrap();
        guard.take()
    }
    .ok_or_else(|| "No update is available. Check for updates first.".to_string())?;

    let emitter = app.clone();
    update
        .download_and_install(
            move |chunk_length, content_length| {
                let _ = emitter.emit(
                    "updater://progress",
                    ProgressPayload {
                        chunk_length,
                        content_length,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;

    // Relaunch into the freshly installed version. `restart()` never returns.
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn picks_latest_json_from_first_published_release() {
        let payload = json!([
            {
                "draft": true,
                "assets": [{ "name": "latest.json", "browser_download_url": "https://draft" }]
            },
            {
                "draft": false,
                "assets": [
                    { "name": "capubridge_1.2.0_x64-setup.exe", "browser_download_url": "https://exe" },
                    { "name": "latest.json", "browser_download_url": "https://good/latest.json" }
                ]
            }
        ]);
        assert_eq!(
            resolve_prerelease_asset(&payload).unwrap(),
            "https://good/latest.json"
        );
    }

    #[test]
    fn errors_when_no_manifest_present() {
        let payload = json!([
            { "draft": false, "assets": [{ "name": "app.exe", "browser_download_url": "https://x" }] }
        ]);
        assert!(resolve_prerelease_asset(&payload).is_err());
    }

    #[test]
    fn errors_on_non_array_payload() {
        let payload = json!({ "message": "Not Found" });
        assert!(resolve_prerelease_asset(&payload).is_err());
    }
}
