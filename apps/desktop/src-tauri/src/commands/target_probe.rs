use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};

const PROBE_TIMEOUT: Duration = Duration::from_millis(1500);

/// One process-wide client so a probe every few seconds reuses its loopback connection.
static PROBE_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn probe_client() -> Result<&'static reqwest::Client, String> {
    if let Some(client) = PROBE_CLIENT.get() {
        return Ok(client);
    }
    let client = reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .connect_timeout(PROBE_TIMEOUT)
        .pool_idle_timeout(Duration::from_secs(30))
        .no_proxy()
        .build()
        .map_err(|error| format!("Failed to build probe client: {error}"))?;
    Ok(PROBE_CLIENT.get_or_init(|| client))
}

/// What the DevTools endpoint says about one target right now.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TargetPresence {
    /// Listed and drawn on screen.
    Visible,
    /// Listed, but Android reports the view as not visible.
    Hidden,
    /// The endpoint answered and the target is no longer listed.
    Gone,
    /// The endpoint did not answer in time; Android froze the process or the forward died.
    Unresponsive,
    /// Listed, but the endpoint gives no visibility information.
    Unknown,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TargetProbe {
    pub presence: TargetPresence,
    /// Another target of the same endpoint is on screen while this one is not.
    pub sibling_visible: bool,
}

#[derive(Debug, Deserialize)]
struct ListedTarget {
    id: String,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ViewDescription {
    visible: Option<bool>,
}

fn visibility(target: &ListedTarget) -> Option<bool> {
    let raw = target.description.as_deref()?;
    serde_json::from_str::<ViewDescription>(raw).ok()?.visible
}

/// Pure classification of a `/json` listing for one target id.
fn classify(targets: &[ListedTarget], target_id: &str) -> TargetProbe {
    let Some(target) = targets.iter().find(|entry| entry.id == target_id) else {
        return TargetProbe {
            presence: TargetPresence::Gone,
            sibling_visible: false,
        };
    };
    let sibling_visible = targets
        .iter()
        .any(|entry| entry.id != target_id && visibility(entry) == Some(true));
    let presence = match visibility(target) {
        Some(true) => TargetPresence::Visible,
        Some(false) => TargetPresence::Hidden,
        None => TargetPresence::Unknown,
    };
    TargetProbe {
        presence,
        sibling_visible,
    }
}

fn unresponsive() -> TargetProbe {
    TargetProbe {
        presence: TargetPresence::Unresponsive,
        sibling_visible: false,
    }
}

/// Asks an already-forwarded DevTools port whether `target_id` is still listed and on screen.
/// Never forwards a new port, so it is cheap enough to poll.
#[tauri::command]
pub async fn cdp_probe_target(port: u16, target_id: String) -> Result<TargetProbe, String> {
    let response = match probe_client()?
        .get(format!("http://127.0.0.1:{port}/json"))
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => return Ok(unresponsive()),
    };

    if !response.status().is_success() {
        return Ok(unresponsive());
    }

    match response.json::<Vec<ListedTarget>>().await {
        Ok(targets) => Ok(classify(&targets, &target_id)),
        Err(_) => Ok(unresponsive()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn listed(id: &str, description: Option<&str>) -> ListedTarget {
        ListedTarget {
            id: id.to_string(),
            description: description.map(str::to_string),
        }
    }

    #[test]
    fn visible_target_is_visible() {
        let targets = [listed("a", Some(r#"{"attached":true,"visible":true}"#))];
        assert_eq!(classify(&targets, "a").presence, TargetPresence::Visible);
    }

    #[test]
    fn hidden_target_reports_visible_sibling() {
        let targets = [
            listed("a", Some(r#"{"visible":false}"#)),
            listed("b", Some(r#"{"visible":true}"#)),
        ];
        let probe = classify(&targets, "a");
        assert_eq!(probe.presence, TargetPresence::Hidden);
        assert!(probe.sibling_visible);
    }

    #[test]
    fn missing_target_is_gone() {
        let targets = [listed("b", Some(r#"{"visible":true}"#))];
        assert_eq!(classify(&targets, "a").presence, TargetPresence::Gone);
    }

    #[test]
    fn unparseable_description_is_unknown() {
        let targets = [listed("a", Some("")), listed("b", None)];
        assert_eq!(classify(&targets, "a").presence, TargetPresence::Unknown);
        assert_eq!(classify(&targets, "b").presence, TargetPresence::Unknown);
    }
}
