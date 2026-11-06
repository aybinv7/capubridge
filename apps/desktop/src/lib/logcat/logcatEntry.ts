import type { LogcatEntry, LogcatLinePayload } from "@/types/logcat.types";

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function pad3(value: number): string {
  return value < 10 ? `00${value}` : value < 100 ? `0${value}` : String(value);
}

/** `MM-DD` and `HH:MM:SS.mmm` for an epoch time, in host local time, without Intl. */
export function logcatClockLabels(tsMs: number): { date: string; time: string } {
  const at = new Date(tsMs);
  return {
    date: `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`,
    time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}.${pad3(at.getMilliseconds())}`,
  };
}

/** Builds the kept entry from a line Rust sent. */
export function toLogcatEntry(serial: string, line: LogcatLinePayload): LogcatEntry {
  const { date, time } = logcatClockLabels(line.tsMs);
  return {
    id: `${serial}:${line.seq}`,
    seq: line.seq,
    serial,
    tsMs: line.tsMs,
    date,
    time,
    uid: line.uid,
    pid: line.pid,
    tid: line.tid,
    level: line.level,
    tag: line.tag,
    processName: line.processName,
    packageName: line.packageName,
    message: line.message,
  };
}

function column(value: number | null, width: number): string {
  return (value === null ? "-" : String(value)).padStart(width, " ");
}

/**
 * The entry in logcat's `threadtime` layout, one physical line per message line, as
 * `adb logcat -v threadtime` would print it. Used for text export.
 */
export function formatLogcatLine(entry: LogcatEntry): string {
  const prefix = `${entry.date} ${entry.time} ${column(entry.pid, 5)} ${column(entry.tid, 5)} ${entry.level} ${entry.tag.padEnd(8, " ")}: `;
  return entry.message
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}
