import { describe, expect, it } from "vite-plus/test";
import { formatLogcatLine, logcatClockLabels, toLogcatEntry } from "@/lib/logcat/logcatEntry";
import type { LogcatLinePayload } from "@/types/logcat.types";

function line(overrides: Partial<LogcatLinePayload> = {}): LogcatLinePayload {
  return {
    seq: 7,
    tsMs: new Date(2026, 10, 6, 9, 5, 3, 42).getTime(),
    uid: 10145,
    pid: 4321,
    tid: 4322,
    level: "E",
    tag: "App",
    message: "first\n  second",
    processName: "com.example.shop",
    packageName: "com.example.shop",
    ...overrides,
  };
}

describe("logcat entries", () => {
  it("labels the time in host local time with milliseconds", () => {
    expect(logcatClockLabels(new Date(2026, 0, 2, 3, 4, 5, 6).getTime())).toEqual({
      date: "01-02",
      time: "03:04:05.006",
    });
  });

  it("keeps every field and gives each line a unique id", () => {
    const entry = toLogcatEntry("emulator-5554", line());
    expect(entry.id).toBe("emulator-5554:7");
    expect(entry.time).toBe("09:05:03.042");
    expect(entry.message).toBe("first\n  second");
    expect(entry.uid).toBe(10145);
  });

  it("exports one threadtime line per message line, spacing kept", () => {
    const text = formatLogcatLine(toLogcatEntry("emulator-5554", line()));
    expect(text.split("\n")).toEqual([
      "11-06 09:05:03.042  4321  4322 E App     : first",
      "11-06 09:05:03.042  4321  4322 E App     :   second",
    ]);
  });
});
