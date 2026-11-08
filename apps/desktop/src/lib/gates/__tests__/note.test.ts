import { describe, expect, test } from "vite-plus/test";
import { gateNote } from "../note";
import type { GateInput } from "../types";

const base: GateInput = {
  adb: "running",
  onlineDevices: 0,
  device: null,
  target: null,
  link: "none",
  linkError: null,
  presence: "foreground",
};

const device: NonNullable<GateInput["device"]> = {
  serial: "S1",
  model: "Pixel",
  status: "online",
  isStale: false,
};

describe("gateNote", () => {
  test("says nothing for a screen that needs nothing", () => {
    expect(gateNote("none", base)).toBeNull();
  });

  test("a device screen without a device needs a device", () => {
    expect(gateNote("device", base)).toBe("needs a device");
  });

  test("a target screen with a device but no target needs a WebView", () => {
    expect(gateNote("target", { ...base, device })).toBe("needs a WebView");
  });

  test("an app screen with no target needs an app", () => {
    expect(gateNote("app-target", { ...base, device })).toBe("needs an app");
  });

  test("opens when the target is connected", () => {
    const connected: GateInput = {
      ...base,
      device,
      link: "connected",
      target: { id: "t", source: "adb", title: "Page", packageName: "com.a.b" },
    };
    expect(gateNote("target", connected)).toBeNull();
  });
});
