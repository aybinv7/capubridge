import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createFrameBatcher } from "../frame-batcher";

describe("createFrameBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("coalesces pushes into a single flush per frame", () => {
    const flush = vi.fn();
    const batcher = createFrameBatcher<number>(flush, 100);
    batcher.push(1);
    batcher.push(2);
    batcher.push(3);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([1, 2, 3]);
  });

  test("drops the oldest items beyond maxPending", () => {
    const flush = vi.fn();
    const batcher = createFrameBatcher<number>(flush, 3);
    for (let value = 1; value <= 5; value += 1) {
      batcher.push(value);
    }
    batcher.flushNow();
    expect(flush).toHaveBeenCalledWith([3, 4, 5]);
  });

  test("exposes the last pending item for de-duplication", () => {
    const batcher = createFrameBatcher<string>(vi.fn(), 10);
    expect(batcher.last()).toBeUndefined();
    batcher.push("a");
    batcher.push("b");
    expect(batcher.last()).toBe("b");
  });

  test("clear discards pending items without flushing", () => {
    const flush = vi.fn();
    const batcher = createFrameBatcher<number>(flush, 10);
    batcher.push(1);
    batcher.clear();
    vi.advanceTimersByTime(100);
    expect(flush).not.toHaveBeenCalled();
  });

  test("flushNow delivers immediately and cancels the scheduled frame", () => {
    const flush = vi.fn();
    const batcher = createFrameBatcher<number>(flush, 10);
    batcher.push(1);
    batcher.flushNow();
    vi.advanceTimersByTime(100);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
