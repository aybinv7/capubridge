import { describe, expect, it } from "vite-plus/test";
import type { ADBDevice } from "@/types/adb.types";
import { describeDeviceState, deviceCondition, deviceDisplayName, formatAgo } from "../deviceState";

function device(overrides: Partial<ADBDevice> = {}): ADBDevice {
  return {
    serial: "R58N12345",
    model: "Pixel 8",
    product: "shiba",
    transportId: "1",
    deviceKind: "physical",
    connectionType: "usb",
    status: "online",
    ...overrides,
  };
}

describe("deviceCondition", () => {
  it("a remembered device is absent whatever its last status", () => {
    expect(deviceCondition(device({ isStale: true, status: "online" }))).toBe("absent");
  });

  it.each([
    ["online", "online"],
    ["unauthorized", "unauthorized"],
    ["no-permissions", "no-permissions"],
    ["offline", "offline"],
  ] as const)("%s maps to %s", (status, condition) => {
    expect(deviceCondition(device({ status }))).toBe(condition);
  });
});

describe("describeDeviceState", () => {
  it("an online device has no title and no steps", () => {
    expect(describeDeviceState(device())).toMatchObject({
      label: "Online",
      dotColor: "green",
      title: null,
      steps: [],
    });
  });

  it("an unauthorised device names the prompt to accept", () => {
    const state = describeDeviceState(device({ status: "unauthorized" }));
    expect(state.title).toBe("Pixel 8 does not trust this computer yet");
    expect(state.steps.join(" ")).toMatch(/Allow USB debugging/);
  });

  it("an offline device says ADB cannot reach it", () => {
    const state = describeDeviceState(device({ status: "offline" }));
    expect(state).toMatchObject({ label: "Offline", dotColor: "red" });
    expect(state.title).toBe("ADB lists Pixel 8 but cannot reach it");
  });

  it("an absent device says when it was last seen and how to bring it back", () => {
    const state = describeDeviceState(
      device({ isStale: true, lastSeenAt: 1_000 }),
      1_000 + 3 * 3_600_000,
    );
    expect(state).toMatchObject({ label: "Seen 3 h ago", dotVariant: "hollow" });
    expect(state.steps).toEqual(["Plug in the cable and unlock the device."]);
  });

  it("an absent emulator points at the emulator list", () => {
    const state = describeDeviceState(device({ isStale: true, deviceKind: "emulator" }));
    expect(state.label).toBe("Not connected");
    expect(state.steps[0]).toMatch(/Emulators/);
  });

  it("an absent Wi-Fi device points at the network and the connect form", () => {
    const state = describeDeviceState(device({ isStale: true, connectionType: "wifi" }));
    expect(state.steps).toHaveLength(2);
    expect(state.steps[1]).toMatch(/Connect a device/);
  });
});

describe("deviceDisplayName", () => {
  it("falls back to the serial when the model is blank", () => {
    expect(deviceDisplayName({ model: "  ", serial: "emulator-5554" })).toBe("emulator-5554");
  });
});

describe("formatAgo", () => {
  it.each([
    [30_000, "just now"],
    [4 * 60_000, "4 min ago"],
    [2 * 3_600_000, "2 h ago"],
    [50 * 3_600_000, "2 d ago"],
    [-5, "just now"],
  ])("%i ms reads %s", (ms, text) => {
    expect(formatAgo(ms)).toBe(text);
  });
});
