import type { ConsoleEntry, ConsoleExceptionEntry } from "@/types/console.types";

/** What identifies a console message across a replay: time, type, text and location. */
export function consoleSignature(entry: ConsoleEntry): string {
  return `${entry.timestamp}|${entry.type}|${entry.message}|${entry.url}:${entry.lineNumber}`;
}

export function exceptionSignature(entry: ConsoleExceptionEntry): string {
  return `${entry.timestamp}|exception|${entry.message}|${entry.url}:${entry.lineNumber}`;
}

export interface ReplayGuard {
  /** Remembers what is already kept; later messages from before `now` that match are replays. */
  arm(signatures: Iterable<string>, now: number): void;
  isReplay(timestamp: number, signature: string): boolean;
  disarm(): void;
}

/**
 * When a CDP session is rebound to the same target, `Runtime.enable` and `Log.enable` replay the
 * messages the page already logged. The guard drops a message stamped before the rebind that
 * matches one already kept; anything newer, or not seen before, passes.
 */
export function createReplayGuard(): ReplayGuard {
  let cutoff = Number.NEGATIVE_INFINITY;
  let seen = new Set<string>();

  return {
    arm(signatures, now) {
      seen = new Set(signatures);
      cutoff = now;
    },
    isReplay(timestamp, signature) {
      return timestamp <= cutoff && seen.has(signature);
    },
    disarm() {
      seen = new Set();
      cutoff = Number.NEGATIVE_INFINITY;
    },
  };
}
