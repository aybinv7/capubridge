import type { AppPresence } from "@/lib/gates/presence";
import type { GateLinkStatus, GateTargetSource } from "@/lib/gates/types";

/** The one answer to "is the selected target live?", shared by every surface. */
export type LinkHealth =
  | "none"
  | "idle"
  | "attaching"
  | "live"
  | "paused"
  | "hidden"
  | "gone"
  | "closed"
  | "failed";

export type LinkTone = "live" | "waiting" | "warning" | "error" | "muted";

export interface LinkPresentation {
  health: LinkHealth;
  label: string;
  tone: LinkTone;
  description: string;
}

export function deriveLinkHealth(
  source: GateTargetSource | null,
  status: GateLinkStatus,
  presence: AppPresence,
): LinkHealth {
  if (!source) return "none";
  if (source === "adb" && presence === "gone") return "gone";
  switch (status) {
    case "none":
    case "idle":
      return "idle";
    case "connecting":
      return "attaching";
    case "disconnected":
      return "closed";
    case "error":
      return "failed";
    case "connected":
      if (source !== "adb") return "live";
      if (presence === "background") return "paused";
      if (presence === "view-hidden") return "hidden";
      return "live";
  }
}

const PRESENTATION: Record<LinkHealth, Omit<LinkPresentation, "health">> = {
  none: { label: "no target", tone: "muted", description: "No target selected" },
  idle: { label: "not attached", tone: "muted", description: "Selected, no DevTools session yet" },
  attaching: { label: "attaching", tone: "waiting", description: "Opening a DevTools session" },
  live: { label: "live", tone: "live", description: "DevTools session open, app on screen" },
  paused: {
    label: "in the background",
    tone: "warning",
    description: "App in the background; Android may freeze its WebView until it returns",
  },
  hidden: {
    label: "hidden",
    tone: "warning",
    description: "Another WebView of this app is on screen",
  },
  gone: { label: "gone", tone: "error", description: "DevTools no longer lists this target" },
  closed: { label: "closed", tone: "error", description: "DevTools socket closed" },
  failed: { label: "failed", tone: "error", description: "Could not open a DevTools session" },
};

export function presentLink(health: LinkHealth): LinkPresentation {
  return { health, ...PRESENTATION[health] };
}
