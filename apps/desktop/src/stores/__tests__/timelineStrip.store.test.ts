import { beforeEach, describe, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useTimelineStripStore } from "../timelineStrip.store";
import { useTimelineStore } from "../timeline.store";
import { installMemoryStorage } from "@/test/memory-storage";

const KEY = "capubridge:timeline-strip";

describe("timeline strip store", () => {
  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
  });

  test("starts visible on the 5 minute window with every lane on", () => {
    const strip = useTimelineStripStore();
    expect(strip.hidden).toBe(false);
    expect(strip.span).toBe("5m");
    expect(strip.windowMs).toBe(300_000);
    expect(strip.mutedLanes).toEqual([]);
  });

  test("sits at the bottom by default, moves to the top, and remembers it", () => {
    const first = useTimelineStripStore();
    expect(first.edge).toBe("bottom");
    first.setEdge("top");
    setActivePinia(createPinia());
    expect(useTimelineStripStore().edge).toBe("top");
  });

  test("keeps older saved choices that have no edge", () => {
    localStorage.setItem(KEY, JSON.stringify({ hidden: true, window: "1m", mutedLanes: [] }));
    const strip = useTimelineStripStore();
    expect(strip.hidden).toBe(true);
    expect(strip.edge).toBe("bottom");
  });

  test("mutes and restores a lane, keeping lane order, and persists it", () => {
    const strip = useTimelineStripStore();
    strip.toggleLane("logcat");
    strip.toggleLane("network");
    expect(strip.mutedLanes).toEqual(["network", "logcat"]);
    expect(strip.isLaneMuted("network")).toBe(true);
    strip.toggleLane("network");
    expect(strip.mutedLanes).toEqual(["logcat"]);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toMatchObject({ mutedLanes: ["logcat"] });
  });

  test("restores the window, the hidden state and the muted lanes on the next start", () => {
    const first = useTimelineStripStore();
    first.setWindow("15m");
    first.toggleHidden();
    first.toggleLane("errors");
    setActivePinia(createPinia());
    const next = useTimelineStripStore();
    expect(next.span).toBe("15m");
    expect(next.windowMs).toBe(900_000);
    expect(next.hidden).toBe(true);
    expect(next.mutedLanes).toEqual(["errors"]);
  });

  test("falls back to the defaults when the saved value is unreadable", () => {
    localStorage.setItem(KEY, JSON.stringify({ hidden: "yes", window: "2h", mutedLanes: [] }));
    const strip = useTimelineStripStore();
    expect(strip.hidden).toBe(false);
    expect(strip.span).toBe("5m");
  });

  test("the timeline restarts its complete-since time when it is cleared", () => {
    const timeline = useTimelineStore();
    const before = timeline.collectingSince;
    expect(before).toBeLessThanOrEqual(Date.now());
    timeline.clear();
    expect(timeline.collectingSince).toBeGreaterThanOrEqual(before);
  });
});
