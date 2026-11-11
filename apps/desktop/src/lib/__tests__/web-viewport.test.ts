import { describe, expect, it } from "vite-plus/test";
import {
  CUSTOM_ID,
  DEFAULT_WEB_VIEWPORT,
  RESPONSIVE_ID,
  VIEWPORT_LIMITS,
  choosePreset,
  followsArea,
  isWebViewport,
  resizeViewport,
  resolveViewport,
  rotateViewport,
} from "../web-viewport";

describe("web viewport", () => {
  it("lays Responsive out at the frame's own size, at 100%", () => {
    expect(resolveViewport(DEFAULT_WEB_VIEWPORT, { width: 1093.6, height: 671.2 })).toMatchObject({
      width: 1094,
      height: 671,
      dpr: 1,
      mobile: false,
      label: "Responsive",
    });
    expect(resolveViewport(DEFAULT_WEB_VIEWPORT, { width: 400, height: 700 }).mobile).toBe(true);
  });

  it("keeps Responsive's last size when no frame is known", () => {
    expect(resolveViewport(DEFAULT_WEB_VIEWPORT)).toMatchObject({ width: 390, height: 844 });
    expect(resolveViewport(DEFAULT_WEB_VIEWPORT, { width: 0, height: 0 })).toMatchObject({
      width: 390,
      height: 844,
    });
  });

  it("resolves a device with its pixel ratio and turns it on rotation", () => {
    const tablet = choosePreset(DEFAULT_WEB_VIEWPORT, "ipad-air");
    expect(resolveViewport(tablet, { width: 2000, height: 2000 })).toMatchObject({
      width: 820,
      height: 1180,
      dpr: 2,
      mobile: true,
    });
    expect(resolveViewport(rotateViewport(tablet))).toMatchObject({ width: 1180, height: 820 });
  });

  it("a typed size becomes a custom size that ignores the frame", () => {
    const resized = resizeViewport(10, 99999);
    expect(resized.presetId).toBe(CUSTOM_ID);
    expect(resized.width).toBe(VIEWPORT_LIMITS.min);
    expect(resized.height).toBe(VIEWPORT_LIMITS.max);
    expect(resolveViewport(resized, { width: 500, height: 500 })).toMatchObject({
      width: VIEWPORT_LIMITS.min,
      height: VIEWPORT_LIMITS.max,
      label: "Custom",
    });
    expect(rotateViewport(resized)).toMatchObject({
      width: VIEWPORT_LIMITS.max,
      height: VIEWPORT_LIMITS.min,
    });
  });

  it("Responsive follows the frame, so rotating it changes nothing", () => {
    const free = choosePreset(choosePreset(DEFAULT_WEB_VIEWPORT, "laptop"), RESPONSIVE_ID);
    expect(followsArea(free)).toBe(true);
    expect(rotateViewport(free)).toEqual(free);
  });

  it("accepts stored responsive and custom sizes, and rejects unknown devices", () => {
    expect(isWebViewport(DEFAULT_WEB_VIEWPORT)).toBe(true);
    expect(isWebViewport(resizeViewport(800, 600))).toBe(true);
    expect(isWebViewport({ ...DEFAULT_WEB_VIEWPORT, presetId: "nokia-3310" })).toBe(false);
  });
});
