import { describe, expect, it } from "vite-plus/test";
import { createFrameClock, EMPTY_FRAME_READING } from "../mirrorFrameClock";

describe("createFrameClock", () => {
  it("reads empty before the first frame", () => {
    expect(createFrameClock().read(1000)).toEqual(EMPTY_FRAME_READING);
  });

  it("counts frames inside the window and reports the age of the last one", () => {
    const clock = createFrameClock(1000);
    for (let at = 0; at < 1000; at += 100) clock.record(at);
    expect(clock.read(950)).toEqual({ fps: 10, lastFrameAt: 900, ageMs: 50 });
  });

  it("drops frames that fell out of the window", () => {
    const clock = createFrameClock(1000);
    clock.record(0);
    clock.record(100);
    clock.record(1500);
    expect(clock.read(1600).fps).toBe(1);
    expect(clock.read(3000)).toEqual({ fps: 0, lastFrameAt: 1500, ageMs: 1500 });
  });

  it("scales a short window to frames per second", () => {
    const clock = createFrameClock(500);
    for (let at = 0; at < 500; at += 50) clock.record(at);
    expect(clock.read(499).fps).toBe(20);
  });

  it("keeps counting correctly after the ring wraps", () => {
    const clock = createFrameClock(1000, 8);
    for (let at = 0; at < 2000; at += 100) clock.record(at);
    expect(clock.read(1950).fps).toBe(8);
    expect(clock.read(1950).lastFrameAt).toBe(1900);
  });

  it("reset forgets every frame", () => {
    const clock = createFrameClock();
    clock.record(10);
    clock.reset();
    expect(clock.read(20)).toEqual(EMPTY_FRAME_READING);
  });
});
