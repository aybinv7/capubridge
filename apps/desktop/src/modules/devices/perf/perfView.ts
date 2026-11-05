import type { Color } from "@capubridge/cladd";

/** Where the device monitor stands, as the screen tells it. */
export type PerfPhase =
  | "error"
  | "paused"
  | "offline"
  | "starting"
  | "waiting"
  | "overdue"
  | "live"
  | "stale";

export interface PerfPhaseInput {
  error: string | null;
  paused: boolean;
  /** The phone is known but not online. */
  offline: boolean;
  /** The monitor should be reading now (a vitals tab is open and the window is shown). */
  active: boolean;
  isRunning: boolean;
  firstSampleOverdue: boolean;
  /** A reading arrived since the monitor last started. */
  sampledSinceStart: boolean;
  /** Milliseconds since the newest device reading, `null` before the first one. */
  sinceLastSampleMs: number | null;
}

/** A running monitor whose newest reading is older than this is called stale, not live. */
export const STALE_AFTER_MS = 5000;

/**
 * Decides the monitor's phase. A reading only counts as live when it arrived since the monitor
 * last started: old readings from before a pause, another tab or a hidden window are shown, but
 * the monitor says it is starting or waiting until a fresh one comes in.
 */
export function perfPhase(input: PerfPhaseInput): PerfPhase {
  if (input.error) return "error";
  if (input.paused) return "paused";
  if (input.offline) return "offline";
  if (!input.active || !input.isRunning) return "starting";
  if (!input.sampledSinceStart) return input.firstSampleOverdue ? "overdue" : "waiting";
  const age = input.sinceLastSampleMs;
  return age !== null && age > STALE_AFTER_MS ? "stale" : "live";
}

/** Whether a reading taken at `sampleAt` belongs to the run that started at `startedAt`. */
export function sampledSince(sampleAt: number | null, startedAt: number | null): boolean {
  return sampleAt !== null && startedAt !== null && sampleAt >= startedAt;
}

/** Charts are shown as soon as anything was read, from the device or from the WebView. */
export function hasPerfReadings(tickCount: number, webViewUpdatedAt: number | null): boolean {
  return tickCount > 0 || webViewUpdatedAt !== null;
}

export interface PerfPhaseCopy {
  label: string;
  detail: string;
}

/** The words for each phase: a short state word and one plain sentence. */
export function perfPhaseCopy(phase: PerfPhase, sinceLastSampleMs: number | null): PerfPhaseCopy {
  switch (phase) {
    case "error":
      return { label: "Stopped", detail: "The device monitor could not start." };
    case "paused":
      return { label: "Paused", detail: "Resume to read the phone again." };
    case "offline":
      return {
        label: "Offline",
        detail: "The phone is not connected. Readings resume when it is back.",
      };
    case "starting":
      return { label: "Starting", detail: "Asking the phone for its first reading." };
    case "waiting":
      return {
        label: "Waiting",
        detail: "CPU, memory, network and battery are read over ADB about once a second.",
      };
    case "overdue":
      return {
        label: "No reading yet",
        detail:
          "ADB is connected, but the phone has not answered yet. Values appear as soon as it does.",
      };
    case "stale": {
      const seconds = Math.round((sinceLastSampleMs ?? 0) / 1000);
      return {
        label: "Stale",
        detail: `No reading for ${seconds} s. The phone may be busy or asleep.`,
      };
    }
    case "live":
      return { label: "Live", detail: "Read about once a second." };
  }
}

/** Text colour for a load reading: plain ink when normal, warning from 60 %, error from 80 %. */
export function loadTone(percent: number | null): string {
  if (percent === null) return "text-muted-foreground";
  if (percent >= 80) return "text-error";
  if (percent >= 60) return "text-warning";
  return "text-foreground";
}

/**
 * Text colour for memory use. Android keeps cached apps in memory on purpose, so a high share is
 * normal; it only warns from 85 % and calls 95 % an error.
 */
export function memoryTone(percent: number | null): string {
  if (percent === null) return "text-muted-foreground";
  if (percent >= 95) return "text-error";
  if (percent >= 85) return "text-warning";
  return "text-foreground";
}

/** Text colour for a battery level: error under 20 %, warning under 40 %, plain ink otherwise. */
export function batteryTone(level: number | null): string {
  if (level === null) return "text-muted-foreground";
  if (level < 20) return "text-error";
  if (level < 40) return "text-warning";
  return "text-foreground";
}

/** The status mark beside the phase word: live is the live signal, trouble is a warning. */
export function phaseDot(phase: PerfPhase): {
  color: Color | undefined;
  variant: "solid" | "hollow";
} {
  if (phase === "live") return { color: "lime", variant: "solid" };
  if (phase === "error") return { color: "red", variant: "solid" };
  if (phase === "overdue" || phase === "stale") return { color: "yellow", variant: "solid" };
  return { color: undefined, variant: "hollow" };
}
