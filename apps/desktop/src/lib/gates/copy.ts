import type {
  GateActionId,
  GateCopy,
  GateInput,
  GateKind,
  GateNotice,
  GateRequirement,
  GateTone,
} from "@/lib/gates/types";

const FIRST_RUN_STEPS = [
  "On the phone, open Developer options and turn on USB debugging.",
  "Connect it over USB, or pair it over Wi-Fi from the device manager.",
  "Unlock the phone and accept “Allow USB debugging”.",
] as const;

function deviceName(input: GateInput): string {
  return input.device?.name || input.device?.model || input.device?.serial || "The device";
}

function targetName(input: GateInput): string {
  return input.target?.title || "the target";
}

function hostName(input: GateInput): string {
  return input.target?.source === "chrome" ? "a Chrome tab" : "a page on This PC";
}

function copy(
  title: string,
  detail: string,
  tone: GateTone,
  actions: readonly GateActionId[],
  steps?: readonly string[],
): GateCopy {
  return steps ? { title, detail, tone, actions, steps } : { title, detail, tone, actions };
}

/** Title, explanation and next actions for a blocking gate state. */
export function gateCopy(
  kind: Exclude<GateKind, "open">,
  input: GateInput,
  requirement: GateRequirement,
): GateCopy {
  switch (kind) {
    case "adb-unavailable":
      return copy(
        "ADB is not running",
        "Capubridge reaches phones through the ADB server on port 5037, and it did not answer.",
        "error",
        ["start-adb", "open-local-url"],
      );
    case "no-device":
      if (input.onlineDevices > 0) {
        return copy(
          "Choose a device",
          `${input.onlineDevices === 1 ? "One device is" : `${input.onlineDevices} devices are`} connected over ADB. Pick the one to work on.`,
          "neutral",
          ["choose-device", "open-local-url"],
        );
      }
      return copy(
        "Connect an Android device",
        requirement === "device"
          ? "This screen reads the phone over ADB. It opens as soon as a device is connected."
          : "Pick a device first, or inspect a page on This PC instead.",
        "neutral",
        ["choose-device", "pair-wifi", "start-emulator", "open-local-url"],
        FIRST_RUN_STEPS,
      );
    case "device-unauthorized":
      return input.device?.status === "no-permissions"
        ? copy(
            `No permission to talk to ${deviceName(input)}`,
            "The operating system denied access to the USB device. On Linux, add a udev rule for it, then replug the cable.",
            "warning",
            ["rescan-devices", "choose-device"],
          )
        : copy(
            `Allow USB debugging on ${deviceName(input)}`,
            "The phone is connected but does not trust this computer yet. Unlock it and accept the “Allow USB debugging” prompt.",
            "warning",
            ["rescan-devices", "choose-device"],
          );
    case "device-offline":
      return copy(
        `${deviceName(input)} is offline`,
        "ADB still lists the device but cannot reach it. Replug the cable, or reconnect Wi-Fi debugging.",
        "warning",
        ["rescan-devices", "choose-device"],
      );
    case "needs-device":
      return copy(
        "This screen needs an Android device",
        `The current target is ${hostName(input)}. Device tools read the phone over ADB.`,
        "neutral",
        ["choose-device"],
      );
    case "no-target":
      return input.device?.status === "online"
        ? copy(
            "Choose a target",
            `${deviceName(input)} is ready. Open your app on the phone, then pick its WebView. Every panel follows the target you pick.`,
            "neutral",
            ["choose-target", "scan-targets"],
          )
        : copy(
            "Choose a target",
            "Pick a WebView on a connected phone, a Chrome tab, or a URL on This PC. Every panel follows the target you pick.",
            "neutral",
            ["choose-target", "open-local-url"],
          );
    case "needs-app-target":
      return copy(
        "Pick an Android app target",
        `This screen reads the package behind an Android WebView. ${targetName(input)} is ${hostName(input)}.`,
        "neutral",
        ["choose-target"],
      );
    case "idle":
      return copy(
        `Not attached to ${targetName(input)}`,
        "The target is selected, but no DevTools session is open yet.",
        "neutral",
        ["connect", "choose-target"],
      );
    case "connecting":
      return copy(
        `Attaching to ${targetName(input)}`,
        input.target?.source === "adb"
          ? "Opening a DevTools session through the forwarded port."
          : "Opening a DevTools session.",
        "waiting",
        [],
      );
    case "gone":
      return copy(
        `${targetName(input)} is gone`,
        "DevTools no longer lists this WebView. The page reloaded or navigated, or the app was closed.",
        "warning",
        ["scan-targets", "choose-target"],
      );
    case "disconnected":
      return copy(
        `Link to ${targetName(input)} closed`,
        "The DevTools socket closed. It usually returns when the app comes back to the foreground.",
        "warning",
        ["reconnect", "choose-target"],
      );
    case "error":
      return copy(
        `Could not attach to ${targetName(input)}`,
        "The DevTools endpoint refused the session or did not answer in time.",
        "error",
        ["reconnect", "choose-target"],
      );
  }
}

/**
 * Title, explanation and actions for a non-blocking notice. The app is named by its label (the
 * name on the phone) when known, never by its package.
 */
export function noticeCopy(
  notice: GateNotice,
  input: GateInput,
  appLabel: string | null = null,
): GateCopy {
  const app = appLabel?.trim() || targetName(input);
  if (notice === "background") {
    return copy(
      `${app} is in the background`,
      "Android may freeze it while it is away, so values can be stale until it is back on screen.",
      "warning",
      ["bring-to-front"],
    );
  }
  return copy(
    `Another WebView of ${app} is on screen`,
    "This target is still alive but hidden behind it.",
    "neutral",
    ["choose-target"],
  );
}

/** Short text for the strip shown over a screen whose link dropped after it rendered. */
export function degradedCopy(
  kind: Exclude<GateKind, "open">,
  input: GateInput,
  requirement: GateRequirement,
): GateCopy {
  const full = gateCopy(kind, input, requirement);
  const detail =
    kind === "connecting"
      ? "Reattaching. Showing the last values read from the device."
      : "Showing the last values read from the device.";
  return { ...full, detail };
}
