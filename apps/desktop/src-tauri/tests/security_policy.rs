use serde_json::Value;
use std::{fs, path::PathBuf};

fn manifest_path(relative: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative)
}

fn read_json(relative: &str) -> Value {
    let content = fs::read_to_string(manifest_path(relative)).expect("security config must exist");
    serde_json::from_str(&content).expect("security config must be valid JSON")
}

#[test]
fn production_config_has_a_restrictive_csp() {
    let config = read_json("tauri.conf.json");
    let csp = config["app"]["security"]["csp"]
        .as_str()
        .expect("CSP must be configured");

    assert!(csp.contains("default-src 'self'"));
    assert!(csp.contains("object-src 'none'"));
    assert!(csp.contains("base-uri 'none'"));
    assert!(!csp.contains("unsafe-eval"));
}

#[test]
fn capabilities_do_not_grant_preview_or_unscoped_shell_access() {
    let capability_directory = manifest_path("capabilities");
    let mut privileged_main_found = false;

    for entry in fs::read_dir(capability_directory).expect("capability directory must exist") {
        let path = entry.expect("capability entry must be readable").path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }

        let content = fs::read_to_string(&path).expect("capability must be readable");
        let capability: Value = serde_json::from_str(&content).expect("capability must be valid");
        let serialized = capability.to_string();

        assert!(capability.get("remote").is_none());
        assert!(!serialized.contains("shell:allow-execute"));
        assert!(!serialized.contains("shell:allow-spawn"));

        if capability["identifier"] == "main-application" {
            privileged_main_found = true;
            assert_eq!(capability["webviews"], serde_json::json!(["main"]));
            assert!(capability.get("windows").is_none());
        }

        let webviews = capability["webviews"]
            .as_array()
            .expect("capability must target explicit webviews");
        assert!(!webviews.iter().any(|label| {
            label
                .as_str()
                .is_some_and(|value| value.starts_with("local-preview-"))
        }));
    }

    assert!(privileged_main_found);
}

#[test]
fn local_webview_source_has_no_wildcard_origin_allowance() {
    let source = fs::read_to_string(manifest_path("src/commands/local_webview.rs"))
        .expect("local webview command source must exist");
    let forbidden = ["remote-allow-origins", "=", "*"].concat();

    assert!(!source.contains(&forbidden));
}
