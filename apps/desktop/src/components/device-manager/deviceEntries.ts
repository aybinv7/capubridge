import type { ADBDevice } from "@/types/adb.types";
/** A handset not seen for longer than this folds into "Earlier connections". */
export const RECENT_HISTORY_MS = 24 * 60 * 60 * 1000;

/** One handset, however many ADB connections reached it. */
export interface DeviceEntry {
  /** The connection the row acts on: a live one first, USB before Wi-Fi, else the latest seen. */
  device: ADBDevice;
  /** Every connection of this handset, the primary included. */
  connections: ADBDevice[];
}

export interface DeviceList {
  live: DeviceEntry[];
  recent: DeviceEntry[];
  earlier: DeviceEntry[];
}

function liveRank(device: ADBDevice): number {
  if (device.isStale) return 3;
  if (device.status !== "online") return 2;
  return device.connectionType === "usb" ? 0 : 1;
}

function pickPrimary(connections: ADBDevice[]): ADBDevice {
  return [...connections].sort(
    (a, b) => liveRank(a) - liveRank(b) || (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0),
  )[0];
}

function lookalikeKey(device: ADBDevice): string {
  return `${device.model}|${device.product}`;
}

/**
 * Folds the connections of one handset into a single entry. Connections that reported the same
 * hardware serial are one handset. A connection whose serial was never learned joins a handset
 * only when exactly one known handset has its model and product, so two identical test phones
 * are never merged by guesswork; unknown look-alikes with no known handset fold together.
 */
export function mergeDeviceConnections(
  devices: readonly ADBDevice[],
  hardwareOf: (device: ADBDevice) => string | null,
): DeviceEntry[] {
  const byHardware = new Map<string, ADBDevice[]>();
  const unknown: ADBDevice[] = [];
  for (const device of devices) {
    const hardware = hardwareOf(device);
    if (hardware === null) {
      unknown.push(device);
      continue;
    }
    const group = byHardware.get(hardware);
    if (group) group.push(device);
    else byHardware.set(hardware, [device]);
  }

  const knownByLook = new Map<string, string[]>();
  for (const [hardware, group] of byHardware) {
    const key = lookalikeKey(group[0]);
    knownByLook.set(key, [...(knownByLook.get(key) ?? []), hardware]);
  }

  const orphans = new Map<string, ADBDevice[]>();
  for (const device of unknown) {
    const key = lookalikeKey(device);
    const candidates = knownByLook.get(key) ?? [];
    if (candidates.length === 1) {
      byHardware.get(candidates[0])?.push(device);
      continue;
    }
    if (candidates.length > 1) {
      orphans.set(device.serial, [device]);
      continue;
    }
    orphans.set(key, [...(orphans.get(key) ?? []), device]);
  }

  return [...byHardware.values(), ...orphans.values()].map((connections) => ({
    device: pickPrimary(connections),
    connections,
  }));
}

/**
 * Orders the list without headings: live handsets first, then those seen in the last day, then
 * older ones, which the picker folds away.
 */
export function arrangeDeviceList(entries: readonly DeviceEntry[], now = Date.now()): DeviceList {
  const list: DeviceList = { live: [], recent: [], earlier: [] };
  for (const entry of entries) {
    const primary = entry.device;
    if (!primary.isStale) list.live.push(entry);
    else if (primary.lastSeenAt != null && now - primary.lastSeenAt < RECENT_HISTORY_MS) {
      list.recent.push(entry);
    } else list.earlier.push(entry);
  }
  const latest = (a: DeviceEntry, b: DeviceEntry) =>
    (b.device.lastSeenAt ?? 0) - (a.device.lastSeenAt ?? 0);
  list.live.sort((a, b) => liveRank(a.device) - liveRank(b.device));
  list.recent.sort(latest);
  list.earlier.sort(latest);
  return list;
}

/** "USB", "Wi-Fi", "USB and Wi-Fi" or "Emulator": how this handset reaches Capubridge. */
export function connectionSummary(entry: DeviceEntry): string {
  if (entry.device.deviceKind === "emulator") return "Emulator";
  const kinds = new Set(entry.connections.map((device) => device.connectionType));
  if (kinds.has("usb") && kinds.has("wifi")) return "USB and Wi-Fi";
  return kinds.has("usb") ? "USB" : "Wi-Fi";
}
