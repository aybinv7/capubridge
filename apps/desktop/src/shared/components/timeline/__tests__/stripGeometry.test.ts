import { describe, expect, test } from "vite-plus/test";
import { TIMELINE_LANES, type TimelineLane } from "@/types/timeline.types";
import {
  buildStripGeometry,
  createStripGeometry,
  hairlineRects,
  rangeRects,
  secondToX,
  unkeptWidth,
  xToSecond,
  type BucketWindow,
  type StripScale,
} from "../stripGeometry";

const NOW = 1_730_000_000_000;

function buckets(
  seconds: number,
  fill: (lane: TimelineLane, index: number) => number,
): BucketWindow {
  const fromSecond = Math.floor(NOW / 1000) - seconds + 1;
  const counts = {} as Record<TimelineLane, Uint32Array>;
  for (const lane of TIMELINE_LANES) {
    counts[lane] = Uint32Array.from({ length: seconds }, (_, index) => fill(lane, index));
  }
  return { fromSecond, counts };
}

function scale(windowMs: number, width: number): StripScale {
  return { startMs: NOW - windowMs, windowMs, width };
}

describe("strip geometry", () => {
  test("maps seconds to x and back", () => {
    const s = scale(60_000, 600);
    const second = Math.floor((NOW - 30_000) / 1000);
    const x = secondToX(second, s);
    expect(x).toBeCloseTo(300, 0);
    expect(xToSecond(x + 1, s)).toBe(second);
  });

  test("draws one bar per busy second and nothing for quiet ones", () => {
    const window = buckets(60, (lane, index) => (lane === "console" && index % 2 === 0 ? 3 : 0));
    const geometry = buildStripGeometry(window, scale(60_000, 600), scale(60_000, 500));
    expect(geometry.rest.console.count).toBe(30);
    expect(geometry.lanes.console.count).toBe(30);
    expect(geometry.rest.network.count).toBe(0);
    expect(geometry.lanes.errors.count).toBe(0);
  });

  test("caps a second that holds an error on top of its stack", () => {
    const window = buckets(60, (lane, index) =>
      index === 58 && (lane === "errors" || lane === "console") ? 1 : 0,
    );
    const geometry = buildStripGeometry(window, scale(60_000, 600), scale(60_000, 500));
    expect(geometry.rest.errors.count).toBe(1);
    const consoleTop = geometry.rest.console.data[1] ?? 0;
    const capBottom = (geometry.rest.errors.data[1] ?? 0) + (geometry.rest.errors.data[3] ?? 0);
    expect(capBottom).toBeLessThan(consoleTop);
    expect(geometry.lanes.errors.count).toBe(1);
  });

  test("clips seconds outside the window", () => {
    const window = buckets(120, () => 1);
    const geometry = buildStripGeometry(window, scale(60_000, 600), scale(60_000, 600));
    const { data, count } = geometry.lanes.logcat;
    expect(count).toBeLessThanOrEqual(61);
    for (let index = 0; index < count; index += 1) {
      expect(data[index * 4]).toBeGreaterThanOrEqual(0);
      expect((data[index * 4] ?? 0) + (data[index * 4 + 2] ?? 0)).toBeLessThanOrEqual(600.01);
    }
  });

  test("reuses its buffers between paints", () => {
    const out = createStripGeometry(60);
    buildStripGeometry(
      buckets(60, () => 2),
      scale(60_000, 600),
      scale(60_000, 600),
      out,
    );
    const again = buildStripGeometry(
      buckets(60, (_, index) => (index === 0 ? 1 : 0)),
      scale(60_000, 600),
      scale(60_000, 600),
      out,
    );
    expect(again).toBe(out);
    expect(again.lanes.logcat.count).toBe(1);
  });

  test("ranges, hairlines and the unkept edge stay inside the strip", () => {
    const s = scale(60_000, 600);
    expect(rangeRects([{ start: NOW - 120_000, end: null }], s, 26, NOW)).toEqual([
      { x: 0, y: 26, width: 600, height: 1.5 },
    ]);
    expect(hairlineRects([NOW - 30_000, NOW - 90_000], s, 0, 28)).toEqual([
      { x: 300, y: 0, width: 1, height: 28 },
    ]);
    expect(unkeptWidth(NOW - 15_000, s)).toBe(450);
    expect(unkeptWidth(NOW - 600_000, s)).toBe(0);
  });

  test("turns 15 minutes of busy buckets into geometry in under 2 ms", () => {
    const window = buckets(900, (lane, index) => (index * 7 + lane.length) % 13);
    const rest = scale(900_000, 1400);
    const lanes = scale(900_000, 1300);
    const out = createStripGeometry(900);
    for (let run = 0; run < 5; run += 1) buildStripGeometry(window, rest, lanes, out);
    const timings: number[] = [];
    for (let run = 0; run < 25; run += 1) {
      const started = performance.now();
      buildStripGeometry(window, rest, lanes, out);
      timings.push(performance.now() - started);
    }
    timings.sort((a, b) => a - b);
    expect(timings[Math.floor(timings.length / 2)]).toBeLessThan(2);
  });
});
