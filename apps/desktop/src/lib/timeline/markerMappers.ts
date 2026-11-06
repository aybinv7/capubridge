import type { ConsoleEntry, ConsoleExceptionEntry } from "@/types/console.types";
import type { LogcatEntry } from "@/types/logcat.types";
import type { NetworkEntry } from "@/types/network.types";
import type { TimelineMarkerInput, TimelineSeverity } from "@/types/timeline.types";

function logcatSeverity(level: LogcatEntry["level"]): TimelineSeverity {
  if (level === "E" || level === "F") return "error";
  if (level === "W") return "warning";
  if (level === "I") return "info";
  return "verbose";
}

function consoleSeverity(level: ConsoleEntry["level"]): TimelineSeverity {
  if (level === "error") return "error";
  if (level === "warn") return "warning";
  if (level === "info") return "info";
  return "verbose";
}

/** One logcat marker, plus an Errors marker for E and F lines. `hostMs` is already converted. */
export function logcatMarkers(entry: LogcatEntry, hostMs: number): TimelineMarkerInput[] {
  const severity = logcatSeverity(entry.level);
  const label = `${entry.tag}: ${entry.message.split("\n", 1)[0] ?? ""}`;
  const ref = { kind: "logcat", id: entry.id } as const;
  const markers: TimelineMarkerInput[] = [{ t: hostMs, lane: "logcat", severity, ref, label }];
  if (severity === "error") {
    markers.push({ t: hostMs, lane: "errors", severity, ref, label });
  }
  return markers;
}

/** One console marker, plus an Errors marker for `console.error`. */
export function consoleMarkers(entry: ConsoleEntry, hostMs: number): TimelineMarkerInput[] {
  const severity = consoleSeverity(entry.level);
  const ref = { kind: "console", id: entry.id } as const;
  const label = entry.message.split("\n", 1)[0] ?? "";
  const markers: TimelineMarkerInput[] = [{ t: hostMs, lane: "console", severity, ref, label }];
  if (severity === "error") {
    markers.push({ t: hostMs, lane: "errors", severity, ref, label });
  }
  return markers;
}

export function exceptionMarker(entry: ConsoleExceptionEntry, hostMs: number): TimelineMarkerInput {
  return {
    t: hostMs,
    lane: "errors",
    severity: "error",
    ref: { kind: "exception", id: entry.id },
    label: entry.message.split("\n", 1)[0] ?? "",
  };
}

/** Whether a finished request failed: a network error or an HTTP status of 400 or more. */
export function requestFailed(entry: NetworkEntry): boolean {
  return entry.state === "failed" || (entry.httpStatus !== null && entry.httpStatus >= 400);
}

/** A request start on the Network lane; a failure is marked with error severity. */
export function networkMarker(entry: NetworkEntry, hostMs: number): TimelineMarkerInput {
  const failed = requestFailed(entry);
  const status = entry.httpStatus === null ? "" : ` ${entry.httpStatus}`;
  return {
    t: hostMs,
    lane: "network",
    severity: failed ? "error" : "info",
    ref: { kind: "network", id: entry.requestId },
    label: `${entry.method}${status} ${entry.url}`,
  };
}
