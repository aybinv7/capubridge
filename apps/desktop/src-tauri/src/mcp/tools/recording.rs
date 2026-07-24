//! Recording / replay tools: consult saved `.capu` sessions and scrub their
//! recorded database state along the timeline.
//!
//! These are read-only and reuse the existing recording command core fns
//! (`list_sessions_in`, `read_session_from`) and the replay database query
//! commands. Recording *capture* (starting a new recording) is orchestrated by
//! the frontend and is not exposed here — see the design doc.

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router, ErrorData};

use super::{ok_json, CapuBridgeTools};
use crate::commands::recording::{list_sessions_in, read_session_from};
use crate::commands::recording_db;
use crate::mcp::recording_query::{self, Filter};
use crate::mcp::types::{
    QueryRecordingParams, ReadRecordingDbParams, ReadRecordingParams, ReadRecordingTrackParams,
};

const TRACK_NAMES: [&str; 5] = ["rrweb", "network", "console", "perf", "databases"];

#[tool_router(router = recording_tool_router, vis = "pub(crate)")]
impl CapuBridgeTools {
    #[tool(
        name = "list_recordings",
        description = "List saved replay recordings (.capu sessions), newest first: id, label, start time, duration (ms), device serial, target URL, file path, and size. Use read_recording next to inspect one. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn list_recordings(&self) -> Result<CallToolResult, ErrorData> {
        let sessions = list_sessions_in(&self.sessions_dir)
            .map_err(|error| ErrorData::internal_error(error, None))?;
        ok_json(&sessions)
    }

    #[tool(
        name = "read_recording",
        description = "Read a saved recording's overview from its file_path (from list_recordings): the parsed manifest, an index of captured event tracks (name + byte size + event count) — rrweb (DOM), network, console, perf — plus databasePath and the recorded database sources. Does NOT return raw track events (they can be large); use read_recording_track to page through a track, and read_recording_db to inspect recorded DB state along the timeline. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_recording(
        &self,
        Parameters(ReadRecordingParams { file_path }): Parameters<ReadRecordingParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let read_cache_dir = self.sessions_dir.join("read_cache");
        let contents = read_session_from(&file_path, &read_cache_dir)
            .map_err(|error| ErrorData::internal_error(error, None))?;

        let manifest: serde_json::Value = serde_json::from_str(&contents.manifest_json)
            .map_err(|error| ErrorData::internal_error(format!("bad manifest: {error}"), None))?;

        let tracks: Vec<serde_json::Value> = contents
            .tracks
            .iter()
            .map(|(name, body)| {
                let events = body.lines().filter(|line| !line.trim().is_empty()).count();
                serde_json::json!({ "name": name, "bytes": body.len(), "events": events })
            })
            .collect();

        let database_sources = match &contents.database_path {
            Some(path) => recording_db::recording_database_sources(path.clone())
                .await
                .map_err(|error| ErrorData::internal_error(error, None))?,
            None => Vec::new(),
        };

        ok_json(&serde_json::json!({
            "manifest": manifest,
            "tracks": tracks,
            "databasePath": contents.database_path,
            "databaseSources": database_sources,
        }))
    }

    #[tool(
        name = "read_recording_track",
        description = "Page through one event track of a saved recording in raw order. track is one of rrweb, network, console, perf, databases. Each event carries a timestamp, so this is the recorded timeline for that track. Supports offset (default 0) and limit (default 100, max 500). To FILTER (by status/url/level/time) or CORRELATE across tracks instead of paging raw events, prefer query_recording — a raw network track can be huge. Get file_path from list_recordings and track names from read_recording. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_recording_track(
        &self,
        Parameters(ReadRecordingTrackParams {
            file_path,
            track,
            offset,
            limit,
        }): Parameters<ReadRecordingTrackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if !TRACK_NAMES.contains(&track.as_str()) {
            return Err(ErrorData::invalid_params(
                format!(
                    "Unknown track '{track}'. Valid tracks: {}",
                    TRACK_NAMES.join(", ")
                ),
                None,
            ));
        }

        let read_cache_dir = self.sessions_dir.join("read_cache");
        let contents = read_session_from(&file_path, &read_cache_dir)
            .map_err(|error| ErrorData::internal_error(error, None))?;

        let body = contents.tracks.get(&track).cloned().unwrap_or_default();
        let all_lines: Vec<&str> = body.lines().filter(|line| !line.trim().is_empty()).collect();
        let total = all_lines.len();
        let offset = offset.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(100).clamp(1, 500) as usize;

        let events: Vec<serde_json::Value> = all_lines
            .iter()
            .skip(offset)
            .take(limit)
            .map(|line| {
                serde_json::from_str::<serde_json::Value>(line)
                    .unwrap_or_else(|_| serde_json::Value::String((*line).to_string()))
            })
            .collect();

        let returned = events.len();
        ok_json(&serde_json::json!({
            "track": track,
            "totalEvents": total,
            "offset": offset,
            "returned": returned,
            "truncated": offset + returned < total,
            "events": events,
        }))
    }

    #[tool(
        name = "read_recording_db",
        description = "Inspect a recording's captured database state at a point on the timeline. database_path comes from read_recording's databasePath; position_ms is the timeline position. Omit source_id to get a per-source change summary at that position (the timeline overview: how many rows added/updated/deleted per source so far). Provide a source_id (from read_recording's databaseSources) to get the actual rows of that source at that position, paged with offset (default 0) and limit (default 100, max 500). Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn read_recording_db(
        &self,
        Parameters(ReadRecordingDbParams {
            database_path,
            position_ms,
            source_id,
            offset,
            limit,
        }): Parameters<ReadRecordingDbParams>,
    ) -> Result<CallToolResult, ErrorData> {
        match source_id {
            Some(source_id) => {
                let rows = recording_db::recording_database_table_rows(
                    database_path,
                    source_id,
                    position_ms,
                    offset.unwrap_or(0).max(0),
                    limit.unwrap_or(100).clamp(1, 500),
                )
                .await
                .map_err(|error| ErrorData::internal_error(error, None))?;
                ok_json(&rows)
            }
            None => {
                let summaries =
                    recording_db::recording_database_change_summaries(database_path, position_ms)
                        .await
                        .map_err(|error| ErrorData::internal_error(error, None))?;
                ok_json(&summaries)
            }
        }
    }

    #[tool(
        name = "query_recording",
        description = "Search one track of a saved recording with filters and optional cross-track correlation — the way to inspect a recording without dumping whole tracks. Filter network by min_status/max_status (e.g. min_status=400 for failures), url_pattern (substring), resource_type, method; console by level; any track by start_ms/end_ms. Results are COMPACT projections (network drops bodies/headers; set verbose=true for full data), paged with limit (default 50, max 200) and offset. Set correlate_track (e.g. query track=network with correlate_track=console) to attach that track's events within correlate_window_ms (default 500) of each match — e.g. console errors around a failed request — so you don't hand-align timestamps across separate dumps. Read-only.",
        annotations(read_only_hint = true)
    )]
    async fn query_recording(
        &self,
        Parameters(QueryRecordingParams {
            file_path,
            track,
            min_status,
            max_status,
            url_pattern,
            resource_type,
            method,
            level,
            start_ms,
            end_ms,
            limit,
            offset,
            verbose,
            correlate_track,
            correlate_window_ms,
        }): Parameters<QueryRecordingParams>,
    ) -> Result<CallToolResult, ErrorData> {
        if !TRACK_NAMES.contains(&track.as_str()) {
            return Err(ErrorData::invalid_params(
                format!("Unknown track '{track}'. Valid tracks: {}", TRACK_NAMES.join(", ")),
                None,
            ));
        }
        if let Some(ct) = &correlate_track {
            if !TRACK_NAMES.contains(&ct.as_str()) {
                return Err(ErrorData::invalid_params(
                    format!("Unknown correlate_track '{ct}'. Valid tracks: {}", TRACK_NAMES.join(", ")),
                    None,
                ));
            }
        }

        let read_cache_dir = self.sessions_dir.join("read_cache");
        let contents = read_session_from(&file_path, &read_cache_dir)
            .map_err(|error| ErrorData::internal_error(error, None))?;

        let filter = Filter {
            min_status,
            max_status,
            url_substr: url_pattern,
            resource_type,
            method,
            level,
            start_ms,
            end_ms,
        };
        let verbose = verbose.unwrap_or(false);
        let limit = limit.unwrap_or(50).clamp(1, 200) as usize;
        let offset = offset.unwrap_or(0) as usize;

        let events = recording_query::parse_track(contents.tracks.get(&track).map_or("", |s| s));
        let matched: Vec<&recording_query::Event> =
            events.iter().filter(|event| recording_query::matches(event, &filter)).collect();
        let total = matched.len();

        // Correlation source (parsed once, compact-projected per match).
        let correlate = correlate_track.as_deref().map(|ct| {
            let window = correlate_window_ms.unwrap_or(500);
            let source = recording_query::parse_track(contents.tracks.get(ct).map_or("", |s| s));
            (ct.to_string(), window, source)
        });

        let results: Vec<serde_json::Value> = matched
            .iter()
            .skip(offset)
            .take(limit)
            .map(|event| {
                let mut projected = recording_query::project(&track, event, verbose);
                if let Some((ct, window, source)) = &correlate {
                    let near: Vec<serde_json::Value> = recording_query::correlate(event.t, source, *window)
                        .iter()
                        .map(|other| recording_query::project(ct, other, false))
                        .collect();
                    if let Some(map) = projected.as_object_mut() {
                        map.insert("correlated".to_string(), serde_json::json!(near));
                    }
                }
                projected
            })
            .collect();

        let returned = results.len();
        ok_json(&serde_json::json!({
            "track": track,
            "totalMatched": total,
            "offset": offset,
            "returned": returned,
            "truncated": offset + returned < total,
            "correlateTrack": correlate_track,
            "results": results,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::fixture::tools;

    #[tokio::test]
    async fn list_recordings_on_empty_dir_is_ok_and_empty() {
        // The fixture points sessions_dir at the OS temp dir; there may or may
        // not be stray files, but the call must succeed and return a JSON array.
        let result = tools().list_recordings().await.expect("ok");
        assert_eq!(result.is_error, Some(false));
        let text = result.content[0]
            .as_text()
            .expect("text content block")
            .text
            .clone();
        let value: serde_json::Value = serde_json::from_str(&text).expect("valid json");
        assert!(value.is_array());
    }

    #[tokio::test]
    async fn read_recording_track_rejects_unknown_track() {
        let result = tools()
            .read_recording_track(Parameters(ReadRecordingTrackParams {
                file_path: "does-not-matter".into(),
                track: "not-a-track".into(),
                offset: None,
                limit: None,
            }))
            .await;
        let error = result.expect_err("unknown track must be rejected");
        assert!(error.message.contains("Unknown track"));
    }

    #[tokio::test]
    async fn read_recording_missing_file_errors() {
        let result = tools()
            .read_recording(Parameters(ReadRecordingParams {
                file_path: "C:/nonexistent/session.capu".into(),
            }))
            .await;
        assert!(result.is_err());
    }

    fn query_params(track: &str, correlate: Option<&str>) -> QueryRecordingParams {
        QueryRecordingParams {
            file_path: "does-not-matter".into(),
            track: track.into(),
            min_status: None,
            max_status: None,
            url_pattern: None,
            resource_type: None,
            method: None,
            level: None,
            start_ms: None,
            end_ms: None,
            limit: None,
            offset: None,
            verbose: None,
            correlate_track: correlate.map(str::to_string),
            correlate_window_ms: None,
        }
    }

    #[tokio::test]
    async fn query_recording_rejects_unknown_track() {
        let result = tools()
            .query_recording(Parameters(query_params("not-a-track", None)))
            .await;
        assert!(result.expect_err("bad track").message.contains("Unknown track"));
    }

    #[tokio::test]
    async fn query_recording_rejects_unknown_correlate_track() {
        let result = tools()
            .query_recording(Parameters(query_params("network", Some("bogus"))))
            .await;
        assert!(result
            .expect_err("bad correlate track")
            .message
            .contains("Unknown correlate_track"));
    }

    #[tokio::test]
    async fn query_recording_missing_file_errors() {
        let result = tools()
            .query_recording(Parameters(query_params("network", None)))
            .await;
        assert!(result.is_err());
    }
}
