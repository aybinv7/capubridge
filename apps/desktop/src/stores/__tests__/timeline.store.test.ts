import { beforeEach, describe, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useTimelineStore } from "../timeline.store";

const BASE = 1_730_000_000_000;

describe("timeline store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("converts device times with the device's measured offset and keeps it for display", () => {
    const store = useTimelineStore();
    store.setClockOffset("emulator-5554", { offsetMs: 3_000, rttMs: 15, measuredAtMs: BASE });
    expect(store.toHostMs("emulator-5554", BASE + 3_000)).toBe(BASE);
    expect(store.toHostMs("other", BASE)).toBe(BASE);
    expect(store.toHostMs(null, BASE)).toBe(BASE);
    expect(store.clockOffsets["emulator-5554"]?.offsetMs).toBe(3_000);
    store.setClockOffset("emulator-5554", null);
    expect(store.clockOffsets["emulator-5554"]).toBeUndefined();
  });

  test("bumps its version once per batch of kept markers", () => {
    const store = useTimelineStore();
    const kept = store.pushMany([
      { t: BASE, lane: "console", severity: "info", ref: { kind: "console", id: "a" }, label: "a" },
      {
        t: BASE + 1,
        lane: "errors",
        severity: "error",
        ref: { kind: "console", id: "a" },
        label: "a",
      },
    ]);
    expect(kept).toBe(2);
    expect(store.version).toBe(1);
    expect(store.ring.size).toBe(2);
  });

  test("tracks recording ranges and hairlines, and ages them out", () => {
    const store = useTimelineStore();
    const range = store.beginRange("recording", BASE, "Recording");
    store.addHairline("navigation", BASE + 5, "https://app.example.com/cart");
    store.endRange(range, BASE + 60_000);
    expect(store.overlays.map((overlay) => [overlay.kind, overlay.end])).toEqual([
      ["recording", BASE + 60_000],
      ["navigation", BASE + 5],
    ]);
    store.ageOut(BASE + 12 * 60_000);
    expect(store.overlays).toEqual([]);
  });
});
