use serde::Serialize;
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;
use zip::write::{SimpleFileOptions, ZipWriter};
use zip::ZipArchive;

const TRACK_NAMES: [&str; 5] = ["rrweb", "network", "console", "perf", "databases"];

pub(crate) fn sessions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sessions");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Validates a session id: must be non-empty, no path separators, no leading dot.
/// Returns the cleaned id or an error message.
pub(crate) fn validate_session_id(session_id: &str) -> Result<&str, String> {
    let trimmed = session_id.trim();
    if trimmed.is_empty() {
        return Err("session_id is empty — recording state is corrupted".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err(format!("Invalid session_id: {}", trimmed));
    }
    if trimmed.starts_with('.') {
        return Err(format!("Invalid session_id (leading dot): {}", trimmed));
    }
    Ok(trimmed)
}

fn validate_track_name(track: &str) -> Result<&str, String> {
    if TRACK_NAMES.contains(&track) {
        return Ok(track);
    }
    Err(format!("Unsupported recording track: {track}"))
}

fn validate_manifest_json(manifest_json: &str, session_id: &str) -> Result<(), String> {
    let manifest: serde_json::Value = serde_json::from_str(manifest_json)
        .map_err(|e| format!("Invalid recording manifest JSON: {e}"))?;
    let object = manifest
        .as_object()
        .ok_or_else(|| "Invalid recording manifest: expected an object".to_string())?;
    if object.get("version").and_then(serde_json::Value::as_u64) != Some(1) {
        return Err("Invalid recording manifest: version must be 1".to_string());
    }
    if object
        .get("sessionId")
        .and_then(serde_json::Value::as_str)
        != Some(session_id)
    {
        return Err("Invalid recording manifest: sessionId does not match recording".to_string());
    }
    if object
        .get("label")
        .and_then(serde_json::Value::as_str)
        .is_none()
        || object
            .get("startedAt")
            .and_then(serde_json::Value::as_u64)
            .is_none()
        || object
            .get("duration")
            .and_then(serde_json::Value::as_u64)
            .is_none()
        || !object
            .get("tracks")
            .is_some_and(serde_json::Value::is_object)
    {
        return Err("Invalid recording manifest: required fields are missing".to_string());
    }
    Ok(())
}

fn write_session_archive(
    work_dir: &std::path::Path,
    output_path: &std::path::Path,
    manifest_json: &str,
) -> Result<(), String> {
    let output = fs::File::create(output_path)
        .map_err(|e| format!("Failed to create recording archive: {e}"))?;
    let mut zip = ZipWriter::new(output);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("manifest.json", options)
        .map_err(|e| format!("Failed to create manifest archive entry: {e}"))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write recording manifest: {e}"))?;

    let tracks_dir = work_dir.join("tracks");
    if tracks_dir.exists() {
        for entry in
            fs::read_dir(&tracks_dir).map_err(|e| format!("Failed to read tracks dir: {e}"))?
        {
            let entry = entry.map_err(|e| format!("Failed to read track entry: {e}"))?;
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy();
            if !name.ends_with(".ndjson") {
                continue;
            }
            let content = fs::read(entry.path())
                .map_err(|e| format!("Failed to read track {name}: {e}"))?;
            zip.start_file(format!("tracks/{name}"), options)
                .map_err(|e| format!("Failed to create track archive entry {name}: {e}"))?;
            zip.write_all(&content)
                .map_err(|e| format!("Failed to write track {name}: {e}"))?;
        }
    }

    let databases_path = work_dir.join("databases.sqlite");
    if databases_path.exists() {
        let content = fs::read(&databases_path)
            .map_err(|e| format!("Failed to read database artifact: {e}"))?;
        zip.start_file("artifacts/databases.sqlite", options)
            .map_err(|e| format!("Failed to create database archive entry: {e}"))?;
        zip.write_all(&content)
            .map_err(|e| format!("Failed to write database artifact: {e}"))?;
    }

    let output = zip
        .finish()
        .map_err(|e| format!("Failed to finalize recording archive: {e}"))?;
    output
        .sync_all()
        .map_err(|e| format!("Failed to sync recording archive: {e}"))
}

pub(crate) fn session_work_dir(
    app: &tauri::AppHandle,
    session_id: &str,
) -> Result<PathBuf, String> {
    let id = validate_session_id(session_id)?;
    let dir = sessions_dir(app)?.join(format!("{}_work", id));
    Ok(dir)
}

/// Creates the working directory structure for a new recording session.
#[tauri::command]
pub async fn recording_session_start(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<(), String> {
    let work_dir = session_work_dir(&app, &session_id)?;
    if work_dir.exists() {
        fs::remove_dir_all(&work_dir)
            .map_err(|e| format!("Failed to reset session dir: {e}"))?;
    }
    let tracks_dir = work_dir.join("tracks");
    fs::create_dir_all(&tracks_dir).map_err(|e| format!("Failed to create session dir: {}", e))?;
    Ok(())
}

/// Appends a batch of NDJSON lines to a track file.
/// `ndjson_batch` is pre-formatted: each line is a JSON object, lines separated by '\n'.
#[tauri::command]
pub async fn recording_session_append(
    app: tauri::AppHandle,
    session_id: String,
    track: String,
    ndjson_batch: String,
) -> Result<(), String> {
    let track = validate_track_name(&track)?;
    let work_dir = session_work_dir(&app, &session_id)?;
    if !work_dir.is_dir() {
        return Err("Recording session is not active".to_string());
    }
    let track_file = work_dir
        .join("tracks")
        .join(format!("{}.ndjson", track));

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&track_file)
        .map_err(|e| format!("Failed to open track file: {}", e))?;

    // Ensure batch ends with newline
    let batch = if ndjson_batch.ends_with('\n') {
        ndjson_batch
    } else {
        format!("{}\n", ndjson_batch)
    };

    file.write_all(batch.as_bytes())
        .map_err(|e| format!("Failed to write batch: {}", e))?;

    Ok(())
}

/// Finalizes the session: writes manifest.json directly into zip, adds all track files,
/// removes the work directory, and returns the absolute path to the .capu file.
#[tauri::command]
pub async fn recording_session_stop(
    app: tauri::AppHandle,
    session_id: String,
    manifest_json: String,
) -> Result<String, String> {
    let validated_id = validate_session_id(&session_id)?.to_string();
    validate_manifest_json(&manifest_json, &validated_id)?;
    let work_dir = session_work_dir(&app, &validated_id)?;
    if !work_dir.is_dir() {
        return Err("Recording session work directory is missing".to_string());
    }
    let sessions_dir = sessions_dir(&app)?;
    let capu_path = sessions_dir.join(format!("{}.capu", validated_id));
    let partial_path = sessions_dir.join(format!("{}.capu.partial", validated_id));
    if capu_path.exists() {
        return Err("Recording archive already exists".to_string());
    }
    if partial_path.exists() {
        fs::remove_file(&partial_path)
            .map_err(|e| format!("Failed to remove stale partial archive: {e}"))?;
    }

    if let Err(error) = write_session_archive(&work_dir, &partial_path, &manifest_json) {
        let _ = fs::remove_file(&partial_path);
        return Err(error);
    }

    if let Err(error) = fs::rename(&partial_path, &capu_path) {
        let _ = fs::remove_file(&partial_path);
        return Err(format!("Failed to publish recording archive: {error}"));
    }

    if let Err(error) = fs::remove_dir_all(&work_dir) {
        log::warn!("Failed to clean finalized recording work directory: {error}");
    }

    Ok(capu_path.to_string_lossy().into_owned())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RustSessionListItem {
    pub session_id: String,
    pub label: String,
    pub started_at: u64,
    pub duration: u64,
    pub device_serial: Option<String>,
    pub target_url: Option<String>,
    pub file_path: String,
    pub file_size_bytes: u64,
}

/// Lists all .capu sessions from the app data directory.
/// Reads manifest.json from inside each zip without fully extracting.
#[tauri::command]
pub async fn recording_list_sessions(
    app: tauri::AppHandle,
) -> Result<Vec<RustSessionListItem>, String> {
    let sessions_dir = sessions_dir(&app)?;
    let mut items = Vec::new();

    let entries =
        fs::read_dir(&sessions_dir).map_err(|e| format!("Failed to read sessions dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("capu") {
            continue;
        }

        let file_size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        // Read manifest from inside the zip
        if let Ok(file) = fs::File::open(&path) {
            if let Ok(mut archive) = ZipArchive::new(file) {
                if let Ok(manifest_file) = archive.by_name("manifest.json") {
                    if let Ok(manifest) =
                        serde_json::from_reader::<_, serde_json::Value>(manifest_file)
                    {
                        let session_id = manifest["sessionId"]
                            .as_str()
                            .unwrap_or_default()
                            .to_string();
                        let label = manifest["label"].as_str().unwrap_or("").to_string();
                        let started_at = manifest["startedAt"].as_u64().unwrap_or(0);
                        let duration = manifest["duration"].as_u64().unwrap_or(0);
                        let device_serial = manifest["deviceSerial"].as_str().map(String::from);
                        let target_url = manifest["targetUrl"].as_str().map(String::from);

                        items.push(RustSessionListItem {
                            session_id,
                            label,
                            started_at,
                            duration,
                            device_serial,
                            target_url,
                            file_path: path.to_string_lossy().into_owned(),
                            file_size_bytes,
                        });
                    }
                }
            }
        }
    }

    // Sort by started_at descending (newest first)
    items.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(items)
}

/// Deletes a session .capu file by session ID.
#[tauri::command]
pub async fn recording_delete_session(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<(), String> {
    let session_id = validate_session_id(&session_id)?;
    let capu_path = sessions_dir(&app)?.join(format!("{}.capu", session_id));
    if capu_path.exists() {
        fs::remove_file(&capu_path).map_err(|e| format!("Failed to delete session: {}", e))?;
    }
    let partial_path = sessions_dir(&app)?.join(format!("{}.capu.partial", session_id));
    if partial_path.exists() {
        fs::remove_file(&partial_path)
            .map_err(|e| format!("Failed to delete partial session: {e}"))?;
    }
    let work_dir = session_work_dir(&app, &session_id)?;
    if work_dir.exists() {
        let _ = fs::remove_dir_all(&work_dir);
    }
    Ok(())
}

#[derive(Serialize)]
pub struct RustSessionContents {
    pub manifest_json: String,
    pub tracks: HashMap<String, String>,
    pub database_path: Option<String>,
}

/// Removes orphaned recording artifacts:
/// - Any file with name starting with `.` (e.g. malformed `.capu` files from old bugs)
/// - Any `*_work` directory whose corresponding `.capu` does not exist
///
/// Returns the number of items cleaned up.
#[tauri::command]
pub async fn recording_cleanup_orphans(app: tauri::AppHandle) -> Result<u32, String> {
    let dir = sessions_dir(&app)?;
    let mut cleaned: u32 = 0;

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(0),
    };

    // First pass: collect all known capu session IDs
    let mut known_capu_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "capu" && !stem.is_empty() {
            known_capu_ids.insert(stem.to_string());
        }
    }

    // Second pass: clean up
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if file_name.starts_with('.') || file_name.ends_with(".capu.partial") {
            let _ = if path.is_dir() {
                fs::remove_dir_all(&path)
            } else {
                fs::remove_file(&path)
            };
            cleaned += 1;
            continue;
        }

        // Remove orphaned _work directories
        if path.is_dir() {
            if let Some(stripped) = file_name.strip_suffix("_work") {
                if stripped.is_empty() || !known_capu_ids.contains(stripped) {
                    let _ = fs::remove_dir_all(&path);
                    cleaned += 1;
                }
            }
        }
    }

    Ok(cleaned)
}

/// Reads a .capu file and returns the manifest + all track NDJSON as strings.
/// The frontend is responsible for parsing NDJSON into typed objects.
#[tauri::command]
pub async fn recording_read_session(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<RustSessionContents, String> {
    let file =
        std::fs::File::open(&file_path).map_err(|e| format!("Cannot open session file: {}", e))?;

    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid .capu file: {}", e))?;

    let manifest_json = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| "manifest.json not found in .capu file".to_string())?;
        let mut content = String::new();
        std::io::Read::read_to_string(&mut manifest_file, &mut content)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        content
    };

    let manifest: serde_json::Value = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("Invalid recording manifest JSON: {e}"))?;
    let manifest_id = manifest["sessionId"]
        .as_str()
        .ok_or_else(|| "Invalid recording manifest: sessionId is missing".to_string())?;
    validate_session_id(manifest_id)?;
    validate_manifest_json(&manifest_json, manifest_id)?;

    let mut tracks = HashMap::new();
    for track in &TRACK_NAMES {
        let zip_path = format!("tracks/{}.ndjson", track);
        match archive.by_name(&zip_path) {
            Ok(mut track_file) => {
                let mut content = String::new();
                std::io::Read::read_to_string(&mut track_file, &mut content)
                    .map_err(|e| format!("Corrupt {track} track: {e}"))?;
                tracks.insert(track.to_string(), content);
            }
            Err(zip::result::ZipError::FileNotFound) => {}
            Err(error) => return Err(format!("Corrupt {track} track entry: {error}")),
        }
    }

    let database_path = match archive.by_name("artifacts/databases.sqlite") {
        Ok(mut database_file) => {
            let cache_dir = sessions_dir(&app)?.join("read_cache");
            fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
            let stem = PathBuf::from(&file_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("session")
                .chars()
                .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
                .collect::<String>();
            let out_path = cache_dir.join(format!("{}_databases.sqlite", stem));
            let mut out = fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create database cache: {}", e))?;
            std::io::copy(&mut database_file, &mut out)
                .map_err(|e| format!("Failed to extract database cache: {}", e))?;
            Some(out_path.to_string_lossy().into_owned())
        }
        Err(zip::result::ZipError::FileNotFound) => None,
        Err(error) => return Err(format!("Corrupt database artifact entry: {error}")),
    };

    Ok(RustSessionContents {
        manifest_json,
        tracks,
        database_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use tempfile::tempdir;

    fn manifest(session_id: &str) -> String {
        serde_json::json!({
            "version": 1,
            "sessionId": session_id,
            "label": "Test",
            "startedAt": 1,
            "duration": 2,
            "deviceSerial": null,
            "targetUrl": null,
            "appPackage": null,
            "tracks": {
                "rrweb": false,
                "network": true,
                "console": false
            }
        })
        .to_string()
    }

    #[test]
    fn rejects_unknown_tracks_and_mismatched_manifests() {
        assert!(validate_track_name("../escape").is_err());
        assert!(validate_track_name("network").is_ok());
        assert!(validate_manifest_json(&manifest("one"), "two").is_err());
        assert!(validate_manifest_json("{}", "one").is_err());
    }

    #[test]
    fn writes_complete_archive_to_requested_path() {
        let temp = tempdir().expect("temp directory");
        let work_dir = temp.path().join("work");
        let tracks_dir = work_dir.join("tracks");
        fs::create_dir_all(&tracks_dir).expect("tracks directory");
        fs::write(tracks_dir.join("network.ndjson"), "{\"t\":0,\"data\":{}}\n")
            .expect("track write");
        let output = temp.path().join("session.capu.partial");

        write_session_archive(&work_dir, &output, &manifest("session")).expect("archive write");

        let file = fs::File::open(output).expect("archive open");
        let mut archive = ZipArchive::new(file).expect("valid archive");
        let mut track = String::new();
        archive
            .by_name("tracks/network.ndjson")
            .expect("network track")
            .read_to_string(&mut track)
            .expect("track read");
        assert_eq!(track, "{\"t\":0,\"data\":{}}\n");
    }
}
