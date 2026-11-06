import type {
  GateInput,
  GateKind,
  GateNotice,
  GateRequirement,
  GateResult,
} from "@/lib/gates/types";

const OPEN: GateResult = { kind: "open", notice: null };

function deviceBlock(input: GateInput): GateKind | null {
  const device = input.device;
  if (device) {
    if (device.status === "unauthorized" || device.status === "no-permissions") {
      return "device-unauthorized";
    }
    if (device.status !== "online" || device.isStale) return "device-offline";
    return null;
  }
  if (input.target && input.target.source !== "adb") return "needs-device";
  if (input.adb === "error") return "adb-unavailable";
  return "no-device";
}

function linkBlock(input: GateInput): GateKind | null {
  if (input.target?.source === "adb" && input.presence === "gone") return "gone";
  switch (input.link) {
    case "connected":
      return null;
    case "connecting":
      return "connecting";
    case "disconnected":
      return "disconnected";
    case "error":
      return "error";
    case "idle":
    case "none":
      return "idle";
  }
}

function noticeFor(input: GateInput): GateNotice | null {
  if (input.target?.source !== "adb") return null;
  if (input.presence === "background") return "background";
  if (input.presence === "view-hidden") return "view-hidden";
  return null;
}

function blocked(kind: GateKind): GateResult {
  return { kind, notice: null };
}

/** An Android WebView whose app package is known, so its files can be read over ADB. */
export function isAppTarget(input: GateInput): boolean {
  return input.target?.source === "adb" && Boolean(input.target.packageName);
}

/**
 * Decides whether a screen with `requirement` can render, and if not, which single
 * reason to show. The first broken link of device › target › DevTools link wins.
 */
export function resolveGate(requirement: GateRequirement, input: GateInput): GateResult {
  if (requirement === "none") return OPEN;

  if (requirement === "device") {
    const block = deviceBlock(input);
    return block ? blocked(block) : OPEN;
  }

  const target = input.target;
  if (!target) {
    if (requirement === "app-target") {
      const block = deviceBlock(input);
      if (block) return blocked(block);
    }
    return blocked("no-target");
  }

  if (requirement === "app-target") {
    if (target.source !== "adb" || !target.packageName) return blocked("needs-app-target");
    const block = deviceBlock(input);
    return block ? blocked(block) : { kind: "open", notice: noticeFor(input) };
  }

  if (requirement === "data" && isAppTarget(input)) {
    const block = deviceBlock(input);
    return block ? blocked(block) : { kind: "open", notice: noticeFor(input) };
  }

  if (target.native) {
    return blocked(deviceBlock(input) ?? "needs-webview");
  }

  if (target.source === "adb") {
    const block = deviceBlock(input);
    if (block) return blocked(block);
  }
  const block = linkBlock(input);
  return block ? blocked(block) : { kind: "open", notice: noticeFor(input) };
}

/**
 * Identity of what a gated screen is showing. When it changes the screen remounts;
 * while it holds, a lost link degrades the screen instead of tearing it down.
 */
export function gateSubjectKey(requirement: GateRequirement, input: GateInput): string {
  switch (requirement) {
    case "none":
      return "none";
    case "device":
      return `device:${input.device?.serial ?? "-"}`;
    case "app-target":
    case "target":
    case "data":
      return `target:${input.target?.id ?? "-"}`;
  }
}
