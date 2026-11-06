use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::commands::adb::adb_shell_command_inner;
use crate::commands::logcat::parse::parse_epoch_ms;

/// The device clock relative to the host clock, measured over adb.
/// `host = device - offset_ms`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClockSample {
    pub offset_ms: i64,
    pub rtt_ms: u64,
    pub measured_at_ms: i64,
}

/// Host wall clock in epoch milliseconds.
pub(crate) fn host_now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

/// Reads the device's epoch time from `echo $EPOCHREALTIME` (mksh, microseconds)
/// or from `date +%s` (seconds), whichever the shell printed.
pub(crate) fn parse_device_clock(output: &str) -> Option<i64> {
    output
        .split_whitespace()
        .find_map(parse_epoch_ms)
        .filter(|ms| *ms > 0)
}

/// Builds a sample from a round trip: the device read its clock somewhere
/// between `sent_at` and `received_at`, so the midpoint is the best guess.
pub(crate) fn sample_from(sent_at: i64, received_at: i64, device_ms: i64) -> ClockSample {
    let midpoint = sent_at + (received_at - sent_at) / 2;
    ClockSample {
        offset_ms: device_ms - midpoint,
        rtt_ms: (received_at - sent_at).max(0) as u64,
        measured_at_ms: received_at,
    }
}

/// Measures the device/host clock offset with one shell round trip.
pub(crate) fn measure_clock(serial: &str) -> Result<ClockSample, String> {
    let sent_at = host_now_ms();
    let output = adb_shell_command_inner(serial, "echo $EPOCHREALTIME; date +%s")?;
    let received_at = host_now_ms();
    let device_ms = parse_device_clock(&output)
        .ok_or_else(|| format!("Could not read the device clock from {output:?}"))?;
    Ok(sample_from(sent_at, received_at, device_ms))
}

/// Where the last delivered line was: its device time and how many physical
/// lines at that exact millisecond were already delivered.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct LogcatCursor {
    pub ts_ms: i64,
    pub seen_at_ts: u32,
}

impl LogcatCursor {
    pub fn advance(cursor: Option<Self>, ts_ms: i64) -> Self {
        match cursor {
            Some(current) if current.ts_ms == ts_ms => Self {
                ts_ms,
                seen_at_ts: current.seen_at_ts + 1,
            },
            _ => Self {
                ts_ms,
                seen_at_ts: 1,
            },
        }
    }
}

/// How a (re)connection asks logcat where to start.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ResumeFrom {
    /// The last N lines, for a first start.
    Tail(u32),
    /// Every line at or after `ts_ms`; the first `skip` lines at exactly
    /// `ts_ms` were already delivered.
    Since { ts_ms: i64, skip: u32 },
}

impl ResumeFrom {
    /// The `-T` argument for logcat.
    pub fn argument(&self) -> String {
        match self {
            Self::Tail(count) => count.to_string(),
            Self::Since { ts_ms, .. } => {
                format!("{}.{:03}", ts_ms.div_euclid(1000), ts_ms.rem_euclid(1000))
            }
        }
    }
}

/// The plan for a (re)connection and whether the device clock went back.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ResumePlan {
    pub from: ResumeFrom,
    pub clock_went_back: bool,
}

/// Lines a first start replays from the device's buffer.
pub(crate) const INITIAL_TAIL_LINES: u32 = 256;

/// Decides where a reconnection starts. Normally it resumes at the cursor so
/// nothing is lost or repeated. When the device clock is now behind the cursor
/// (snapshot restore, NTP or manual change), `-T cursor` would print nothing
/// until the clock caught up, so it starts from where the device clock was
/// when the stream dropped instead, and says so.
pub(crate) fn resume_plan(
    cursor: Option<LogcatCursor>,
    device_now_ms: Option<i64>,
    gap_ms: i64,
) -> ResumePlan {
    let Some(cursor) = cursor else {
        return ResumePlan {
            from: ResumeFrom::Tail(INITIAL_TAIL_LINES),
            clock_went_back: false,
        };
    };
    match device_now_ms {
        Some(now) if now < cursor.ts_ms => ResumePlan {
            from: ResumeFrom::Since {
                ts_ms: (now - gap_ms.max(0)).max(0),
                skip: 0,
            },
            clock_went_back: true,
        },
        _ => ResumePlan {
            from: ResumeFrom::Since {
                ts_ms: cursor.ts_ms,
                skip: cursor.seen_at_ts,
            },
            clock_went_back: false,
        },
    }
}

/// Drops the lines a resumed stream repeats: the first `skip` lines stamped
/// exactly at the cursor. Content is never compared, so two identical lines in
/// the same millisecond both survive.
#[derive(Debug, Clone, Copy)]
pub(crate) struct ResumeFilter {
    ts_ms: i64,
    remaining: u32,
}

impl ResumeFilter {
    pub fn new(plan: ResumeFrom) -> Self {
        match plan {
            ResumeFrom::Since { ts_ms, skip } => Self {
                ts_ms,
                remaining: skip,
            },
            ResumeFrom::Tail(_) => Self {
                ts_ms: 0,
                remaining: 0,
            },
        }
    }

    /// Whether the physical line stamped `ts_ms` was already delivered.
    pub fn is_repeat(&mut self, ts_ms: i64) -> bool {
        if self.remaining == 0 {
            return false;
        }
        if ts_ms == self.ts_ms {
            self.remaining -= 1;
            return true;
        }
        self.remaining = 0;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_device_clock_from_either_shell_answer() {
        assert_eq!(
            parse_device_clock("1730000000.123456\n1730000000\n"),
            Some(1_730_000_000_123)
        );
        assert_eq!(
            parse_device_clock("\n1730000001\n"),
            Some(1_730_000_001_000)
        );
        assert_eq!(parse_device_clock("sh: date: not found"), None);
    }

    #[test]
    fn the_offset_uses_the_midpoint_of_the_round_trip() {
        let sample = sample_from(1_000, 1_040, 6_020);
        assert_eq!(sample.offset_ms, 5_000);
        assert_eq!(sample.rtt_ms, 40);
        assert_eq!(sample.measured_at_ms, 1_040);
    }

    #[test]
    fn a_device_behind_the_host_has_a_negative_offset() {
        assert_eq!(sample_from(10_000, 10_010, 7_005).offset_ms, -3_000);
    }

    #[test]
    fn the_cursor_counts_lines_within_one_millisecond() {
        let first = LogcatCursor::advance(None, 5);
        let second = LogcatCursor::advance(Some(first), 5);
        let third = LogcatCursor::advance(Some(second), 6);
        assert_eq!(second.seen_at_ts, 2);
        assert_eq!(
            third,
            LogcatCursor {
                ts_ms: 6,
                seen_at_ts: 1
            }
        );
    }

    #[test]
    fn a_first_start_replays_the_tail() {
        let plan = resume_plan(None, Some(1_000), 0);
        assert_eq!(plan.from, ResumeFrom::Tail(INITIAL_TAIL_LINES));
        assert_eq!(plan.from.argument(), "256");
    }

    #[test]
    fn a_reconnect_resumes_at_the_cursor_and_skips_what_was_seen() {
        let cursor = LogcatCursor {
            ts_ms: 1_730_000_000_120,
            seen_at_ts: 2,
        };
        let plan = resume_plan(Some(cursor), Some(1_730_000_005_000), 4_000);
        assert!(!plan.clock_went_back);
        assert_eq!(plan.from.argument(), "1730000000.120");

        let mut filter = ResumeFilter::new(plan.from);
        assert!(filter.is_repeat(1_730_000_000_120));
        assert!(filter.is_repeat(1_730_000_000_120));
        assert!(!filter.is_repeat(1_730_000_000_120));
        assert!(!filter.is_repeat(1_730_000_000_121));
    }

    #[test]
    fn the_filter_stops_skipping_once_time_moves_on() {
        let mut filter = ResumeFilter::new(ResumeFrom::Since { ts_ms: 10, skip: 3 });
        assert!(filter.is_repeat(10));
        assert!(!filter.is_repeat(11));
        assert!(!filter.is_repeat(10));
    }

    #[test]
    fn a_clock_that_went_back_restarts_from_the_device_clock() {
        let cursor = LogcatCursor {
            ts_ms: 1_730_000_600_000,
            seen_at_ts: 1,
        };
        let plan = resume_plan(Some(cursor), Some(1_730_000_000_000), 3_000);
        assert!(plan.clock_went_back);
        assert_eq!(
            plan.from,
            ResumeFrom::Since {
                ts_ms: 1_729_999_997_000,
                skip: 0
            }
        );
        assert_eq!(plan.from.argument(), "1729999997.000");
    }

    #[test]
    fn an_unknown_device_clock_trusts_the_cursor() {
        let cursor = LogcatCursor {
            ts_ms: 50,
            seen_at_ts: 1,
        };
        let plan = resume_plan(Some(cursor), None, 0);
        assert_eq!(plan.from, ResumeFrom::Since { ts_ms: 50, skip: 1 });
    }
}
