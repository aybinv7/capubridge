import { describe, expect, test } from "vite-plus/test";
import { axisTicks, isStripWindow } from "../stripWindows";

describe("strip windows", () => {
  test("labels the axis from the window's left edge to now", () => {
    expect(axisTicks("5m").map((tick) => tick.label)).toEqual([
      "-5 min",
      "-4 min",
      "-3 min",
      "-2 min",
      "-1 min",
      "now",
    ]);
    expect(axisTicks("1m").map((tick) => tick.label)).toEqual([
      "-1 min",
      "-45 s",
      "-30 s",
      "-15 s",
      "now",
    ]);
    expect(axisTicks("15m").at(0)).toEqual({ fraction: 0, label: "-15 min" });
    expect(axisTicks("15m").at(-1)).toEqual({ fraction: 1, label: "now" });
  });

  test("accepts only the three windows", () => {
    expect(isStripWindow("1m")).toBe(true);
    expect(isStripWindow("10m")).toBe(false);
    expect(isStripWindow(5)).toBe(false);
  });
});
