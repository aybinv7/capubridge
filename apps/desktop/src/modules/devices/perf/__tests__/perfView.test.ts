import { describe, expect, test } from "vite-plus/test";
import {
  STALE_AFTER_MS,
  batteryTone,
  hasPerfReadings,
  loadTone,
  memoryTone,
  perfPhase,
  sampledSince,
  type PerfPhaseInput,
} from "../perfView";

const live: PerfPhaseInput = {
  error: null,
  paused: false,
  offline: false,
  active: true,
  isRunning: true,
  firstSampleOverdue: false,
  sampledSinceStart: true,
  sinceLastSampleMs: 400,
};

describe("perfPhase", () => {
  test("readings arriving while the monitor runs are live, not waiting", () => {
    expect(perfPhase(live)).toBe("live");
    expect(hasPerfReadings(12, null)).toBe(true);
  });

  test("waits honestly until the first reading of this run, then says it is overdue", () => {
    const fresh = { ...live, sampledSinceStart: false, sinceLastSampleMs: null };
    expect(perfPhase(fresh)).toBe("waiting");
    expect(perfPhase({ ...fresh, firstSampleOverdue: true })).toBe("overdue");
    expect(hasPerfReadings(0, null)).toBe(false);
  });

  test("readings that stopped coming while running are stale", () => {
    expect(perfPhase({ ...live, sinceLastSampleMs: STALE_AFTER_MS + 1 })).toBe("stale");
  });

  test("coming back from another tab or a hidden window is starting, never stale", () => {
    const old = { ...live, sinceLastSampleMs: 60_000 };
    expect(perfPhase({ ...old, active: false, isRunning: false })).toBe("starting");
    expect(perfPhase({ ...old, isRunning: false })).toBe("starting");
    expect(perfPhase({ ...old, sampledSinceStart: false })).toBe("waiting");
  });

  test("an offline phone is offline, not paused or starting", () => {
    expect(perfPhase({ ...live, offline: true, active: false, isRunning: false })).toBe("offline");
  });

  test("an error wins, then a pause, then offline", () => {
    expect(perfPhase({ ...live, error: "device-not-active", paused: true })).toBe("error");
    expect(perfPhase({ ...live, paused: true, offline: true })).toBe("paused");
  });

  test("a reading belongs to the run that started at or before it", () => {
    expect(sampledSince(2000, 1000)).toBe(true);
    expect(sampledSince(500, 1000)).toBe(false);
    expect(sampledSince(null, 1000)).toBe(false);
    expect(sampledSince(2000, null)).toBe(false);
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
