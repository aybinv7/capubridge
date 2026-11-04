/// Runs blocking work (ADB I/O, process waits, file and SQLite access) on
/// Tauri's blocking thread pool so neither the main event loop nor the async
/// workers stall. A panicking or cancelled task surfaces as an `Err(String)`;
/// callers flatten it into their own result with `?` or `app_context`.
pub async fn run_blocking<T, F>(task: F) -> Result<T, String>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("Blocking task failed: {error}"))
}
