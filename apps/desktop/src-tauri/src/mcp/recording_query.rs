//! Pure filtering / projection / cross-track correlation over recorded
//! session tracks, backing the `query_recording` tool.
//!
//! Each track is NDJSON of `{ "t": <ms offset>, "data": {...} }`. This module
//! parses that, filters by common fields (network status/url/type/method,
//! console level, any track's time range), projects a compact view (so a
//! network track doesn't return megabytes of bodies/headers), and correlates
//! matches against another track by a timestamp window. Kept free of MCP/Tauri
//! types so it's unit-testable in isolation.

use serde_json::{json, Value};

/// One recorded event: millisecond offset from session start + its payload.
#[derive(Debug, Clone)]
pub struct Event {
    pub t: i64,
    pub data: Value,
}

/// Filter criteria; all set fields must match (AND).
#[derive(Debug, Default, Clone)]
pub struct Filter {
    pub min_status: Option<i64>,
    pub max_status: Option<i64>,
    /// Case-insensitive substring match on `data.url`.
    pub url_substr: Option<String>,
    /// Case-insensitive exact match on `data.resourceType`.
    pub resource_type: Option<String>,
    /// Case-insensitive exact match on `data.method`.
    pub method: Option<String>,
    /// Case-insensitive exact match on `data.level` (console).
    pub level: Option<String>,
    pub start_ms: Option<i64>,
    pub end_ms: Option<i64>,
}

/// Parse a track's NDJSON body into events, skipping blank/unparseable lines.
pub fn parse_track(ndjson: &str) -> Vec<Event> {
    ndjson
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .map(|value| Event {
            t: value.get("t").and_then(Value::as_i64).unwrap_or(0),
            data: value.get("data").cloned().unwrap_or(Value::Null),
        })
        .collect()
}

fn eq_ci(field: Option<&str>, want: &str) -> bool {
    field.is_some_and(|value| value.eq_ignore_ascii_case(want))
}

/// Whether `event` satisfies every set criterion in `filter`.
pub fn matches(event: &Event, filter: &Filter) -> bool {
    if let Some(start) = filter.start_ms {
        if event.t < start {
            return false;
        }
    }
    if let Some(end) = filter.end_ms {
        if event.t > end {
            return false;
        }
    }

    let status = event.data.get("status").and_then(Value::as_i64);
    if let Some(min) = filter.min_status {
        // A status filter implies "has a status" — failed requests with a null
        // status don't match a numeric threshold.
        if status.map_or(true, |value| value < min) {
            return false;
        }
    }
    if let Some(max) = filter.max_status {
        if status.map_or(true, |value| value > max) {
            return false;
        }
    }

    if let Some(substr) = &filter.url_substr {
        let url = event.data.get("url").and_then(Value::as_str).unwrap_or("");
        if !url.to_ascii_lowercase().contains(&substr.to_ascii_lowercase()) {
            return false;
        }
    }
    if let Some(rt) = &filter.resource_type {
        if !eq_ci(event.data.get("resourceType").and_then(Value::as_str), rt) {
            return false;
        }
    }
    if let Some(method) = &filter.method {
        if !eq_ci(event.data.get("method").and_then(Value::as_str), method) {
            return false;
        }
    }
    if let Some(level) = &filter.level {
        if !eq_ci(event.data.get("level").and_then(Value::as_str), level) {
            return false;
        }
    }

    true
}

/// Object of only the top-level scalar fields of `data` — a bounded summary
/// for arbitrary tracks (rrweb, perf, databases) that avoids returning nested
/// payloads.
fn scalar_fields(data: &Value) -> Value {
    match data.as_object() {
        Some(map) => {
            let mut out = serde_json::Map::new();
            for (key, value) in map {
                if value.is_string() || value.is_number() || value.is_boolean() {
                    out.insert(key.clone(), value.clone());
                }
            }
            Value::Object(out)
        }
        None => data.clone(),
    }
}

/// Compact, size-bounded projection of one event for the given track. `verbose`
/// returns the full `data` instead (use sparingly — network bodies are large).
pub fn project(track: &str, event: &Event, verbose: bool) -> Value {
    if verbose {
        return json!({ "t": event.t, "data": event.data });
    }
    match track {
        "network" => json!({
            "t": event.t,
            "method": event.data.get("method"),
            "url": event.data.get("url"),
            "status": event.data.get("status"),
            "resourceType": event.data.get("resourceType"),
            "durationMs": event.data.get("duration"),
            "state": event.data.get("state"),
        }),
        "console" => json!({
            "t": event.t,
            "level": event.data.get("level"),
            "text": event.data.get("text"),
        }),
        _ => json!({ "t": event.t, "data": scalar_fields(&event.data) }),
    }
}

/// Events in `others` whose timestamp is within `window_ms` of `t`.
pub fn correlate(t: i64, others: &[Event], window_ms: i64) -> Vec<&Event> {
    others
        .iter()
        .filter(|event| (event.t - t).abs() <= window_ms)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ev(t: i64, data: Value) -> Event {
        Event { t, data }
    }

    #[test]
    fn parse_track_reads_t_and_data_skipping_blanks() {
        let ndjson = "{\"t\":10,\"data\":{\"status\":200}}\n\n{\"t\":20,\"data\":{}}\nnot-json\n";
        let events = parse_track(ndjson);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].t, 10);
        assert_eq!(events[1].t, 20);
    }

    #[test]
    fn min_status_matches_only_present_status_at_or_above() {
        let f = Filter { min_status: Some(400), ..Default::default() };
        assert!(matches(&ev(0, json!({ "status": 404 })), &f));
        assert!(matches(&ev(0, json!({ "status": 500 })), &f));
        assert!(!matches(&ev(0, json!({ "status": 200 })), &f));
        // Null/missing status must NOT match a numeric threshold.
        assert!(!matches(&ev(0, json!({ "status": Value::Null })), &f));
        assert!(!matches(&ev(0, json!({})), &f));
    }

    #[test]
    fn url_substr_is_case_insensitive() {
        let f = Filter { url_substr: Some("/API/Sync".into()), ..Default::default() };
        assert!(matches(&ev(0, json!({ "url": "https://x/api/sync/step1" })), &f));
        assert!(!matches(&ev(0, json!({ "url": "https://x/other" })), &f));
    }

    #[test]
    fn method_and_resource_type_and_level_match_case_insensitively() {
        assert!(matches(
            &ev(0, json!({ "method": "post" })),
            &Filter { method: Some("POST".into()), ..Default::default() }
        ));
        assert!(matches(
            &ev(0, json!({ "resourceType": "XHR" })),
            &Filter { resource_type: Some("xhr".into()), ..Default::default() }
        ));
        assert!(matches(
            &ev(0, json!({ "level": "Error" })),
            &Filter { level: Some("error".into()), ..Default::default() }
        ));
    }

    #[test]
    fn time_range_bounds_are_inclusive() {
        let f = Filter { start_ms: Some(100), end_ms: Some(200), ..Default::default() };
        assert!(matches(&ev(100, json!({})), &f));
        assert!(matches(&ev(200, json!({})), &f));
        assert!(!matches(&ev(99, json!({})), &f));
        assert!(!matches(&ev(201, json!({})), &f));
    }

    #[test]
    fn project_network_is_compact_and_drops_bodies() {
        let event = ev(
            5,
            json!({ "url": "u", "method": "GET", "status": 200, "resourceType": "XHR",
                    "duration": 42, "state": "complete", "responseBody": "HUGE" }),
        );
        let compact = project("network", &event, false);
        assert_eq!(compact["status"], json!(200));
        assert_eq!(compact["durationMs"], json!(42));
        assert!(compact.get("responseBody").is_none(), "bodies must be dropped");

        let verbose = project("network", &event, true);
        assert_eq!(verbose["data"]["responseBody"], json!("HUGE"));
    }

    #[test]
    fn project_generic_keeps_only_scalar_fields() {
        let event = ev(1, json!({ "type": 3, "id": "a", "nested": { "x": 1 }, "list": [1, 2] }));
        let compact = project("rrweb", &event, false);
        assert_eq!(compact["data"]["type"], json!(3));
        assert_eq!(compact["data"]["id"], json!("a"));
        assert!(compact["data"].get("nested").is_none());
        assert!(compact["data"].get("list").is_none());
    }

    #[test]
    fn correlate_returns_events_within_the_window_either_side() {
        let others = vec![ev(400, json!({})), ev(600, json!({})), ev(1500, json!({}))];
        let near = correlate(1000, &others, 500);
        assert_eq!(near.len(), 2); // 600 and 1500 are within ±500; 400 is not
        assert!(near.iter().all(|e| (e.t - 1000).abs() <= 500));
    }
}
