use std::sync::LazyLock;

use tokio::sync::{Semaphore, SemaphorePermit};

/// Most app icon extractions allowed to run against ADB at the same time.
const ICON_EXTRACTION_LIMIT: usize = 3;

static ICON_PERMITS: LazyLock<Semaphore> = LazyLock::new(|| Semaphore::new(ICON_EXTRACTION_LIMIT));

/// Waits for one of the icon extraction slots. Hold the permit until the
/// extraction finishes so a long app list cannot flood the ADB server.
pub(crate) async fn acquire_icon_permit() -> Result<SemaphorePermit<'static>, String> {
    ICON_PERMITS
        .acquire()
        .await
        .map_err(|error| format!("Icon extraction gate closed: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gate_admits_at_most_the_limit() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .build()
            .expect("runtime");
        runtime.block_on(async {
            let mut held = Vec::new();
            for _ in 0..ICON_EXTRACTION_LIMIT {
                held.push(acquire_icon_permit().await.expect("permit"));
            }
            assert_eq!(ICON_PERMITS.available_permits(), 0);
            assert!(ICON_PERMITS.try_acquire().is_err());
            held.pop();
            assert!(ICON_PERMITS.try_acquire().is_ok());
        });
    }
}
