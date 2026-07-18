use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::session::types::{
    SessionDeviceSnapshot, SessionRegistrySnapshot, SessionTemperature, SessionTrackerStatus,
};

const SESSION_CACHE_SCHEMA_VERSION: u32 = 1;
const SESSION_CACHE_FILE_NAME: &str = "session-registry-v1.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedRegistryCache {
    schema_version: u32,
    devices: Vec<SessionDeviceSnapshot>,
    active_serial: Option<String>,
    updated_at: u64,
}

#[derive(Debug)]
pub struct SessionCacheStore {
    path: PathBuf,
}

impl SessionCacheStore {
    pub fn new(app: &AppHandle) -> Result<Arc<Self>, String> {
        let cache_dir = app
            .path()
            .app_cache_dir()
            .map_err(|error| format!("Failed to resolve app cache directory: {error}"))?;

        fs::create_dir_all(&cache_dir)
            .map_err(|error| format!("Failed to create app cache directory: {error}"))?;

        Ok(Arc::new(Self {
            path: cache_dir.join(SESSION_CACHE_FILE_NAME),
        }))
    }

    pub fn load_registry_snapshot(&self) -> Result<Option<SessionRegistrySnapshot>, String> {
        if !self.path.exists() {
            return Ok(None);
        }

        let raw = match fs::read_to_string(&self.path) {
            Ok(raw) => raw,
            Err(error) => {
                self.drop_cache_file();
                return Err(format!("Failed reading session cache: {error}"));
            }
        };

        let persisted = match serde_json::from_str::<PersistedRegistryCache>(&raw) {
            Ok(persisted) => persisted,
            Err(error) => {
                self.drop_cache_file();
                return Err(format!("Failed parsing session cache: {error}"));
            }
        };

        if persisted.schema_version != SESSION_CACHE_SCHEMA_VERSION {
            self.drop_cache_file();
            return Ok(None);
        }

        let active_serial = persisted
            .active_serial
            .filter(|serial| persisted.devices.iter().any(|device| device.serial == *serial));

        let devices = persisted
            .devices
            .into_iter()
            .map(|device| SessionDeviceSnapshot {
                status: "offline".to_string(),
                temperature: SessionTemperature::Cold,
                is_stale: true,
                health: None,
                ..device
            })
            .collect();

        Ok(Some(SessionRegistrySnapshot {
            devices,
            active_serial,
            tracker_status: SessionTrackerStatus::Stopped,
            revision: 0,
            last_error: None,
            updated_at: persisted.updated_at,
        }))
    }

    pub fn save_registry_snapshot(
        &self,
        snapshot: &SessionRegistrySnapshot,
    ) -> Result<(), String> {
        let payload = PersistedRegistryCache {
            schema_version: SESSION_CACHE_SCHEMA_VERSION,
            devices: snapshot.devices.clone(),
            active_serial: snapshot.active_serial.clone(),
            updated_at: snapshot.updated_at,
        };

        let encoded = serde_json::to_vec_pretty(&payload)
            .map_err(|error| format!("Failed encoding session cache: {error}"))?;

        fs::write(&self.path, encoded)
            .map_err(|error| format!("Failed writing session cache: {error}"))
    }

    fn drop_cache_file(&self) {
        let _ = fs::remove_file(&self.path);
    }
}
