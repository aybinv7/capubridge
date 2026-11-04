import { describe, expect, test } from "vite-plus/test";
import {
  emptyHistory,
  hasSamples,
  pushSample,
  sampleAccessor,
  seriesStats,
  seriesYDomain,
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
