import { describe, expect, test } from "vite-plus/test";
import { logLevel } from "../logLevels";

describe("logLevel", () => {
  test("reads logcat's level letter in threadtime format", () => {
    expect(logLevel("11-05 10:12:01.123  1234  1250 E Capacitor: boom")).toBe("error");
    expect(logLevel("11-05 10:12:01.123  1234  1250 W chromium: slow")).toBe("warn");
    expect(logLevel("11-05 10:12:01.123  1234  1250 I ActivityManager: start")).toBe("info");
    expect(logLevel("11-05 10:12:01.123  1234  1250 V Tag: noise")).toBe("debug");
  });

  test("reads logcat's brief format", () => {
    expect(logLevel("E/AndroidRuntime( 1234): FATAL EXCEPTION")).toBe("error");
    expect(logLevel("D/Tag: details")).toBe("debug");
  });

  test("falls back to level words near the start", () => {
    expect(logLevel("2026-11-05T10:00:00Z [ERROR] sync failed")).toBe("error");
    expect(logLevel("level=warning msg=retry")).toBe("warn");
    expect(logLevel("plain line without a level")).toBeNull();
    expect(logLevel("terror is not a level")).toBeNull();
  });
});
