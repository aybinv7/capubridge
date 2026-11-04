import type { ADBDevice } from "@/types/adb.types";

export type DeviceGroupId = "physical" | "remote" | "emulator" | "remembered" | "earlier";

export interface DeviceGroup {
  id: DeviceGroupId;
  label: string;
  devices: ADBDevice[];
  /** History groups sit below This computer; live groups above it. */
  history: boolean;
  /** Folded until the user opens it, so old history never pushes live sources out of view. */
  collapsible: boolean;
}

/** A device not seen for longer than this moves from "Not connected" to "Earlier connections". */
export const RECENT_HISTORY_MS = 24 * 60 * 60 * 1000;

const GROUP_ORDER: Array<{ id: DeviceGroupId; label: string }> = [
  { id: "physical", label: "USB" },
  { id: "remote", label: "Wi-Fi" },
  { id: "emulator", label: "Emulators" },
  { id: "remembered", label: "Not connected" },
  { id: "earlier", label: "Earlier connections" },
];

const HISTORY_GROUPS = new Set<DeviceGroupId>(["remembered", "earlier"]);

/**
 * A remembered device ADB no longer lists goes under "Not connected" when it was seen within the
 * last day, and under "Earlier connections" otherwise (or when it was never seen at all).
 * An emulator is classified by what it is, not how it is attached: it reaches ADB over USB like a
 * cabled handset, so checking the transport first would file it under the wrong heading.
 */
export function deviceGroupOf(device: ADBDevice, now = Date.now()): DeviceGroupId {
  if (device.isStale) {
    const seenAt = device.lastSeenAt ?? null;
    return seenAt !== null && now - seenAt < RECENT_HISTORY_MS ? "remembered" : "earlier";
  }
  if (device.deviceKind === "emulator") return "emulator";
  return device.connectionType === "wifi" ? "remote" : "physical";
}

/**
 * Groups devices for the picker; empty groups are dropped. Connecting over Wi-Fi and starting an
 * emulator live in the picker footer, so no group has to stay visible to host its action.
 * History is ordered most recently seen first.
 */
export function groupDevices(devices: ADBDevice[], now = Date.now()): DeviceGroup[] {
  return GROUP_ORDER.map(({ id, label }) => {
    const members = devices.filter((device) => deviceGroupOf(device, now) === id);
    if (HISTORY_GROUPS.has(id)) {
      members.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
    }
    return {
      id,
      label,
      devices: members,
      history: HISTORY_GROUPS.has(id),
      collapsible: id === "earlier",
    };
  }).filter((group) => group.devices.length > 0);
}
