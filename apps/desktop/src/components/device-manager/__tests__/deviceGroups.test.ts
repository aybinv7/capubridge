import { describe, expect, it } from "vite-plus/test";
import type { ADBDevice } from "@/types/adb.types";
import { deviceGroupOf, groupDevices } from "../deviceGroups";

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

describe("deviceGroupOf", () => {
  it("files an emulator under emulators even though it reaches ADB like USB", () => {
    expect(deviceGroupOf(device("emulator-5554", { deviceKind: "emulator" }))).toBe("emulator");
  });

  it("files a Wi-Fi device under Wi-Fi", () => {
    expect(deviceGroupOf(device("10.0.0.2:5555", { connectionType: "wifi" }))).toBe("remote");
  });

  it("files any remembered device under not connected", () => {
    expect(deviceGroupOf(device("emulator-5554", { deviceKind: "emulator", isStale: true }))).toBe(
      "remembered",
    );
  });
});

describe("groupDevices", () => {
  it("orders USB, Wi-Fi, emulators, then not connected, and drops empty groups", () => {
    const groups = groupDevices([
      device("emulator-5554", { deviceKind: "emulator" }),
      device("old", { isStale: true }),
      device("R58"),
    ]);
    expect(
      groups.map((group) => [group.label, group.devices.map((entry) => entry.serial)]),
    ).toEqual([
      ["USB", ["R58"]],
      ["Emulators", ["emulator-5554"]],
      ["Not connected", ["old"]],
    ]);
  });

  it("lists remembered devices most recently seen first", () => {
    const groups = groupDevices([
      device("a", { isStale: true, lastSeenAt: 10 }),
      device("b", { isStale: true, lastSeenAt: 30 }),
      device("c", { isStale: true }),
    ]);
    expect(groups[0].devices.map((entry) => entry.serial)).toEqual(["b", "a", "c"]);
  });

  it("returns nothing when there are no devices", () => {
    expect(groupDevices([])).toEqual([]);
  });
});
