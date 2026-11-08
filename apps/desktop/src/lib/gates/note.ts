import { resolveGate } from "@/lib/gates/resolve";
import type { GateInput, GateKind, GateRequirement } from "@/lib/gates/types";

/** What a blocked screen still needs, in a few words (`open` has nothing to say). */
const NOTES: Record<Exclude<GateKind, "open">, string> = {
  "adb-unavailable": "ADB is not running",
  "no-device": "needs a device",
  "device-unauthorized": "approve the device",
  "device-offline": "device is offline",
  "needs-device": "needs a device",
  "no-target": "needs a WebView",
  "needs-app-target": "needs an app",
  "needs-webview": "needs a WebView",
  idle: "not connected",
  connecting: "connecting",
  gone: "app is closed",
  disconnected: "disconnected",
  error: "connection failed",
};

/**
 * A quiet reason why a screen would show a gate right now, or `null` when it would open. An
 * app screen without any target says it needs an app, not a WebView.
 */
export function gateNote(requirement: GateRequirement, input: GateInput): string | null {
  const { kind } = resolveGate(requirement, input);
  if (kind === "open") return null;
  if (kind === "no-target" && requirement === "app-target") return NOTES["needs-app-target"];
  return NOTES[kind];
}
