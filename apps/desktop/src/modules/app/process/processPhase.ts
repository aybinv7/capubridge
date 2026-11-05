import type { AppPresence } from "@/lib/gates/presence";
import type { StatusCopy, StatusMark } from "@/shared/perf/statusMark";
import { PROCESS_PERIOD_MS } from "./processSample";

/** Where the reading of the app's process stands, as the screen tells it. */
export type ProcessPhase = "error" | "paused" | "starting" | "not-running" | "stale" | "live";

export interface ProcessPhaseInput {
  error: string | null;
  paused: boolean;
  /** A reading arrived since the monitor last started. */
  sampledSinceStart: boolean;
  /** Whether the newest reading found a process; `null` before the first one. */
  running: boolean | null;
  /** Milliseconds since the newest reading, `null` before the first one. */
  sinceLastSampleMs: number | null;
}

/** A reading older than this is called stale: the phone stopped answering. */
export const PROCESS_STALE_AFTER_MS = PROCESS_PERIOD_MS * 4;

/**
 * Decides the phase. "User paused", "not running" and "the phone stopped answering" are told
 * apart, and an old reading from before a pause never counts as live. An app in the background
 * is still read live: Android itself reports its memory, even while the app is frozen.
 */
export function processPhase(input: ProcessPhaseInput): ProcessPhase {
  if (input.paused) return "paused";
  if (input.error) return "error";
  if (!input.sampledSinceStart) return "starting";
  if (input.running === false) return "not-running";
  const age = input.sinceLastSampleMs;
  if (age !== null && age > PROCESS_STALE_AFTER_MS) return "stale";
  return "live";
}

/** The words for each phase: a short state word and one plain sentence. */
export function processPhaseCopy(
  phase: ProcessPhase,
  sinceLastSampleMs: number | null,
  inBackground = false,
): StatusCopy {
  switch (phase) {
    case "error":
      return { label: "Stopped", detail: "The phone did not answer about the app's process." };
    case "paused":
      return { label: "Paused", detail: "Resume to read the app again." };
    case "starting":
      return { label: "Starting", detail: "Asking the phone about the app's process." };
    case "not-running":
      return {
        label: "Not running",
        detail: "The app has no process on the phone. Open it to see its numbers.",
      };
    case "stale": {
      const seconds = Math.round((sinceLastSampleMs ?? 0) / 1000);
      return {
        label: "Stale",
        detail: `No reading for ${seconds} s. The phone may be busy or asleep.`,
      };
    }
    case "live":
      return {
        label: "Live",
        detail: inBackground
          ? "In the background, Android may freeze it."
          : "Read from the phone every 2.5 seconds.",
      };
  }
}

/** The dot beside the phase word: live is the live signal, trouble is a warning or an error. */
export function processPhaseMark(phase: ProcessPhase): StatusMark {
  if (phase === "live") return { color: "lime", variant: "solid" };
  if (phase === "error") return { color: "red", variant: "solid" };
  if (phase === "stale") return { color: "yellow", variant: "solid" };
  return { color: undefined, variant: "hollow" };
}

export type AppRunState = "unknown" | "running" | "background" | "stopped";

/** Whether the app is up, from the newest process reading and the DevTools presence probe. */
export function appRunState(running: boolean | null, presence: AppPresence): AppRunState {
  if (running === false) return "stopped";
  if (running === null) return presence === "background" ? "background" : "unknown";
  return presence === "background" ? "background" : "running";
}

/** The run state as a word with its mark: running is a present state, the rest are hollow. */
export function appRunCopy(state: AppRunState): { label: string; mark: StatusMark } {
  switch (state) {
    case "running":
      return { label: "Running", mark: { color: undefined, variant: "solid" } };
    case "background":
      return { label: "In the background", mark: { color: undefined, variant: "hollow" } };
    case "stopped":
      return { label: "Not running", mark: { color: undefined, variant: "hollow" } };
    case "unknown":
      return { label: "Checking", mark: { color: undefined, variant: "hollow" } };
  }
}
