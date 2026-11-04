import { describe, expect, it } from "vite-plus/test";
import type { ADBDevice } from "@/types/adb.types";
import { RECENT_HISTORY_MS, deviceGroupOf, groupDevices } from "../deviceGroups";

const NOW = 1_800_000_000_000;

function device(serial: string, overrides: Partial<ADBDevice> = {}): ADBDevice {
  return {
    serial,
    model: serial,
    product: serial,
    transportId: "1",
    deviceKind: "physical",
    connectionType: "usb",
    status: "online",
    ...overrides,
  };
}

function seen(msAgo: number): Partial<ADBDevice> {
  return { isStale: true, lastSeenAt: NOW - msAgo };
}

describe("deviceGroupOf", () => {
  it("files an emulator under emulators even though it reaches ADB like USB", () => {
    expect(deviceGroupOf(device("emulator-5554", { deviceKind: "emulator" }), NOW)).toBe(
      "emulator",
    );
  });

  it("files a Wi-Fi device under Wi-Fi", () => {
    expect(deviceGroupOf(device("10.0.0.2:5555", { connectionType: "wifi" }), NOW)).toBe("remote");
  });

  it("files a device seen within the last day under not connected", () => {
    expect(
      deviceGroupOf(device("emulator-5554", { deviceKind: "emulator", ...seen(60_000) }), NOW),
    ).toBe("remembered");
  });

  it("folds a device last seen a day or more ago into earlier connections", () => {
    expect(deviceGroupOf(device("old", seen(RECENT_HISTORY_MS)), NOW)).toBe("earlier");
    expect(deviceGroupOf(device("older", seen(RECENT_HISTORY_MS * 20)), NOW)).toBe("earlier");
  });

  it("treats a remembered device that was never seen as earlier history", () => {
    expect(deviceGroupOf(device("ghost", { isStale: true }), NOW)).toBe("earlier");
  });
});

describe("groupDevices", () => {
  it("orders live groups, then recent and earlier history, and drops empty groups", () => {
    const groups = groupDevices(
      [
        device("emulator-5554", { deviceKind: "emulator" }),
        device("old", seen(RECENT_HISTORY_MS * 15)),
        device("recent", seen(3_600_000)),
        device("R58"),
      ],
      NOW,
    );
    expect(
      groups.map((group) => [
        group.label,
        group.devices.map((entry) => entry.serial),
        group.history,
        group.collapsible,
      ]),
    ).toEqual([
      ["USB", ["R58"], false, false],
      ["Emulators", ["emulator-5554"], false, false],
      ["Not connected", ["recent"], true, false],
      ["Earlier connections", ["old"], true, true],
    ]);
  });

  it("lists history most recently seen first", () => {
    const groups = groupDevices(
      [
        device("a", seen(RECENT_HISTORY_MS * 3)),
        device("b", seen(RECENT_HISTORY_MS * 2)),
        device("c", { isStale: true }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].devices.map((entry) => entry.serial)).toEqual(["b", "a", "c"]);
  });

  it("returns nothing when there are no devices", () => {
    expect(groupDevices([], NOW)).toEqual([]);
  });
});
