//! Hedged requests for side-effect-free remote calls.
//!
//! Measured against OpenRouter's Jev endpoint, roughly one call in three had a
//! tail above nine seconds, including a response whose body stalled nine
//! seconds after its first byte and one that never answered at all. A timeout
//! alone only converts that stall into a slow failure. A hedge fires an
//! identical second request once the first has run past the normal band and
//! takes whichever completes first.
//!
//! Only valid for calls with no side effects: both legs may reach the server.

use std::future::Future;
use std::time::Duration;

/// Whether a failed attempt is worth racing again. A permanent failure (bad
/// request, bad credentials) would fail identically on a second leg, so it is
/// returned at once instead of doubling the wait.
pub trait Transience {
    fn is_transient(&self) -> bool;
}

/// Runs `attempt`, hedging with one identical attempt after `hedge_after`, and
/// gives up at `deadline`. An early transient failure starts the second leg
/// immediately rather than waiting for the hedge timer.
///
/// `attempt` is called at most twice. Each call must return a future that owns
/// its inputs, so the two legs never share mutable state.
pub async fn hedged<T, E, F, Fut, D>(
    attempt: F,
    hedge_after: Duration,
    deadline: Duration,
    timed_out: D,
) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: Transience,
    D: Fn() -> E,
{
    let deadline_timer = tokio::time::sleep(deadline);
    tokio::pin!(deadline_timer);
    let hedge_timer = tokio::time::sleep(hedge_after);
    tokio::pin!(hedge_timer);
    let first = attempt();
    tokio::pin!(first);

    let mut first_done = false;
    let mut last_error: Option<E> = None;
    tokio::select! {
        result = &mut first => {
            first_done = true;
            match result {
                Ok(value) => return Ok(value),
                Err(error) if !error.is_transient() => return Err(error),
                Err(error) => last_error = Some(error),
            }
        }
        _ = &mut hedge_timer => {}
        _ = &mut deadline_timer => return Err(timed_out()),
    }

    let second = attempt();
    tokio::pin!(second);
    let mut second_done = false;
    loop {
        if first_done && second_done {
            return Err(last_error.unwrap_or_else(&timed_out));
        }
        tokio::select! {
            result = &mut first, if !first_done => {
                first_done = true;
                match result {
                    Ok(value) => return Ok(value),
                    Err(error) if !error.is_transient() => return Err(error),
                    Err(error) => last_error = Some(error),
                }
            }
            result = &mut second, if !second_done => {
                second_done = true;
                match result {
                    Ok(value) => return Ok(value),
                    Err(error) if !error.is_transient() => return Err(error),
                    Err(error) => last_error = Some(error),
                }
            }
            _ = &mut deadline_timer => return Err(timed_out()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::time::Instant;

    #[derive(Debug, PartialEq)]
    enum TestError {
        Permanent,
        Transient,
        TimedOut,
    }

    impl Transience for TestError {
        fn is_transient(&self) -> bool {
            matches!(self, TestError::Transient)
        }
    }

    /// One scripted leg: how long it takes, then what it returns.
    #[derive(Clone, Copy)]
    enum Leg {
        Ok(u64, u32),
        Fail(u64, bool),
    }

    fn scripted(
        legs: Vec<Leg>,
    ) -> (
        Arc<AtomicUsize>,
        impl Fn() -> std::pin::Pin<Box<dyn Future<Output = Result<u32, TestError>> + Send>>,
    ) {
        let calls = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&calls);
        let attempt = move || {
            let index = counter.fetch_add(1, Ordering::SeqCst);
            let leg = legs[index.min(legs.len() - 1)];
            Box::pin(async move {
                match leg {
                    Leg::Ok(ms, value) => {
                        tokio::time::sleep(Duration::from_millis(ms)).await;
                        Ok(value)
                    }
                    Leg::Fail(ms, transient) => {
                        tokio::time::sleep(Duration::from_millis(ms)).await;
                        Err(if transient {
                            TestError::Transient
                        } else {
                            TestError::Permanent
                        })
                    }
                }
            }) as std::pin::Pin<Box<dyn Future<Output = Result<u32, TestError>> + Send>>
        };
        (calls, attempt)
    }

    const HEDGE: Duration = Duration::from_millis(40);
    const DEADLINE: Duration = Duration::from_millis(400);

    #[tokio::test]
    async fn a_fast_first_leg_never_starts_a_second() {
        let (calls, attempt) = scripted(vec![Leg::Ok(5, 1)]);
        let result = hedged(attempt, HEDGE, DEADLINE, || TestError::TimedOut).await;
        assert_eq!(result, Ok(1));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn a_stalled_first_leg_is_beaten_by_the_hedge() {
        let (calls, attempt) = scripted(vec![Leg::Ok(300, 1), Leg::Ok(10, 2)]);
        let started = Instant::now();
        let result = hedged(attempt, HEDGE, DEADLINE, || TestError::TimedOut).await;
        assert_eq!(result, Ok(2));
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        assert!(started.elapsed() < Duration::from_millis(200));
    }

    #[tokio::test]
    async fn a_permanent_failure_returns_at_once_without_hedging() {
        let (calls, attempt) = scripted(vec![Leg::Fail(5, false), Leg::Ok(5, 2)]);
        let result = hedged(attempt, HEDGE, DEADLINE, || TestError::TimedOut).await;
        assert_eq!(result, Err(TestError::Permanent));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn an_early_transient_failure_retries_without_waiting_for_the_hedge_timer() {
        let (calls, attempt) = scripted(vec![Leg::Fail(1, true), Leg::Ok(1, 2)]);
        let started = Instant::now();
        let result = hedged(attempt, Duration::from_millis(300), DEADLINE, || {
            TestError::TimedOut
        })
        .await;
        assert_eq!(result, Ok(2));
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        assert!(started.elapsed() < Duration::from_millis(200));
    }

    #[tokio::test]
    async fn two_stalled_legs_end_at_the_deadline() {
        let (_, attempt) = scripted(vec![Leg::Ok(5_000, 1), Leg::Ok(5_000, 2)]);
        let started = Instant::now();
        let result = hedged(attempt, HEDGE, DEADLINE, || TestError::TimedOut).await;
        assert_eq!(result, Err(TestError::TimedOut));
        assert!(started.elapsed() < Duration::from_millis(1_000));
    }

    #[tokio::test]
    async fn two_transient_failures_report_the_failure_not_a_timeout() {
        let (calls, attempt) = scripted(vec![Leg::Fail(1, true), Leg::Fail(1, true)]);
        let result = hedged(attempt, HEDGE, DEADLINE, || TestError::TimedOut).await;
        assert_eq!(result, Err(TestError::Transient));
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }
}
