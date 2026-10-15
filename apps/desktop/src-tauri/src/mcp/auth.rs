//! Localhost authentication and named MCP principals.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const PRINCIPALS_FILE: &str = "mcp-principals.json";
const PRINCIPALS_SCHEMA_VERSION: u8 = 1;
const LEGACY_PRINCIPAL_ID: &str = "legacy-shared";
const LAST_USED_PERSIST_INTERVAL_MS: u64 = 60_000;

/// The authorization scopes supported by the embedded MCP server.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum McpCapability {
    Read,
    Execute,
    Authorize,
    Administer,
}

impl McpCapability {
    pub fn label(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Execute => "execute",
            Self::Authorize => "authorize",
            Self::Administer => "administer",
        }
    }
}

/// Parse capability labels received from the local settings UI.
pub fn parse_capabilities(values: &[String]) -> Result<BTreeSet<McpCapability>, String> {
    let mut capabilities = BTreeSet::new();
    for value in values {
        let capability = match value.trim().to_ascii_lowercase().as_str() {
            "read" => McpCapability::Read,
            "execute" => McpCapability::Execute,
            "authorize" => McpCapability::Authorize,
            "administer" => McpCapability::Administer,
            other => return Err(format!("Unknown MCP capability '{other}'")),
        };
        capabilities.insert(capability);
    }
    if capabilities.is_empty() {
        return Err("At least one MCP capability is required".to_string());
    }
    Ok(capabilities)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedPrincipal {
    id: String,
    name: String,
    token: String,
    capabilities: BTreeSet<McpCapability>,
    created_at: u64,
    #[serde(default)]
    last_used_at: Option<u64>,
    #[serde(default)]
    revoked_at: Option<u64>,
    #[serde(default)]
    legacy: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedPrincipalStore {
    schema_version: u8,
    principals: BTreeMap<String, PersistedPrincipal>,
}

/// Public principal metadata. The bearer token is never included here.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpPrincipalSummary {
    pub id: String,
    pub name: String,
    pub capabilities: Vec<McpCapability>,
    pub created_at: u64,
    pub last_used_at: Option<u64>,
    pub revoked_at: Option<u64>,
    pub legacy: bool,
    pub token_hint: String,
}

/// A newly created or rotated principal. The token is returned only for this
/// one response so the caller can copy it into its client configuration.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedMcpPrincipal {
    pub principal: McpPrincipalSummary,
    pub token: String,
}

/// Authenticated identity attached to an MCP request context.
#[derive(Debug, Clone)]
pub struct AuthenticatedPrincipal {
    pub id: String,
    pub name: String,
    capabilities: BTreeSet<McpCapability>,
}

impl AuthenticatedPrincipal {
    /// Return whether this identity can perform the requested operation.
    pub fn allows(&self, required: McpCapability) -> bool {
        self.capabilities.contains(&McpCapability::Administer)
            || self.capabilities.contains(&required)
    }

    #[cfg(test)]
    pub(crate) fn test_identity() -> Self {
        Self {
            id: "principal-test".to_string(),
            name: "Test client".to_string(),
            capabilities: BTreeSet::from([McpCapability::Read, McpCapability::Execute]),
        }
    }

}

/// Thread-safe persistent registry of individually revocable MCP principals.
#[derive(Clone)]
pub struct PrincipalRegistry {
    path: PathBuf,
    state: Arc<Mutex<PersistedPrincipalStore>>,
}

impl PrincipalRegistry {
    /// Load the registry and migrate the legacy single-token configuration when
    /// it exists.
    pub fn load_at(
        dir: &Path,
        legacy_token: Option<&str>,
        legacy_allow_mutations: bool,
    ) -> Result<Arc<Self>, String> {
        fs::create_dir_all(dir)
            .map_err(|error| format!("Failed to create MCP principal directory: {error}"))?;
        let path = dir.join(PRINCIPALS_FILE);
        let mut store = if path.exists() {
            let raw = fs::read_to_string(&path)
                .map_err(|error| format!("Failed reading MCP principals: {error}"))?;
            serde_json::from_str::<PersistedPrincipalStore>(&raw)
                .map_err(|error| format!("Failed parsing MCP principals: {error}"))?
        } else {
            PersistedPrincipalStore::default()
        };
        store.schema_version = PRINCIPALS_SCHEMA_VERSION;

        let legacy_token = legacy_token.filter(|token| !token.is_empty());
        let migrated = if let Some(token) = legacy_token {
            if !store.principals.contains_key(LEGACY_PRINCIPAL_ID) {
                store.principals.insert(
                    LEGACY_PRINCIPAL_ID.to_string(),
                    PersistedPrincipal {
                        id: LEGACY_PRINCIPAL_ID.to_string(),
                        name: "Legacy shared token".to_string(),
                        token: token.to_string(),
                        capabilities: legacy_capabilities(legacy_allow_mutations),
                        created_at: now_millis(),
                        last_used_at: None,
                        revoked_at: None,
                        legacy: true,
                    },
                );
                true
            } else {
                false
            }
        } else {
            false
        };

        let registry = Arc::new(Self {
            path,
            state: Arc::new(Mutex::new(store)),
        });
        if migrated {
            registry.persist()?;
        }
        Ok(registry)
    }

    /// Load the registry from the app config directory.
    pub fn load(
        app: &AppHandle,
        legacy_token: Option<&str>,
        legacy_allow_mutations: bool,
    ) -> Result<Arc<Self>, String> {
        let dir = app
            .path()
            .app_config_dir()
            .map_err(|error| format!("Failed to resolve MCP config directory: {error}"))?;
        Self::load_at(&dir, legacy_token, legacy_allow_mutations)
    }

    /// Return public metadata for all principals, including revoked records.
    pub fn list(&self) -> Vec<McpPrincipalSummary> {
        self.state
            .lock()
            .principals
            .values()
            .map(summary)
            .collect()
    }

    /// Create a principal with a fresh token.
    pub fn create(
        &self,
        name: String,
        capabilities: BTreeSet<McpCapability>,
    ) -> Result<CreatedMcpPrincipal, String> {
        let name = name.trim().to_string();
        if name.is_empty() || name.len() > 80 {
            return Err("Principal name must be between 1 and 80 characters".to_string());
        }
        if capabilities.is_empty() {
            return Err("At least one MCP capability is required".to_string());
        }
        let token = generate_token();
        let id = format!("principal-{}", Uuid::new_v4().simple());
        let principal = PersistedPrincipal {
            id: id.clone(),
            name,
            token: token.clone(),
            capabilities,
            created_at: now_millis(),
            last_used_at: None,
            revoked_at: None,
            legacy: false,
        };
        let public = summary(&principal);
        self.state.lock().principals.insert(id, principal);
        self.persist()?;
        Ok(CreatedMcpPrincipal {
            principal: public,
            token,
        })
    }

    /// Revoke one principal without affecting any other credential.
    pub fn revoke(&self, id: &str) -> Result<(), String> {
        let mut state = self.state.lock();
        let principal = state
            .principals
            .get_mut(id)
            .ok_or_else(|| format!("Unknown MCP principal '{id}'"))?;
        if principal.revoked_at.is_none() {
            principal.revoked_at = Some(now_millis());
            drop(state);
            self.persist()?;
        }
        Ok(())
    }

    /// Rotate the legacy principal token while preserving its stable id.
    pub fn rotate_legacy(&self, allow_mutations: bool) -> Result<CreatedMcpPrincipal, String> {
        let mut state = self.state.lock();
        let principal = state
            .principals
            .get_mut(LEGACY_PRINCIPAL_ID)
            .ok_or_else(|| "Legacy MCP principal is not configured".to_string())?;
        let token = generate_token();
        principal.token = token.clone();
        principal.capabilities = legacy_capabilities(allow_mutations);
        principal.revoked_at = None;
        principal.last_used_at = None;
        let public = summary(principal);
        drop(state);
        self.persist()?;
        Ok(CreatedMcpPrincipal {
            principal: public,
            token,
        })
    }

    /// Update the legacy principal's execute scope for compatibility with the
    /// previous global mutation toggle.
    pub fn set_legacy_mutations(&self, allow: bool) -> Result<(), String> {
        let mut state = self.state.lock();
        if let Some(principal) = state.principals.get_mut(LEGACY_PRINCIPAL_ID) {
            principal.capabilities = legacy_capabilities(allow);
            drop(state);
            self.persist()?;
        }
        Ok(())
    }

    /// Authenticate a bearer token and update its last-used metadata.
    pub fn authenticate(&self, presented: &str) -> Option<AuthenticatedPrincipal> {
        let mut state = self.state.lock();
        let id = state
            .principals
            .iter()
            .find(|(_, principal)| {
                principal.revoked_at.is_none() && token_matches(&principal.token, presented)
            })
            .map(|(id, _)| id.clone())?;
        let now = now_millis();
        let principal = state.principals.get_mut(&id)?;
        let should_persist = principal
            .last_used_at
            .map(|last| now.saturating_sub(last) >= LAST_USED_PERSIST_INTERVAL_MS)
            .unwrap_or(true);
        principal.last_used_at = Some(now);
        let identity = AuthenticatedPrincipal {
            id: principal.id.clone(),
            name: principal.name.clone(),
            capabilities: principal.capabilities.clone(),
        };
        drop(state);
        if should_persist {
            if let Err(error) = self.persist() {
                log::warn!("[mcp-auth] failed to persist principal last-used time: {error}");
            }
        }
        Some(identity)
    }

    fn persist(&self) -> Result<(), String> {
        let state = self.state.lock().clone();
        let encoded = serde_json::to_vec_pretty(&state)
            .map_err(|error| format!("Failed encoding MCP principals: {error}"))?;
        let temporary = self.path.with_extension("json.tmp");
        super::config::secure_write(&temporary, &encoded)?;
        fs::rename(&temporary, &self.path)
            .map_err(|error| format!("Failed replacing MCP principals: {error}"))
    }
}

fn legacy_capabilities(allow_mutations: bool) -> BTreeSet<McpCapability> {
    let mut capabilities = BTreeSet::from([McpCapability::Read]);
    if allow_mutations {
        capabilities.insert(McpCapability::Execute);
        capabilities.insert(McpCapability::Authorize);
        capabilities.insert(McpCapability::Administer);
    }
    capabilities
}

fn summary(principal: &PersistedPrincipal) -> McpPrincipalSummary {
    McpPrincipalSummary {
        id: principal.id.clone(),
        name: principal.name.clone(),
        capabilities: principal.capabilities.iter().copied().collect(),
        created_at: principal.created_at,
        last_used_at: principal.last_used_at,
        revoked_at: principal.revoked_at,
        legacy: principal.legacy,
        token_hint: token_hint(&principal.token),
    }
}

fn token_hint(token: &str) -> String {
    let suffix = token.chars().rev().take(6).collect::<String>();
    suffix.chars().rev().collect()
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// Generate a fresh 256-bit token rendered as 64 lowercase hex characters.
pub fn generate_token() -> String {
    let first = Uuid::new_v4().simple().to_string();
    let second = Uuid::new_v4().simple().to_string();
    format!("{first}{second}")
}

/// Extract the token from an `Authorization: Bearer <token>` header value.
pub fn parse_bearer(header: &str) -> Option<&str> {
    header.strip_prefix("Bearer ").map(str::trim)
}

/// Length-checked, constant-time-ish comparison of two bearer tokens.
pub fn token_matches(expected: &str, presented: &str) -> bool {
    let expected = expected.as_bytes();
    let presented = presented.as_bytes();
    if expected.len() != presented.len() {
        return false;
    }
    let mut diff = 0u8;
    for (left, right) in expected.iter().zip(presented.iter()) {
        diff |= left ^ right;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_tokens_are_64_hex_chars_and_unique() {
        let first = generate_token();
        let second = generate_token();
        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }

    #[test]
    fn parse_bearer_extracts_token() {
        assert_eq!(parse_bearer("Bearer abc123"), Some("abc123"));
        assert_eq!(parse_bearer("Basic abc123"), None);
        assert_eq!(parse_bearer("abc123"), None);
    }

    #[test]
    fn token_matches_only_the_exact_token() {
        let token = generate_token();
        assert!(token_matches(&token, &token));
        assert!(!token_matches(&token, ""));
        assert!(!token_matches(&token, &format!("{token}x")));
        assert!(!token_matches(&token, &token.replace('a', "b")));
    }

    #[test]
    fn legacy_token_migrates_once_and_scopes_mutations() {
        let dir = tempfile::tempdir().expect("tempdir");
        let token = generate_token();
        let registry = PrincipalRegistry::load_at(dir.path(), Some(&token), false).expect("load");
        let principals = registry.list();
        assert_eq!(principals.len(), 1);
        assert_eq!(principals[0].id, LEGACY_PRINCIPAL_ID);
        assert_eq!(principals[0].capabilities, vec![McpCapability::Read]);
        assert!(registry.authenticate(&token).is_some());

        let reloaded = PrincipalRegistry::load_at(dir.path(), Some(&token), false).expect("reload");
        assert!(reloaded.authenticate(&token).is_some());
    }

    #[test]
    fn principals_are_independently_revocable_and_tokens_are_redacted() {
        let dir = tempfile::tempdir().expect("tempdir");
        let registry = PrincipalRegistry::load_at(dir.path(), None, false).expect("load");
        let first = registry
            .create(
                "Claude Desktop".to_string(),
                BTreeSet::from([McpCapability::Read]),
            )
            .expect("create first");
        let second = registry
            .create(
                "ChatGPT Desktop".to_string(),
                BTreeSet::from([McpCapability::Read, McpCapability::Execute]),
            )
            .expect("create second");
        assert!(!serde_json::to_string(&registry.list()).expect("serialize").contains(&first.token));
        registry.revoke(&first.principal.id).expect("revoke");
        assert!(registry.authenticate(&first.token).is_none());
        assert!(registry.authenticate(&second.token).is_some());
    }

    #[test]
    fn capability_parser_rejects_unknown_and_empty_scopes() {
        assert!(parse_capabilities(&[]).is_err());
        assert!(parse_capabilities(&["unknown".to_string()]).is_err());
        let parsed = parse_capabilities(&["read".to_string(), "execute".to_string()]).expect("scopes");
        assert!(parsed.contains(&McpCapability::Execute));
    }
}
