import { describe, expect, test } from "vite-plus/test";
import {
  emptyHistory,
  hasSamples,
  mergeSeries,
  pushSample,
  sampleAccessor,
  seriesStats,
  seriesValues,
  seriesYDomain,
  tickTimestamp,
  toSeries,
} from "../perfSeries";

describe("perfSeries", () => {
  test("a new history has no samples, not a row of zeros", () => {
    const history = emptyHistory(4);
    expect(history).toEqual([null, null, null, null]);
    expect(hasSamples(history)).toBe(false);
  });

  test("missing or non-finite readings are gaps, real zeros are kept", () => {
    let history = emptyHistory(4);
    history = pushSample(history, 0);
    history = pushSample(history, null);
    history = pushSample(history, Number.NaN);
    history = pushSample(history, 12);
    expect(history).toEqual([0, null, null, 12]);
  });

  test("stats ignore gaps and are null without any sample", () => {
    expect(seriesStats(toSeries(emptyHistory(3), "cpu", 3), "cpu")).toBeNull();
    const series = toSeries([null, 10, null, 30], "cpu", 4);
    expect(seriesStats(series, "cpu")).toEqual({ now: 30, min: 10, max: 30, avg: 20 });
  });

  test("the chart accessor leaves gaps undefined instead of plotting zero", () => {
    const [gap, value] = toSeries([null, 5], "mem", 2);
    const accessor = sampleAccessor("mem");
    expect(gap && accessor(gap)).toBeUndefined();
    expect(value && accessor(value)).toBe(5);
  });

  test("the y domain stays positive when there is nothing to plot", () => {
    expect(seriesYDomain(toSeries(emptyHistory(3), "rx", 3), "rx")).toEqual([0, 1]);
    expect(seriesYDomain(toSeries([null, 90], "rx", 2), "rx")).toEqual([0, 200]);
  });
});

describe("perfSeries helpers for charts", () => {
  test("merging keeps every key per tick and the ticks of the first series", () => {
    const rx = toSeries([1, null], "rx", 2);
    const tx = toSeries([3, 4], "tx", 2);
    expect(mergeSeries(rx, tx)).toEqual([
      { x: 1, rx: 1, tx: 3 },
      { x: 2, rx: null, tx: 4 },
    ]);
  });

  test("sparkline values keep gaps", () => {
    expect(seriesValues(toSeries([null, 7], "cpu", 2), "cpu")).toEqual([null, 7]);
  });

  test("tick times count back from the newest reading in seconds", () => {
    expect(tickTimestamp(58, 60, 100_000)).toBe(98_000);
    expect(tickTimestamp(60, 60, null)).toBeNull();
  });
});
