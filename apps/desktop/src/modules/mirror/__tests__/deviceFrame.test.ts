import { describe, expect, it } from "vite-plus/test";
import {
  BEZEL_PX,
  PANEL_MAX_WIDTH_PX,
  PANEL_MIN_WIDTH_PX,
  fitDeviceFrame,
  idealColumnWidth,
  streamAspect,
} from "../deviceFrame";

describe("fitDeviceFrame", () => {
  it("fills the height of a tall well with the stream's exact aspect", () => {
    const frame = fitDeviceFrame({
      areaWidth: 400,
      areaHeight: 808,
      deviceWidth: 1080,
      deviceHeight: 2400,
    });
    expect(frame.height).toBe(800 + 2 * BEZEL_PX);
    expect(frame.screenHeight).toBe(800);
    expect(frame.screenWidth).toBe(360);
    expect(frame.orientation).toBe("portrait");
  });

  it("is limited by width when the column is narrow, leaving no letterbox inside the bezel", () => {
    const frame = fitDeviceFrame({
      areaWidth: 248,
      areaHeight: 900,
      deviceWidth: 1080,
      deviceHeight: 2400,
    });
    expect(frame.width).toBe(248);
    expect(frame.screenWidth / frame.screenHeight).toBeCloseTo(1080 / 2400, 2);
  });

  it("lays a landscape stream on its side", () => {
    const frame = fitDeviceFrame({
      areaWidth: 520,
      areaHeight: 800,
      deviceWidth: 2400,
      deviceHeight: 1080,
    });
    expect(frame.orientation).toBe("landscape");
    expect(frame.width).toBe(520);
    expect(frame.height).toBeLessThan(frame.width);
    expect(frame.screenWidth / frame.screenHeight).toBeCloseTo(2400 / 1080, 1);
  });

  it("rounds corners in proportion to the short side, within limits", () => {
    const large = fitDeviceFrame({
      areaWidth: 600,
      areaHeight: 1300,
      deviceWidth: 9,
      deviceHeight: 19.5,
    });
    const small = fitDeviceFrame({
      areaWidth: 60,
      areaHeight: 130,
      deviceWidth: 9,
      deviceHeight: 19.5,
    });
    expect(large.innerRadius).toBe(44);
    expect(small.innerRadius).toBe(6);
    expect(large.outerRadius).toBe(large.innerRadius + BEZEL_PX);
  });

  it("draws nothing until the well has a size", () => {
    const frame = fitDeviceFrame({ areaWidth: 0, areaHeight: 0, deviceWidth: 0, deviceHeight: 0 });
    expect(frame).toMatchObject({ width: 0, height: 0, innerRadius: 0 });
  });
});

describe("idealColumnWidth", () => {
  it("widens the column for a landscape stream and clamps it", () => {
    expect(idealColumnWidth(800, streamAspect(1080, 2400))).toBeGreaterThan(PANEL_MIN_WIDTH_PX);
    expect(idealColumnWidth(800, streamAspect(2400, 1080))).toBe(PANEL_MAX_WIDTH_PX);
    expect(idealColumnWidth(100, streamAspect(1080, 2400))).toBe(PANEL_MIN_WIDTH_PX);
  });

  it("falls back to a phone aspect before the first frame", () => {
    expect(streamAspect(0, 0)).toBeCloseTo(9 / 19.5);
  });
});
