import { describe, expect, test } from "vite-plus/test";
import { formatDateWords, installDateWords, parseDeviceDate, updateDateWords } from "../dates";

const NOW = new Date(2026, 10, 5, 17, 0).getTime();

describe("device dates", () => {
  test("reads toybox, dumpsys and busybox dates, and treats the epoch as unknown", () => {
    expect(parseDeviceDate("2026-11-03 13:46", NOW)).toBe(new Date(2026, 10, 3, 13, 46).getTime());
    expect(parseDeviceDate("2024-05-03 11:22:33", NOW)).toBe(
      new Date(2024, 4, 3, 11, 22, 33).getTime(),
    );
    expect(parseDeviceDate("Nov  2 09:15", NOW)).toBe(new Date(2026, 10, 2, 9, 15).getTime());
    expect(parseDeviceDate("1970-01-01 00:00", NOW)).toBeNull();
    expect(parseDeviceDate("", NOW)).toBeNull();
    expect(parseDeviceDate("—", NOW)).toBeNull();
  });

  test("says today and yesterday, drops the year only for this year", () => {
    expect(formatDateWords(new Date(2026, 10, 5, 9, 5).getTime(), NOW)).toBe("Today at 09:05");
    expect(formatDateWords(new Date(2026, 10, 4, 23, 10).getTime(), NOW)).toBe(
      "Yesterday at 23:10",
    );
    expect(formatDateWords(new Date(2026, 2, 1).getTime(), NOW)).not.toMatch(/2026/);
    expect(formatDateWords(new Date(2024, 2, 1).getTime(), NOW)).toMatch(/2024/);
  });

  test("apps from the system image came with the phone; updates only when after install", () => {
    expect(installDateWords("2009-01-01 08:00:00", NOW)).toBe("Came with the phone");
    expect(installDateWords("2026-11-05 10:00:00", NOW)).toBe("Today at 10:00");
    expect(updateDateWords("2009-01-01 08:00:00", "2009-01-01 08:00:00", NOW)).toBeNull();
    expect(updateDateWords("2026-11-01 10:00:00", "2026-10-01 10:00:00", NOW)).toBeNull();
    expect(updateDateWords("2009-01-01 08:00:00", "2026-11-05 12:30:00", NOW)).toBe(
      "Today at 12:30",
    );
  });
});
