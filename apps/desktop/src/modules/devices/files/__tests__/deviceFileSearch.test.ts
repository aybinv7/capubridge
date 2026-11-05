import { describe, expect, test } from "vite-plus/test";
import {
  DEVICE_SEARCH_MIN_CHARS,
  deviceSearchCommand,
  parseDeviceSearch,
} from "../deviceFileSearch";

describe("deviceFileSearch", () => {
  test("walks the usual places under one ten second limit, capped and typed", () => {
    const command = deviceSearchCommand("log", 180) ?? "";
    expect(command.startsWith(`timeout 10 sh -c "find /sdcard/Android/data -iname '*log*'`)).toBe(
      true,
    );
    expect(command).toContain("find /vendor -maxdepth 6 -iname '*log*' 2>/dev/null; \" | awk");
    expect(command).toContain("| head -n 180 ");
    expect(DEVICE_SEARCH_MIN_CHARS).toBe(3);
  });

  test("escapes glob characters and quotes", () => {
    expect(deviceSearchCommand("a*b'c")).toContain(`-iname '*a\\\\*b'\\\\''c*'`);
    expect(deviceSearchCommand("   ")).toBeNull();
  });

  test("parses typed lines, drops repeats and puts folders first", () => {
    const entries = parseDeviceSearch(
      "file\t/sdcard/b.log\ndir\t/sdcard/logs/\nfile\t/sdcard/b.log\nweird\t/x/a.log\n\n",
    );
    expect(entries.map((entry) => [entry.entryType, entry.path])).toEqual([
      ["dir", "/sdcard/logs"],
      ["other", "/x/a.log"],
      ["file", "/sdcard/b.log"],
    ]);
    expect(entries[0]?.name).toBe("logs");
  });
});
