use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::commands::logcat::adb_stream::{AdbShellStream, LineSplitter, StreamRead};
use crate::commands::logcat::clock::{
    host_now_ms, measure_clock, resume_plan, ClockSample, LogcatCursor, ResumeFilter, ResumeFrom,
};
use crate::commands::logcat::identity::IdentityResolver;
use crate::commands::logcat::leases::LogcatRun;
use crate::commands::logcat::parse::{classify_line, AssembledEntry, LineAssembler, LogcatLine};
use crate::commands::logcat::types::{
    LogcatBatchPayload, LogcatLinePayload, LogcatSink, LogcatStatusPayload, LogcatStreamState,
};

/// How long a batch may wait before it is sent, and the read poll interval.
pub(crate) const BATCH_INTERVAL: Duration = Duration::from_millis(50);
/// A batch is sent as soon as it holds this many entries.
pub(crate) const BATCH_MAX_LINES: usize = 500;
const BACKOFF_MS: [u64; 5] = [500, 1_000, 2_000, 4_000, 8_000];
const STABLE_CONNECTION: Duration = Duration::from_secs(5);
const CLOCK_REFRESH: Duration = Duration::from_secs(300);
const READ_BUFFER_BYTES: usize = 64 * 1024;

static NEXT_SEQ: AtomicU64 = AtomicU64::new(1);

/// Delay before reconnect attempt `attempt` (1-based).
pub(crate) fn backoff_delay(attempt: u32) -> Duration {
    let index = (attempt.max(1) as usize - 1).min(BACKOFF_MS.len() - 1);
    Duration::from_millis(BACKOFF_MS[index])
}

fn logcat_command(from: ResumeFrom, buffers: Option<&str>) -> String {
    let buffers = buffers
        .map(|names| format!(" -b {names}"))
        .unwrap_or_default();
    format!(
        "logcat -v threadtime -v epoch -v uid{buffers} -T {}",
        from.argument()
    )
}

struct RunReporter {
    serial: String,
    generation: u64,
    sink: Arc<dyn LogcatSink>,
    clock: Option<ClockSample>,
}

impl RunReporter {
    fn status(
        &self,
        state: LogcatStreamState,
        attempt: u32,
        message: Option<String>,
        retry_in: Option<Duration>,
        clock_went_back: bool,
    ) {
        self.sink.status(LogcatStatusPayload {
            serial: self.serial.clone(),
            generation: self.generation,
            state,
            attempt,
            message,
            retry_in_ms: retry_in.map(|delay| delay.as_millis() as u64),
            clock: self.clock,
            clock_went_back,
        });
    }

    fn lines(&self, lines: Vec<LogcatLinePayload>) {
        if lines.is_empty() {
            return;
        }
        self.sink.lines(LogcatBatchPayload {
            serial: self.serial.clone(),
            generation: self.generation,
            lines,
        });
    }
}

fn to_payload(entry: AssembledEntry, identity: Option<&IdentityResolver>) -> LogcatLinePayload {
    let identity = identity
        .map(|resolver| resolver.identify(entry.uid, entry.pid))
        .unwrap_or_default();
    LogcatLinePayload {
        seq: NEXT_SEQ.fetch_add(1, Ordering::Relaxed),
        ts_ms: entry.ts_ms,
        uid: entry.uid,
        pid: entry.pid,
        tid: entry.tid,
        level: entry.level,
        tag: entry.tag,
        message: entry.message,
        process_name: identity.process_name,
        package_name: identity.package_name,
    }
}

struct Pump<'a> {
    assembler: LineAssembler,
    filter: ResumeFilter,
    batch: Vec<LogcatLinePayload>,
    batch_started: Option<Instant>,
    cursor: Option<LogcatCursor>,
    lines_seen: u64,
    last_other: Option<String>,
    identity: Option<&'a IdentityResolver>,
}

impl<'a> Pump<'a> {
    fn new(
        from: ResumeFrom,
        cursor: Option<LogcatCursor>,
        identity: Option<&'a IdentityResolver>,
    ) -> Self {
        Self {
            assembler: LineAssembler::default(),
            filter: ResumeFilter::new(from),
            batch: Vec::new(),
            batch_started: None,
            cursor,
            lines_seen: 0,
            last_other: None,
            identity,
        }
    }

    fn complete(&mut self, entry: AssembledEntry) {
        let payload = to_payload(entry, self.identity);
        self.batch.push(payload);
    }

    fn handle_line(&mut self, raw: &str) {
        match classify_line(raw) {
            LogcatLine::Header(header) => {
                if self.filter.is_repeat(header.ts_ms) {
                    return;
                }
                self.cursor = Some(LogcatCursor::advance(self.cursor, header.ts_ms));
                self.lines_seen += 1;
                if let Some(entry) = self.assembler.push(LogcatLine::Header(header)) {
                    self.complete(entry);
                }
            }
            LogcatLine::Other(text) => {
                if !text.trim().is_empty() {
                    self.last_other = Some(text.clone());
                }
                self.assembler.push(LogcatLine::Other(text));
            }
            LogcatLine::Banner => {}
        }
    }

    fn settle(&mut self) {
        if let Some(entry) = self.assembler.flush() {
            self.complete(entry);
        }
    }

    fn take_due(&mut self, force: bool) -> Option<Vec<LogcatLinePayload>> {
        if self.batch.is_empty() {
            self.batch_started = None;
            return None;
        }
        let started = *self.batch_started.get_or_insert_with(Instant::now);
        if force || self.batch.len() >= BATCH_MAX_LINES || started.elapsed() >= BATCH_INTERVAL {
            self.batch_started = None;
            return Some(std::mem::take(&mut self.batch));
        }
        None
    }
}

struct PumpEnd {
    lines_seen: u64,
    error: Option<String>,
    last_other: Option<String>,
}

fn pump(
    stream: &mut AdbShellStream,
    run: &LogcatRun,
    reporter: &mut RunReporter,
    from: ResumeFrom,
    cursor: &mut Option<LogcatCursor>,
    identity: &IdentityResolver,
) -> PumpEnd {
    let mut buffer = vec![0u8; READ_BUFFER_BYTES];
    let mut splitter = LineSplitter::default();
    let mut state = Pump::new(from, *cursor, Some(identity));
    let mut clock_checked = Instant::now();
    let mut error = None;

    while !run.is_stopped() {
        match stream.read(&mut buffer) {
            Ok(StreamRead::Data(count)) => {
                splitter.feed(&buffer[..count], |line| state.handle_line(line));
            }
            Ok(StreamRead::Idle) => state.settle(),
            Ok(StreamRead::Closed) => break,
            Err(message) => {
                error = Some(message);
                break;
            }
        }
        if let Some(lines) = state.take_due(false) {
            reporter.lines(lines);
        }
        if clock_checked.elapsed() >= CLOCK_REFRESH {
            clock_checked = Instant::now();
            if let Ok(sample) = measure_clock(&reporter.serial) {
                reporter.clock = Some(sample);
                reporter.status(LogcatStreamState::Live, 0, None, None, false);
            }
        }
    }

    splitter.reset();
    state.settle();
    if let Some(lines) = state.take_due(true) {
        if !run.is_stopped() {
            reporter.lines(lines);
        }
    }
    *cursor = state.cursor;
    PumpEnd {
        lines_seen: state.lines_seen,
        error,
        last_other: state.last_other,
    }
}

fn wait_unless_stopped(run: &LogcatRun, delay: Duration) {
    let deadline = Instant::now() + delay;
    while !run.is_stopped() && Instant::now() < deadline {
        std::thread::sleep(BATCH_INTERVAL);
    }
}

fn run_loop(serial: String, run: LogcatRun, sink: Arc<dyn LogcatSink>) {
    let mut reporter = RunReporter {
        serial: serial.clone(),
        generation: run.generation,
        sink: sink.clone(),
        clock: None,
    };
    let mut cursor: Option<LogcatCursor> = None;
    let mut attempt = 0u32;
    let mut dropped_at: Option<Instant> = None;

    reporter.status(LogcatStreamState::Connecting, 0, None, None, false);
    let identity = IdentityResolver::start(&serial);
    while !run.is_stopped() {
        let device_now = match measure_clock(&serial) {
            Ok(sample) => {
                reporter.clock = Some(sample);
                Some(host_now_ms() + sample.offset_ms)
            }
            Err(error) => {
                log::warn!("[logcat] clock measurement failed for {serial}: {error}");
                None
            }
        };
        let gap_ms = dropped_at.map_or(0, |at| at.elapsed().as_millis() as i64);
        let plan = resume_plan(cursor, device_now, gap_ms);

        let failure = match AdbShellStream::open(
            &serial,
            &logcat_command(plan.from, run.buffers.as_deref()),
            BATCH_INTERVAL,
        ) {
            Ok(mut stream) => {
                reporter.status(
                    LogcatStreamState::Live,
                    attempt,
                    None,
                    None,
                    plan.clock_went_back,
                );
                let connected_at = Instant::now();
                let end = pump(
                    &mut stream,
                    &run,
                    &mut reporter,
                    plan.from,
                    &mut cursor,
                    &identity,
                );
                dropped_at = Some(Instant::now());
                if end.lines_seen > 0 || connected_at.elapsed() >= STABLE_CONNECTION {
                    attempt = 0;
                }
                end.error
                    .or(end.last_other)
                    .unwrap_or_else(|| "The device ended the logcat stream".to_string())
            }
            Err(message) => message,
        };
        if run.is_stopped() {
            break;
        }
        attempt += 1;
        let delay = backoff_delay(attempt);
        reporter.status(
            LogcatStreamState::Reconnecting,
            attempt,
            Some(failure),
            Some(delay),
            false,
        );
        wait_unless_stopped(&run, delay);
    }

    reporter.status(LogcatStreamState::Stopped, 0, None, None, false);
    sink.ended(&serial, run.generation);
}

/// Streams the device's logcat on a background thread until `run` is stopped,
/// reconnecting with backoff when the stream dies.
pub(crate) fn spawn_logcat_run(serial: String, run: LogcatRun, sink: Arc<dyn LogcatSink>) {
    let name = format!("logcat-{serial}");
    let spawned = std::thread::Builder::new()
        .name(name)
        .spawn(move || run_loop(serial, run, sink));
    if let Err(error) = spawned {
        log::error!("[logcat] could not start the capture thread: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_grows_and_caps() {
        assert_eq!(backoff_delay(1), Duration::from_millis(500));
        assert_eq!(backoff_delay(3), Duration::from_millis(2_000));
        assert_eq!(backoff_delay(40), Duration::from_millis(8_000));
        assert_eq!(backoff_delay(0), Duration::from_millis(500));
    }

    #[test]
    fn the_command_asks_for_epoch_and_uid_and_resumes_at_the_cursor() {
        assert_eq!(
            logcat_command(ResumeFrom::Tail(256), None),
            "logcat -v threadtime -v epoch -v uid -T 256"
        );
        assert_eq!(
            logcat_command(
                ResumeFrom::Since {
                    ts_ms: 1_730_000_000_005,
                    skip: 1
                },
                Some("main,events")
            ),
            "logcat -v threadtime -v epoch -v uid -b main,events -T 1730000000.005"
        );
    }

    #[test]
    fn a_resumed_stream_neither_repeats_nor_loses_lines() {
        let mut first = Pump::new(ResumeFrom::Tail(256), None, None);
        for line in [
            "1730000000.100 10145:100 100 I App: a",
            "1730000000.200 10145:100 100 I App: b",
            "1730000000.200 10145:100 101 I App: c",
        ] {
            first.handle_line(line);
        }
        first.settle();
        let cursor = first.cursor;
        assert_eq!(
            cursor,
            Some(LogcatCursor {
                ts_ms: 1_730_000_000_200,
                seen_at_ts: 2
            })
        );

        let plan = resume_plan(cursor, Some(1_730_000_009_000), 1_000);
        let mut second = Pump::new(plan.from, cursor, None);
        for line in [
            "1730000000.200 10145:100 100 I App: b",
            "1730000000.200 10145:100 101 I App: c",
            "1730000000.200 10145:100 102 I App: d",
            "1730000000.300 10145:100 100 I App: e",
        ] {
            second.handle_line(line);
        }
        second.settle();
        let messages: Vec<String> = second
            .batch
            .iter()
            .map(|line| line.message.clone())
            .collect();
        assert_eq!(messages, vec!["d", "e"]);
    }

    #[test]
    fn batches_are_released_by_size_or_age() {
        let mut pump = Pump::new(ResumeFrom::Tail(1), None, None);
        assert!(pump.take_due(false).is_none());
        for index in 0..BATCH_MAX_LINES + 1 {
            pump.handle_line(&format!("1730000000.000 1:{} 1 I T: {index}", index + 1));
        }
        let batch = pump.take_due(false).expect("a full batch is due");
        assert_eq!(batch.len(), BATCH_MAX_LINES);
        pump.settle();
        assert!(pump.take_due(false).is_none());
        pump.batch_started = Some(Instant::now() - BATCH_INTERVAL);
        assert_eq!(pump.take_due(false).map(|lines| lines.len()), Some(1));
    }
}
