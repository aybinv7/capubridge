import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_WEB_VIEWPORT,
  RESPONSIVE_ID,
  VIEWPORT_LIMITS,
  choosePreset,
  isWebViewport,
  resizeViewport,
  resolveViewport,
  rotateViewport,
} from "../web-viewport";

describe("web viewport", () => {
  it("resolves a free size as a touch device only when it is narrow", () => {
    expect(resolveViewport(DEFAULT_WEB_VIEWPORT)).toMatchObject({
      width: 390,
      height: 844,
      dpr: 1,
      mobile: true,
    });
    const wide = resizeViewport(1280, 800);
    expect(resolveViewport(wide).mobile).toBe(false);
  });

  it("resolves a device with its pixel ratio and turns it on rotation", () => {
    const tablet = choosePreset(DEFAULT_WEB_VIEWPORT, "ipad-air");
    expect(resolveViewport(tablet)).toMatchObject({
      width: 820,
      height: 1180,
      dpr: 2,
      mobile: true,
    });
    expect(resolveViewport(rotateViewport(tablet))).toMatchObject({ width: 1180, height: 820 });
  });

  it("turns any pick into a free size when resized, keeping it inside the limits", () => {
    const resized = resizeViewport(10, 99999);
    expect(resized.presetId).toBe(RESPONSIVE_ID);
    expect(resized.width).toBe(VIEWPORT_LIMITS.min);
    expect(resized.height).toBe(VIEWPORT_LIMITS.max);
  });

  it("keeps the current size when switching from a device to responsive", () => {
    const rotatedLaptop = rotateViewport(choosePreset(DEFAULT_WEB_VIEWPORT, "laptop"));
    const free = choosePreset(rotatedLaptop, RESPONSIVE_ID);
    expect(free).toEqual({ presetId: RESPONSIVE_ID, width: 800, height: 1280, rotated: false });
  });

  it("rejects stored values that name an unknown device", () => {
    expect(isWebViewport(DEFAULT_WEB_VIEWPORT)).toBe(true);
    expect(isWebViewport({ ...DEFAULT_WEB_VIEWPORT, presetId: "nokia-3310" })).toBe(false);
  });
});
