import type { TargetProbe } from "@/types/cdp.types";

/**
 * Where the selected target's app is, as far as the DevTools endpoint can tell.
 * - `foreground`: on screen (or the endpoint gives no visibility data).
 * - `view-hidden`: the app is up, but this WebView is not the one on screen.
 * - `background`: Android reports the view hidden, or froze the process.
 * - `gone`: the endpoint no longer lists the target (reload, navigation, app killed).
 */
export type AppPresence = "unknown" | "foreground" | "view-hidden" | "background" | "gone";

export interface PresenceState {
  presence: AppPresence;
  misses: number;
}

export const INITIAL_PRESENCE: PresenceState = { presence: "unknown", misses: 0 };

/** Consecutive unanswered probes before a silent endpoint counts as a frozen app. */
export const UNRESPONSIVE_THRESHOLD = 2;

export function nextPresence(state: PresenceState, probe: TargetProbe): PresenceState {
  switch (probe.presence) {
    case "visible":
    case "unknown":
      return { presence: "foreground", misses: 0 };
    case "hidden":
      return { presence: probe.siblingVisible ? "view-hidden" : "background", misses: 0 };
    case "gone":
      return { presence: "gone", misses: 0 };
    case "unresponsive": {
      const misses = state.misses + 1;
      return {
        presence: misses >= UNRESPONSIVE_THRESHOLD ? "background" : state.presence,
        misses,
      };
    }
  }
}

/** The forwarded DevTools port from a target's `ws://127.0.0.1:<port>/…` URL. */
export function portFromWebSocketUrl(url: string | undefined): number | null {
  if (!url) return null;
  try {
    const port = Number(new URL(url).port);
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
  } catch {
    return null;
  }
}
