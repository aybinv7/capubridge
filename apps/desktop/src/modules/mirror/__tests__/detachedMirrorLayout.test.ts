import { describe, expect, it } from "vite-plus/test";
import { getDetachedMirrorLayoutMetrics } from "../detachedMirrorLayout";

const screen = { availWidth: 1920, availHeight: 1032 };

function metrics(aspectRatio: number) {
  return getDetachedMirrorLayoutMetrics({
    ...screen,
    preferredWidth: 330,
    aspectRatio,
    mode: "panel",
    settingsOpen: false,
    isRecording: false,
  });
}

describe("getDetachedMirrorLayoutMetrics", () => {
  it("lets a portrait phone fill the screen height", () => {
    const portrait = metrics(1080 / 2400);
    expect(portrait.phoneHeight).toBeGreaterThan(900);
    expect(portrait.windowHeight).toBeLessThanOrEqual(screen.availHeight - 24);
  });

  it("turns a landscape phone in place instead of spanning the screen", () => {
    const portrait = metrics(1080 / 2400);
    const landscape = metrics(2400 / 1080);
    expect(landscape.phoneWidth).toBeLessThanOrEqual(portrait.phoneHeight + 1);
    expect(landscape.windowWidth).toBeLessThan(screen.availWidth / 2 + 200);
    expect(landscape.phoneHeight).toBeLessThan(landscape.phoneWidth);
  });
});
