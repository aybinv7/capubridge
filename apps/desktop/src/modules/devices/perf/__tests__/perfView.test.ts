import { describe, expect, test } from "vite-plus/test";
import {
  STALE_AFTER_MS,
  batteryTone,
  hasPerfReadings,
  loadTone,
  memoryTone,
  perfPhase,
  type PerfPhaseInput,
} from "../perfView";

const running: PerfPhaseInput = {
  error: null,
  paused: false,
  isRunning: true,
  tickCount: 0,
  firstSampleOverdue: false,
  sinceLastSampleMs: null,
};

describe("perfPhase", () => {
  test("readings arriving while the monitor runs are live, not waiting", () => {
    expect(perfPhase({ ...running, tickCount: 12, sinceLastSampleMs: 400 })).toBe("live");
    expect(hasPerfReadings(12, null)).toBe(true);
  });

  test("waits honestly until the first reading, then says it is overdue", () => {
    expect(perfPhase(running)).toBe("waiting");
    expect(perfPhase({ ...running, firstSampleOverdue: true })).toBe("overdue");
    expect(hasPerfReadings(0, null)).toBe(false);
  });

  test("readings that stopped coming are stale", () => {
    expect(perfPhase({ ...running, tickCount: 3, sinceLastSampleMs: STALE_AFTER_MS + 1 })).toBe(
      "stale",
    );
  });

  test("an error wins, a pause comes next, and nothing started yet is starting", () => {
    expect(perfPhase({ ...running, tickCount: 5, error: "device-not-active" })).toBe("error");
    expect(perfPhase({ ...running, tickCount: 5, paused: true })).toBe("paused");
    expect(perfPhase({ ...running, isRunning: false })).toBe("starting");
    expect(perfPhase({ ...running, isRunning: false, tickCount: 4 })).toBe("paused");
  });

  test("WebView readings alone are enough to show the charts", () => {
    expect(hasPerfReadings(0, Date.now())).toBe(true);
  });
});

describe("reading tones", () => {
  test("load is plain until it is high, battery until it is low", () => {
    expect(loadTone(null)).toBe("text-muted-foreground");
    expect(loadTone(42)).toBe("text-foreground");
    expect(loadTone(65)).toBe("text-warning");
    expect(loadTone(91)).toBe("text-error");
    expect(memoryTone(62)).toBe("text-foreground");
    expect(memoryTone(90)).toBe("text-warning");
    expect(batteryTone(15)).toBe("text-error");
    expect(batteryTone(35)).toBe("text-warning");
    expect(batteryTone(90)).toBe("text-foreground");
  });
});
