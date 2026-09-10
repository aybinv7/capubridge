use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use zip::write::{SimpleFileOptions, ZipWriter};
use zip::ZipArchive;

use super::recording::write_session_archive;

const SHAREABLE_TRACKS: [&str; 5] = ["rrweb", "network", "console", "perf", "databases"];
const SENSITIVE_HEADERS: [&str; 7] = [
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "x-api-key",
    "x-auth-token",
    "x-csrf-token",
];

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSanitizeOptions {
    pub redact_urls: bool,
    pub redact_bodies: bool,
    pub redact_dom: bool,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingExportReport {
    pub redacted_urls: u64,
    pub redacted_bodies: u64,
    pub redacted_headers: u64,
    pub excluded_tracks: Vec<String>,
}

fn redact_value(value: &mut Value, options: &RecordingSanitizeOptions, report: &mut RecordingExportReport) {
    match value {
        Value::Array(items) => {
            for item in items {
                redact_value(item, options, report);
            }
        }
        Value::Object(object) => redact_object(object, options, report),
        _ => {}
    }
}

fn redact_object(
    object: &mut Map<String, Value>,
    options: &RecordingSanitizeOptions,
    report: &mut RecordingExportReport,
) {
    for (key, value) in object {
        let normalized = key.to_ascii_lowercase();
        if normalized.ends_with("headers") {
            if let Value::Object(headers) = value {
                for (header, header_value) in headers {
                    if SENSITIVE_HEADERS.contains(&header.to_ascii_lowercase().as_str()) {
                        *header_value = Value::String("[REDACTED]".to_string());
                        report.redacted_headers += 1;
                    }
                }
            }
            continue;
        }
        if options.redact_urls && (normalized == "url" || normalized.ends_with("url")) {
            if !value.is_null() {
                *value = Value::String("[REDACTED_URL]".to_string());
                report.redacted_urls += 1;
            }
            continue;
        }
        if options.redact_bodies && normalized.contains("body") {
            if !value.is_null() {
                *value = Value::String("[REDACTED]".to_string());
                report.redacted_bodies += 1;
            }
            continue;
        }
        redact_value(value, options, report);
    }
}

fn sanitize_ndjson<R: Read, W: Write>(
    reader: R,
    mut writer: W,
    options: &RecordingSanitizeOptions,
    report: &mut RecordingExportReport,
) -> Result<(), String> {
    for line in BufReader::new(reader).lines() {
        let line = line.map_err(|error| format!("Failed to read recording track: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }
        let mut value: Value = serde_json::from_str(&line)
            .map_err(|error| format!("Invalid recording track event: {error}"))?;
        redact_value(&mut value, options, report);
        serde_json::to_writer(&mut writer, &value)
            .map_err(|error| format!("Failed to write sanitized event: {error}"))?;
        writer
            .write_all(b"\n")
            .map_err(|error| format!("Failed to write sanitized track: {error}"))?;
    }
    Ok(())
}

fn excluded(track: &str, options: &RecordingSanitizeOptions) -> bool {
    track == "console" || track == "databases" || (track == "rrweb" && options.redact_dom)
}

fn preview_export(source_path: &Path, options: &RecordingSanitizeOptions) -> Result<RecordingExportReport, String> {
    let source = fs::File::open(source_path)
        .map_err(|error| format!("Cannot open recording: {error}"))?;
    let mut archive = ZipArchive::new(source)
        .map_err(|error| format!("Invalid recording archive: {error}"))?;
    let mut report = RecordingExportReport::default();
    let mut manifest = String::new();
    archive
        .by_name("manifest.json")
        .map_err(|_| "Recording manifest is missing".to_string())?
        .read_to_string(&mut manifest)
        .map_err(|error| format!("Failed to read recording manifest: {error}"))?;
    let mut manifest: Value = serde_json::from_str(&manifest)
        .map_err(|error| format!("Invalid recording manifest: {error}"))?;
    redact_value(&mut manifest, options, &mut report);

    for track in SHAREABLE_TRACKS {
        let name = format!("tracks/{track}.ndjson");
        let Ok(file) = archive.by_name(&name) else {
            continue;
        };
        if excluded(track, options) {
            report.excluded_tracks.push(track.to_string());
        } else if track == "network" || track == "rrweb" {
            sanitize_ndjson(file, std::io::sink(), options, &mut report)?;
        }
    }
    if archive.by_name("artifacts/databases.sqlite").is_ok()
        && !report.excluded_tracks.iter().any(|track| track == "databases")
    {
        report.excluded_tracks.push("databases".to_string());
    }
    Ok(report)
}

fn materialize_source(source_path: &Path) -> Result<(PathBuf, bool), String> {
    if !source_path.is_dir() {
        return Ok((source_path.to_path_buf(), false));
    }
    let manifest = fs::read_to_string(source_path.join("manifest.json"))
        .map_err(|error| format!("Cannot read recovery manifest: {error}"))?;
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let temporary = std::env::temp_dir().join(format!("capubridge-recovery-{nonce}.capu"));
    write_session_archive(source_path, &temporary, &manifest)?;
    Ok((temporary, true))
}

fn sanitized_export(
    source_path: &Path,
    destination_path: &Path,
    options: &RecordingSanitizeOptions,
) -> Result<RecordingExportReport, String> {
    let source = fs::File::open(source_path)
        .map_err(|error| format!("Cannot open recording: {error}"))?;
    let mut archive = ZipArchive::new(source)
        .map_err(|error| format!("Invalid recording archive: {error}"))?;
    let output = fs::File::create(destination_path)
        .map_err(|error| format!("Cannot create export: {error}"))?;
    let mut output = ZipWriter::new(output);
    let zip_options =
        SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut report = RecordingExportReport::default();

    let mut manifest = String::new();
    archive
        .by_name("manifest.json")
        .map_err(|_| "Recording manifest is missing".to_string())?
        .read_to_string(&mut manifest)
        .map_err(|error| format!("Failed to read recording manifest: {error}"))?;
    let mut manifest: Value = serde_json::from_str(&manifest)
        .map_err(|error| format!("Invalid recording manifest: {error}"))?;
    redact_value(&mut manifest, options, &mut report);
    manifest["shareableExport"] = serde_json::json!({
        "sanitized": true,
        "redactUrls": options.redact_urls,
        "redactBodies": options.redact_bodies,
        "redactDom": options.redact_dom
    });
    output
        .start_file("manifest.json", zip_options)
        .map_err(|error| format!("Failed to create export manifest: {error}"))?;
    serde_json::to_writer(&mut output, &manifest)
        .map_err(|error| format!("Failed to write export manifest: {error}"))?;

    for track in SHAREABLE_TRACKS {
        let name = format!("tracks/{track}.ndjson");
        let Ok(mut file) = archive.by_name(&name) else {
            continue;
        };
        if excluded(track, options) {
            report.excluded_tracks.push(track.to_string());
            continue;
        }
        output
            .start_file(&name, zip_options)
            .map_err(|error| format!("Failed to create export track: {error}"))?;
        if track == "network" || track == "rrweb" {
            sanitize_ndjson(file, &mut output, options, &mut report)?;
        } else {
            std::io::copy(&mut file, &mut output)
                .map_err(|error| format!("Failed to copy export track: {error}"))?;
        }
    }

    if archive.by_name("artifacts/databases.sqlite").is_ok()
        && !report.excluded_tracks.iter().any(|track| track == "databases")
    {
        report.excluded_tracks.push("databases".to_string());
    }
    output
        .finish()
        .map_err(|error| format!("Failed to finalize export: {error}"))?
        .sync_all()
        .map_err(|error| format!("Failed to sync export: {error}"))?;
    Ok(report)
}

fn partial_destination(destination_path: &Path) -> PathBuf {
    let mut name = destination_path.as_os_str().to_os_string();
    name.push(".partial");
    PathBuf::from(name)
}

#[tauri::command]
pub async fn recording_export_preview(
    source_path: String,
    options: RecordingSanitizeOptions,
) -> Result<RecordingExportReport, String> {
    let (source, temporary) = materialize_source(Path::new(&source_path))?;
    let result = preview_export(&source, &options);
    if temporary {
        let _ = fs::remove_file(source);
    }
    result
}

#[tauri::command]
pub async fn recording_export_session(
    source_path: String,
    destination_path: String,
    raw: bool,
    options: RecordingSanitizeOptions,
) -> Result<RecordingExportReport, String> {
    let original_source = Path::new(&source_path);
    let destination = Path::new(&destination_path);
    if original_source == destination {
        return Err("Export destination must differ from source".to_string());
    }
    let (source, temporary_source) = materialize_source(original_source)?;
    let partial = partial_destination(destination);
    let result = (|| {
        preview_export(&source, &options)?;
        if partial.exists() {
            fs::remove_file(&partial)
                .map_err(|error| format!("Cannot reset partial export: {error}"))?;
        }
        let report = if raw {
            fs::copy(&source, &partial)
                .map_err(|error| format!("Failed to copy raw export: {error}"))?;
            RecordingExportReport::default()
        } else {
            sanitized_export(&source, &partial, &options)?
        };
        if destination.exists() {
            fs::remove_file(destination)
                .map_err(|error| format!("Failed to replace export destination: {error}"))?;
        }
        fs::rename(&partial, destination)
            .map_err(|error| format!("Failed to publish export: {error}"))?;
        Ok(report)
    })();
    if temporary_source {
        let _ = fs::remove_file(source);
    }
    if result.is_err() {
        let _ = fs::remove_file(partial);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn sanitizes_sensitive_network_values() {
        let input = br#"{"t":1,"data":{"url":"https://test/?token=fixture-secret","requestHeaders":{"Authorization":"Bearer fixture-secret","Accept":"json"},"requestBody":"fixture-secret"}}
"#;
        let options = RecordingSanitizeOptions {
            redact_urls: true,
            redact_bodies: true,
            redact_dom: true,
        };
        let mut output = Vec::new();
        let mut report = RecordingExportReport::default();
        sanitize_ndjson(&input[..], &mut output, &options, &mut report).expect("sanitize");
        let text = String::from_utf8(output).expect("utf8");
        assert!(!text.contains("fixture-secret"));
        assert!(text.contains("[REDACTED_URL]"));
        assert_eq!(report.redacted_headers, 1);
        assert_eq!(report.redacted_bodies, 1);
    }

    #[test]
    fn sanitized_archive_round_trip_removes_fixture_credentials() {
        let temp = tempdir().expect("temp directory");
        let work = temp.path().join("work");
        fs::create_dir_all(work.join("tracks")).expect("tracks directory");
        let manifest = serde_json::json!({
            "version": 1,
            "sessionId": "fixture",
            "label": "Fixture",
            "startedAt": 1,
            "duration": 2,
            "targetUrl": "https://test/?token=fixture-secret",
            "tracks": { "rrweb": true, "network": true, "console": false }
        })
        .to_string();
        fs::write(
            work.join("tracks/network.ndjson"),
            "{\"t\":1,\"data\":{\"url\":\"https://test/?token=fixture-secret\",\"requestHeaders\":{\"Authorization\":\"Bearer fixture-secret\"},\"requestBody\":\"fixture-secret\"}}\n",
        )
        .expect("network track");
        fs::write(
            work.join("tracks/rrweb.ndjson"),
            "{\"t\":1,\"data\":{\"text\":\"fixture-secret\"}}\n",
        )
        .expect("rrweb track");
        let source = temp.path().join("source.capu");
        write_session_archive(&work, &source, &manifest).expect("source archive");
        let destination = temp.path().join("shareable.capu");
        let options = RecordingSanitizeOptions {
            redact_urls: true,
            redact_bodies: true,
            redact_dom: true,
        };

        let report = sanitized_export(&source, &destination, &options).expect("sanitized export");
        let file = fs::File::open(destination).expect("open export");
        let mut archive = ZipArchive::new(file).expect("valid export");
        let mut contents = String::new();
        for index in 0..archive.len() {
            archive
                .by_index(index)
                .expect("archive entry")
                .read_to_string(&mut contents)
                .expect("read entry");
        }
        assert!(!contents.contains("fixture-secret"));
        assert!(report.excluded_tracks.contains(&"rrweb".to_string()));
        assert!(archive.by_name("tracks/rrweb.ndjson").is_err());
    }
}
