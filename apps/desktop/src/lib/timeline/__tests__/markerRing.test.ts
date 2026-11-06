import { describe, expect, it } from "vite-plus/test";
import { MarkerRing, TIMELINE_LABEL_MAX } from "@/lib/timeline/markerRing";
import type { TimelineLane, TimelineMarkerInput } from "@/types/timeline.types";

const BASE = 1_730_000_000_000;

function marker(t: number, lane: TimelineLane = "logcat", id = String(t)): TimelineMarkerInput {
  return { t, lane, severity: "info", ref: { kind: "logcat", id }, label: `line ${id}` };
}

describe("MarkerRing", () => {
  it("keeps markers in arrival order and reads them back", () => {
    const ring = new MarkerRing({ capacity: 10 });
    ring.push(marker(BASE + 10));
    ring.push({ ...marker(BASE + 20, "errors"), severity: "error" });
    expect(ring.size).toBe(2);
    expect(ring.at(0)).toMatchObject({ t: BASE + 10, lane: "logcat", severity: "info", seq: 1 });
    expect(ring.at(1)).toMatchObject({ t: BASE + 20, lane: "errors", severity: "error", seq: 2 });
    expect(ring.at(2)).toBeUndefined();
  });

  it("cuts labels to 80 characters", () => {
    const ring = new MarkerRing({ capacity: 2 });
    ring.push({ ...marker(BASE), label: "x".repeat(200) });
    expect(ring.at(0)?.label).toHaveLength(TIMELINE_LABEL_MAX);
  });

  it("evicts the oldest marker at capacity and keeps the buckets right", () => {
    const ring = new MarkerRing({ capacity: 3 });
    ring.push(marker(BASE + 100));
    ring.push(marker(BASE + 200));
    ring.push(marker(BASE + 1_100));
    ring.push(marker(BASE + 1_200));
    expect(ring.size).toBe(3);
    expect(ring.at(0)?.t).toBe(BASE + 200);
    const second = Math.floor(BASE / 1000);
    expect(ring.bucketCount(second, "logcat")).toBe(1);
    expect(ring.bucketCount(second + 1, "logcat")).toBe(2);
  });

  it("counts each lane per second without scanning markers", () => {
    const ring = new MarkerRing();
    for (let index = 0; index < 5; index += 1) ring.push(marker(BASE + index * 10, "network"));
    ring.push(marker(BASE + 500, "errors"));
    ring.push(marker(BASE + 2_000, "network"));
    const second = Math.floor(BASE / 1000);
    expect(Array.from(ring.bucketRange(second, second + 3, "network"))).toEqual([5, 0, 1]);
    expect(ring.bucketCount(second, "errors")).toBe(1);
    expect(ring.bucketCount(second, "console")).toBe(0);
  });

  it("ages out markers and buckets older than ten minutes", () => {
    const ring = new MarkerRing();
    ring.push(marker(BASE));
    ring.push(marker(BASE + 5 * 60_000));
    ring.push(marker(BASE + 10 * 60_000 + 1));
    expect(ring.size).toBe(2);
    expect(ring.at(0)?.t).toBe(BASE + 5 * 60_000);
    expect(ring.bucketCount(Math.floor(BASE / 1000), "logcat")).toBe(0);

    expect(ring.ageOut(BASE + 16 * 60_000)).toBe(1);
    expect(ring.size).toBe(1);
  });

  it("refuses a marker that arrives already too old, or with a bad time", () => {
    const ring = new MarkerRing();
    ring.push(marker(BASE + 20 * 60_000));
    expect(ring.push(marker(BASE))).toBe(false);
    expect(ring.push(marker(Number.NaN))).toBe(false);
    expect(ring.size).toBe(1);
  });

  it("reuses a bucket slot for a later second instead of adding to it", () => {
    const ring = new MarkerRing({ maxAgeMs: 2_000 });
    ring.push(marker(BASE));
    ring.push(marker(BASE + 3_000));
    const second = Math.floor(BASE / 1000);
    expect(ring.bucketCount(second + 3, "logcat")).toBe(1);
    expect(ring.bucketCount(second, "logcat")).toBe(0);
  });

  it("lists markers in a time range, capped", () => {
    const ring = new MarkerRing();
    for (let index = 0; index < 30; index += 1) ring.push(marker(BASE + index * 100));
    const found = ring.inRange(BASE + 1_000, BASE + 2_000, 20);
    expect(found).toHaveLength(10);
    expect(found[0]?.t).toBe(BASE + 1_000);
    expect(ring.inRange(BASE, BASE + 3_000, 20)).toHaveLength(20);
  });

  it("empties on clear", () => {
    const ring = new MarkerRing();
    ring.push(marker(BASE));
    ring.clear();
    expect(ring.size).toBe(0);
    expect(ring.bucketCount(Math.floor(BASE / 1000), "logcat")).toBe(0);
  });
});
