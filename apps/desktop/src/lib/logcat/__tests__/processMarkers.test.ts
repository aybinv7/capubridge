import { describe, expect, it } from "vite-plus/test";
import { createProcessTracker } from "@/lib/logcat/processMarkers";
import type { LogcatEntry } from "@/types/logcat.types";

let seq = 0;

function line(pid: number, packageName = "com.shop.app"): LogcatEntry {
  seq += 1;
  return {
    id: `s:${seq}`,
    seq,
    serial: "s",
    tsMs: seq,
    date: "",
    time: "",
    uid: 10_100,
    pid,
    tid: pid,
    level: "D",
    tag: "App",
    processName: packageName,
    packageName,
    message: "hello",
  };
}

describe("process markers", () => {
  it("adds ended and started rows when the app's pid changes, not on the first sighting", () => {
    const tracker = createProcessTracker();
    tracker.setPackage("com.shop.app");
    expect(tracker.observe(line(100))).toEqual([]);
    expect(tracker.observe(line(100))).toEqual([]);
    expect(tracker.observe(line(7, "com.other"))).toEqual([]);
    const restarted = line(200);
    const markers = tracker.observe(restarted);
    expect(markers.map((marker) => [marker.marker, marker.pid, marker.message])).toEqual([
      ["process-ended", 100, "Process 100 ended"],
      ["process-started", 200, "Process 200 started"],
    ]);
    expect(markers.every((marker) => marker.seq < restarted.seq)).toBe(true);
    expect((markers[0]?.seq ?? 0) < (markers[1]?.seq ?? 0)).toBe(true);
  });

  it("starts over when the inspected app changes", () => {
    const tracker = createProcessTracker();
    tracker.setPackage("com.shop.app");
    tracker.observe(line(100));
    tracker.setPackage("com.other");
    expect(tracker.observe(line(5, "com.other"))).toEqual([]);
  });
});
