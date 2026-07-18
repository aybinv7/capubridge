use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AppErrorCategory {
    Validation,
    Cancelled,
    Timeout,
    Transport,
    Unavailable,
    Internal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Error)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub category: AppErrorCategory,
    pub code: String,
    pub message: String,
    pub retryable: bool,
    pub operation: String,
}

impl AppError {
    pub fn new(
        category: AppErrorCategory,
        code: impl Into<String>,
        message: impl Into<String>,
        operation: impl Into<String>,
    ) -> Self {
        Self {
            category,
            code: code.into(),
            message: message.into(),
            retryable: matches!(
                category,
                AppErrorCategory::Timeout
                    | AppErrorCategory::Transport
                    | AppErrorCategory::Unavailable
            ),
            operation: operation.into(),
        }
    }

    pub fn from_legacy(operation: &str, message: impl Into<String>) -> Self {
        let message = message.into();
        let normalized = message.to_ascii_lowercase();
        let (category, code) = if normalized.contains("session-invalid-response")
            || normalized.contains("internal adb error")
            || normalized.contains("panicked")
        {
            (AppErrorCategory::Internal, "APP_INTERNAL")
        } else if normalized.contains("cancel")
            || normalized.contains("interrupt")
            || normalized.contains("abort")
        {
            (AppErrorCategory::Cancelled, "APP_CANCELLED")
        } else if normalized.contains("timed out") || normalized.contains("timeout") {
            (AppErrorCategory::Timeout, "APP_TIMEOUT")
        } else if normalized.contains("offline")
            || normalized.contains("unavailable")
            || normalized.contains("disconnected")
            || normalized.contains("not connected")
            || normalized.contains("not running")
            || normalized.contains("device-not-found")
            || normalized.contains("device-offline")
        {
            (AppErrorCategory::Unavailable, "APP_UNAVAILABLE")
        } else if normalized.contains("transport")
            || normalized.contains("connection")
            || normalized.contains("socket")
            || normalized.contains("adb request")
            || normalized.contains("adb server")
            || normalized.contains("shell command failed")
            || normalized.contains("adb error")
        {
            (AppErrorCategory::Transport, "APP_TRANSPORT")
        } else if normalized.contains("invalid")
            || normalized.contains("unknown device")
            || normalized.contains("required")
            || normalized.contains("must be")
        {
            (AppErrorCategory::Validation, "APP_VALIDATION")
        } else {
            (AppErrorCategory::Internal, "APP_INTERNAL")
        };
        Self::new(category, code, message, operation)
    }
}

pub type AppResult<T> = Result<T, AppError>;

pub trait AppResultExt<T> {
    fn app_context(self, operation: &str) -> AppResult<T>;
}

impl<T> AppResultExt<T> for Result<T, String> {
    fn app_context(self, operation: &str) -> AppResult<T> {
        self.map_err(|error| AppError::from_legacy(operation, error))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_error_serializes_stable_contract() {
        let error = AppError::new(
            AppErrorCategory::Timeout,
            "SESSION_TIMEOUT",
            "Session request timed out",
            "session_refresh_targets",
        );
        assert_eq!(
            serde_json::to_value(error).expect("error should serialize"),
            serde_json::json!({
                "category": "timeout",
                "code": "SESSION_TIMEOUT",
                "message": "Session request timed out",
                "retryable": true,
                "operation": "session_refresh_targets"
            })
        );
    }

    #[test]
    fn legacy_disconnection_maps_to_unavailable() {
        let error = AppError::from_legacy("session_refresh_devices", "Device disconnected");
        assert_eq!(error.category, AppErrorCategory::Unavailable);
    }

    #[test]
    fn serialized_error_round_trips() {
        let expected = AppError::new(
            AppErrorCategory::Validation,
            "APP_VALIDATION",
            "Unknown device",
            "session_set_active_device",
        );
        let encoded = serde_json::to_string(&expected).expect("error should serialize");
        let decoded = serde_json::from_str::<AppError>(&encoded).expect("error should deserialize");
        assert_eq!(decoded, expected);
    }
}
