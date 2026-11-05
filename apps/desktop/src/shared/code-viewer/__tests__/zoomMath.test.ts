import { describe, expect, test } from "vite-plus/test";
import {
  MAX_SCALE,
  clampOffset,
  fitScale,
  wheelFactor,
  zoomAt,
  zoomLabel,
  zoomStep,
} from "../zoomMath";

const viewport = { width: 1000, height: 800 };

describe("zoomMath", () => {
  test("fits large images down and never enlarges small ones", () => {
    expect(fitScale({ width: 1080, height: 2400 }, viewport, 0)).toBeCloseTo(800 / 2400);
    expect(fitScale({ width: 48, height: 48 }, viewport)).toBe(1);
    expect(fitScale({ width: 0, height: 0 }, viewport)).toBe(1);
  });

  test("keeps the point under the cursor still while zooming", () => {
    const image = { width: 2000, height: 2000 };
    const start = { scale: 0.5, x: 0, y: 0 };
    const point = { x: 200, y: -100 };
    const next = zoomAt(start, 2, point, image, viewport);
    expect(next.scale).toBe(1);
    const before = { x: (point.x - start.x) / start.scale, y: (point.y - start.y) / start.scale };
    const after = { x: (point.x - next.x) / next.scale, y: (point.y - next.y) / next.scale };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  test("centres an axis where the image fits and bounds it where it does not", () => {
    const image = { width: 400, height: 4000 };
    const clamped = clampOffset({ scale: 1, x: 300, y: -5000 }, image, viewport);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(-1600);
  });

  test("clamps the scale", () => {
    const next = zoomAt({ scale: 30, x: 0, y: 0 }, 10, { x: 0, y: 0 }, viewport, viewport);
    expect(next.scale).toBe(MAX_SCALE);
  });

  test("turns wheel deltas into smooth factors", () => {
    expect(wheelFactor(-100, 0, false)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0, false)).toBeLessThan(1);
    expect(wheelFactor(-3, 1, false)).toBeCloseTo(wheelFactor(-48, 0, false));
    expect(wheelFactor(-10, 0, true)).toBeGreaterThan(wheelFactor(-10, 0, false));
  });

  test("steps through preset scales", () => {
    expect(zoomStep(1, 1)).toBe(1.5);
    expect(zoomStep(1, -1)).toBe(0.75);
    expect(zoomStep(0.33, 1)).toBe(0.5);
    expect(zoomStep(32, 1)).toBe(32);
    expect(zoomLabel(0.333)).toBe("33%");
  });
});
