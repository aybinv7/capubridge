import type { Color } from "@capubridge/cladd";
import type { ADBDevice } from "@/types/adb.types";
import { friendlyDeviceName, type NamedDevice } from "@/lib/device-name";

export type DeviceCondition = "online" | "unauthorized" | "no-permissions" | "offline" | "absent";

export interface DeviceState {
  condition: DeviceCondition;
  /** Short word beside the name: "Online", "Needs permission", "Not connected". */
  label: string;
  dotColor: Color | undefined;
  dotVariant: "solid" | "hollow";
  /** Set when the device cannot be used: what is wrong, in one sentence. */
  title: string | null;
  /** Ordered next steps, empty when the device is usable. */
  steps: string[];
}

export function deviceDisplayName(device: NamedDevice, manufacturer?: string | null): string {
  return friendlyDeviceName(device, manufacturer);
}

export function deviceCondition(device: ADBDevice): DeviceCondition {
  if (device.isStale) return "absent";
  if (device.status === "online") return "online";
  if (device.status === "unauthorized") return "unauthorized";
  if (device.status === "no-permissions") return "no-permissions";
  return "offline";
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function formatAgo(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function absentSteps(device: ADBDevice): string[] {
  if (device.deviceKind === "emulator") {
    return ["Start it from Emulators in the list, or from Android Studio."];
  }
  if (device.connectionType === "wifi") {
    return [
      "Make sure the device and this PC are on the same network.",
      "Reconnect it from Connect a device, below the list.",
    ];
  }
  return ["Plug in the cable and unlock the device."];
}

/** What a device's state means and, when it cannot be used, exactly what to do next. */
export function describeDeviceState(
  device: ADBDevice,
  now = Date.now(),
  name = deviceDisplayName(device),
): DeviceState {
  const condition = deviceCondition(device);
  switch (condition) {
    case "online":
      return {
        condition,
        label: "Online",
        dotColor: "green",
        dotVariant: "solid",
        title: null,
        steps: [],
      };
    case "unauthorized":
      return {
        condition,
        label: "Needs permission",
        dotColor: "yellow",
        dotVariant: "solid",
        title: `${name} does not trust this computer yet`,
        steps: [
          "Unlock the device.",
          "Accept “Allow USB debugging?” and tick “Always allow from this computer”.",
          "No prompt? Replug the cable, or revoke USB debugging authorisations in Developer options and replug.",
        ],
      };
    case "no-permissions":
      return {
        condition,
        label: "No access",
        dotColor: "yellow",
        dotVariant: "solid",
        title: `The operating system denied access to ${name}`,
        steps: [
          "Replug the cable.",
          "On Windows, install the maker's USB driver. On Linux, add a udev rule for the vendor.",
        ],
      };
    case "offline":
      return {
        condition,
        label: "Offline",
        dotColor: "red",
        dotVariant: "solid",
        title: `ADB lists ${name} but cannot reach it`,
        steps: [
          "Unlock the device; some devices drop ADB while locked.",
          "Replug the cable, or reconnect Wi-Fi debugging.",
        ],
      };
    case "absent":
      return {
        condition,
        label: device.lastSeenAt ? `Seen ${formatAgo(now - device.lastSeenAt)}` : "Not connected",
        dotColor: undefined,
        dotVariant: "hollow",
        title: `${name} is not connected`,
        steps: absentSteps(device),
      };
  }
}
