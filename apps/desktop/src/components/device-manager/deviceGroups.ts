import type { ADBDevice } from "@/types/adb.types";

export type DeviceGroupId = "physical" | "remote" | "emulator" | "remembered";

export interface DeviceGroup {
  id: DeviceGroupId;
  label: string;
  devices: ADBDevice[];
}

const GROUP_ORDER: Array<{ id: DeviceGroupId; label: string }> = [
  { id: "physical", label: "USB" },
  { id: "remote", label: "Wi-Fi" },
  { id: "emulator", label: "Emulators" },
  { id: "remembered", label: "Not connected" },
];

/**
 * A remembered device ADB no longer lists goes under "Not connected", so the live list stays short.
 * An emulator is classified by what it is, not how it is attached: it reaches ADB over USB like a
 * cabled handset, so checking the transport first would file it under the wrong heading.
 */
export function deviceGroupOf(device: ADBDevice): DeviceGroupId {
  if (device.isStale) return "remembered";
  if (device.deviceKind === "emulator") return "emulator";
  return device.connectionType === "wifi" ? "remote" : "physical";
}

/**
 * Groups devices for the picker; empty groups are dropped. Connecting over Wi-Fi and starting an
 * emulator live in the picker footer, so no group has to stay visible to host its action.
 * Remembered devices are ordered most recently seen first.
 */
export function groupDevices(devices: ADBDevice[]): DeviceGroup[] {
  return GROUP_ORDER.map(({ id, label }) => {
    const members = devices.filter((device) => deviceGroupOf(device) === id);
    if (id === "remembered") {
      members.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
    }
    return { id, label, devices: members };
  }).filter((group) => group.devices.length > 0);
}
