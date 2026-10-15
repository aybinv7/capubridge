import { describe, expect, test } from "vite-plus/test";
import { describeSessionOrigin } from "../replaySessionOrigin";

describe("describeSessionOrigin", () => {
  test("returns nothing for a Capubridge-recorded manifest", () => {
    expect(describeSessionOrigin({})).toEqual({ producer: null, device: null });
  });

  test("labels the producer when present", () => {
    expect(
      describeSessionOrigin({
        producer: { name: "@cavulsqa/recorder", version: "0.1.0", platform: "android" },
      }),
    ).toEqual({ producer: "@cavulsqa/recorder 0.1.0", device: null });
  });

  test("labels the device from the non-null fields only", () => {
    expect(
      describeSessionOrigin({
        device: {
          model: "Pixel 7",
          osVersion: "14",
          webviewVersion: null,
          appId: "com.example.app",
          appVersion: null,
        },
      }).device,
    ).toBe("Pixel 7 · Android 14");
  });

  test("drops a device block whose fields are all null", () => {
    expect(
      describeSessionOrigin({
        device: {
          model: null,
          osVersion: null,
          webviewVersion: null,
          appId: null,
          appVersion: null,
        },
      }).device,
    ).toBeNull();
  });
});
