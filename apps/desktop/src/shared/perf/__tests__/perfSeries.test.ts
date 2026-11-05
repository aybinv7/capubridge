import { describe, expect, test } from "vite-plus/test";
import {
  mergeSeries,
  sampleAccessor,
  seriesStats,
  seriesValues,
  seriesYDomain,
} from "../perfSeries";
import { SampleRing } from "../sampleRing";

describe("SampleRing", () => {
  test("a new ring has no samples, not a row of zeros", () => {
    const ring = new SampleRing(4, 1000);
    expect(ring.size).toBe(0);
    expect(ring.latestTime).toBeNull();
    expect(ring.series("cpu")).toEqual([]);
  });

  test("keeps the newest samples in order and overwrites the oldest", () => {
    const ring = new SampleRing(3, 1000);
    for (const [time, cpu] of [
      [1000, 1],
      [2000, 2],
      [3000, 3],
      [4000, 4],
    ] as const) {
      ring.push(time, { cpu });
    }
    expect(ring.values("cpu")).toEqual([2, 3, 4]);
    expect(ring.latestTime).toBe(4000);
  });

  test("missing or non-finite readings are gaps, real zeros are kept", () => {
    const ring = new SampleRing(4, 1000);
    ring.push(1000, { cpu: 0 });
    ring.push(2000, { cpu: null });
    ring.push(3000, { cpu: Number.NaN });
    ring.push(4000, { cpu: 12, mem: 40 });
    expect(ring.values("cpu")).toEqual([0, null, null, 12]);
    expect(ring.values("mem")).toEqual([null, null, null, 40]);
  });

  test("each point carries the time it was read, and a pause shows as a gap", () => {
    const ring = new SampleRing(5, 1000);
    ring.push(1000, { cpu: 5 });
    ring.push(2000, { cpu: 6 });
    ring.push(30_000, { cpu: 7 });
    expect(ring.series("cpu")).toEqual([
      { x: 1000, cpu: 5 },
      { x: 2000, cpu: 6 },
      { x: 3000, cpu: null },
      { x: 30_000, cpu: 7 },
    ]);
  });

  test("clear forgets every channel", () => {
    const ring = new SampleRing(3, 1000);
    ring.push(1000, { cpu: 1 });
    ring.clear();
    expect(ring.size).toBe(0);
    expect(ring.values("cpu")).toEqual([]);
  });
});

describe("perfSeries helpers for charts", () => {
  const ring = new SampleRing(4, 1000);
  ring.push(1000, { cpu: null, rx: 1, tx: 3 });
  ring.push(2000, { cpu: 10, rx: null, tx: 4 });
  ring.push(3000, { cpu: 30, rx: 90, tx: 2 });

  test("stats ignore gaps and are null without any sample", () => {
    expect(seriesStats(new SampleRing(2, 1000).series("cpu"), "cpu")).toBeNull();
    expect(seriesStats(ring.series("cpu"), "cpu")).toEqual({ now: 30, min: 10, max: 30, avg: 20 });
  });

  test("the chart accessor leaves gaps undefined instead of plotting zero", () => {
    const [gap, value] = ring.series("cpu");
    const accessor = sampleAccessor("cpu");
    expect(gap && accessor(gap)).toBeUndefined();
    expect(value && accessor(value)).toBe(10);
  });

  test("the y domain stays positive when there is nothing to plot", () => {
    expect(seriesYDomain([], "rx")).toEqual([0, 1]);
    expect(seriesYDomain(ring.series("rx"), "rx")).toEqual([0, 200]);
  });

  test("merging keeps every key per tick and the ticks of the first series", () => {
    expect(mergeSeries(ring.series("rx"), ring.series("tx"))).toEqual([
      { x: 1000, rx: 1, tx: 3 },
      { x: 2000, rx: null, tx: 4 },
      { x: 3000, rx: 90, tx: 2 },
    ]);
  });

  test("sparkline values keep gaps", () => {
    expect(seriesValues(ring.series("cpu"), "cpu")).toEqual([null, 10, 30]);
  });
});
