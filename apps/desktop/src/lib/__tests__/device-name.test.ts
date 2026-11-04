import { describe, expect, it } from "vite-plus/test";
import { deviceIdentity, friendlyDeviceName } from "../device-name";

describe("friendlyDeviceName", () => {
  it("puts the maker before a handset model", () => {
    expect(friendlyDeviceName({ model: "24117RN76G", serial: "r4g" }, "Xiaomi")).toBe(
      "Xiaomi 24117RN76G",
    );
  });

  it("reads underscores from adb as spaces and capitalises a lower-case maker", () => {
    expect(friendlyDeviceName({ model: "Galaxy_S24", serial: "R58" }, "samsung")).toBe(
      "Samsung Galaxy S24",
    );
  });

  it("does not repeat a maker the model already starts with", () => {
    expect(friendlyDeviceName({ model: "Pixel_8", serial: "1A" }, "Google")).toBe("Google Pixel 8");
    expect(friendlyDeviceName({ model: "Xiaomi_13", serial: "1A" }, "Xiaomi")).toBe("Xiaomi 13");
  });

  it("keeps an emulator's system image name as it is", () => {
    expect(
      friendlyDeviceName(
        { model: "sdk_gphone16k_x86_64", serial: "emulator-5554", deviceKind: "emulator" },
        "Google",
      ),
    ).toBe("sdk_gphone16k_x86_64");
  });

  it("falls back to the model without a maker and to the serial without a model", () => {
    expect(friendlyDeviceName({ model: "RMX3941", serial: "MVK" })).toBe("RMX3941");
    expect(friendlyDeviceName({ model: "RMX3941", serial: "MVK" }, "unknown")).toBe("RMX3941");
    expect(friendlyDeviceName({ model: "  ", serial: "emulator-5554" }, "Google")).toBe(
      "emulator-5554",
    );
  });
});

describe("deviceIdentity", () => {
  it("shows a Wi-Fi device's address without the port", () => {
    expect(deviceIdentity({ serial: "10.241.124.199:5555", connectionType: "wifi" })).toBe(
      "10.241.124.199",
    );
  });

  it("shows the serial otherwise", () => {
    expect(deviceIdentity({ serial: "r4geda5p7d65u8uo", connectionType: "usb" })).toBe(
      "r4geda5p7d65u8uo",
    );
    expect(
      deviceIdentity({ serial: "adb-XYZ._adb-tls-connect._tcp", connectionType: "wifi" }),
    ).toBe("adb-XYZ._adb-tls-connect._tcp");
  });
});
