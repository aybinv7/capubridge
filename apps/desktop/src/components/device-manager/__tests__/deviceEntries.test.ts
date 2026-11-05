import { describe, expect, it } from "vite-plus/test";
import type { ADBDevice } from "@/types/adb.types";
import { arrangeDeviceList, connectionSummary, mergeDeviceConnections } from "../deviceEntries";

function device(serial: string, overrides: Partial<ADBDevice> = {}): ADBDevice {
  return {
    serial,
    model: "24117RN76G",
    product: "tanzanite_global",
    transportId: "1",
    deviceKind: "physical",
    connectionType: serial.includes(":") ? "wifi" : "usb",
    status: "online",
    ...overrides,
  };
}

const NOW = 1_000_000_000;

describe("mergeDeviceConnections", () => {
  it("shows one handset for its USB serial and every Wi-Fi address it reported", () => {
    const usb = device("r4ge");
    const wifi = device("10.0.0.5:5555", { isStale: true, lastSeenAt: NOW - 60_000 });
    const entries = mergeDeviceConnections([wifi, usb], (entry) =>
      entry === wifi ? "r4ge" : entry.serial,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].device).toBe(usb);
    expect(connectionSummary(entries[0])).toBe("USB and Wi-Fi");
  });

  it("joins an unknown address to the only handset of that model", () => {
    const usb = device("r4ge");
    const oldWifi = device("10.0.0.9:5555", { isStale: true, lastSeenAt: NOW - 3_600_000 });
    const entries = mergeDeviceConnections([usb, oldWifi], (entry) =>
      entry === oldWifi ? null : entry.serial,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].connections).toHaveLength(2);
  });

  it("never guesses between two identical test phones", () => {
    const first = device("aaaa");
    const second = device("bbbb");
    const unknown = device("10.0.0.7:5555", { isStale: true, lastSeenAt: NOW - 1000 });
    const entries = mergeDeviceConnections([first, second, unknown], (entry) =>
      entry === unknown ? null : entry.serial,
    );
    expect(entries).toHaveLength(3);
  });

  it("keeps different models and emulators apart", () => {
    const phone = device("r4ge");
    const emulator = device("emulator-5554", {
      deviceKind: "emulator",
      model: "sdk_gphone16k_x86_64",
      product: "sdk",
    });
    const entries = mergeDeviceConnections([phone, emulator], (entry) => entry.serial);
    expect(entries).toHaveLength(2);
  });
});

describe("arrangeDeviceList", () => {
  it("puts live handsets first, then the last day, then older history", () => {
    const live = { device: device("r4ge"), connections: [] };
    const recent = {
      device: device("x:1", { isStale: true, lastSeenAt: NOW - 3_600_000 }),
      connections: [],
    };
    const old = {
      device: device("y:1", { isStale: true, lastSeenAt: NOW - 3 * 86_400_000 }),
      connections: [],
    };
    const list = arrangeDeviceList([old, recent, live], NOW);
    expect(list.live).toEqual([live]);
    expect(list.recent).toEqual([recent]);
    expect(list.earlier).toEqual([old]);
  });
});
