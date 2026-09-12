import type { ADBDevice } from "@/types/adb.types";

export type DeviceGroupId = "remote" | "physical" | "emulator";

export interface DeviceGroup {
  id: DeviceGroupId;
  label: string;
  devices: ADBDevice[];
}

const GROUP_ORDER: Array<{ id: DeviceGroupId; label: string }> = [
  { id: "emulator", label: "Emulators" },
  { id: "physical", label: "Devices" },
  { id: "remote", label: "Remote" },
];

/**
 * An emulator is classified by what it is, not how it is attached — it reaches
 * ADB over USB like a cabled handset, so checking the transport first would
 * file it under the wrong heading.
 */
export function deviceGroupOf(device: ADBDevice): DeviceGroupId {
  if (device.deviceKind === "emulator") return "emulator";
  return device.connectionType === "wifi" ? "remote" : "physical";
}

// Emulator and remote sections carry a "+" to launch/connect a new one, so
// they stay visible even with zero members — otherwise that action would have
// nowhere to live. A physical USB device only ever appears by being plugged
// in, so its section has nothing to add and disappears when it's empty.
const ALWAYS_VISIBLE: ReadonlySet<DeviceGroupId> = new Set(["emulator", "remote"]);

/** Groups devices for the picker. */
export function groupDevices(devices: ADBDevice[]): DeviceGroup[] {
  return GROUP_ORDER.map(({ id, label }) => ({
    id,
    label,
    devices: devices.filter((device) => deviceGroupOf(device) === id),
  })).filter((group) => group.devices.length > 0 || ALWAYS_VISIBLE.has(group.id));
}
